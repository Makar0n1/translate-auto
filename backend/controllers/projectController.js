const mongoose = require('mongoose');
const XLSX = require('xlsx');
const multer = require('multer');
const { translateText } = require('../utils/openai');
const Project = require('../models/Project');
const { broadcast } = require('../utils/websocket');
const { setTranslationState, getTranslationState } = require('../utils/translationState');

const upload = multer({ dest: 'uploads/' });

exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find();
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error.message);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

exports.createProject = async (req, res) => {
  const { name } = req.body;
  let { columns, languages } = req.body;
  const file = req.file;

  try {
    if (typeof columns === 'string') {
      columns = JSON.parse(columns);
    }
    if (typeof languages === 'string') {
      languages = JSON.parse(languages);
    }

    if (!name || !file || !columns || !languages || !columns.imdbid || !columns.title || !columns.description || !languages.length) {
      console.error('Invalid input:', { name, file, columns, languages });
      return res.status(400).json({ error: 'All fields are required, including at least one language' });
    }

    const workbook = XLSX.readFile(file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    const project = new Project({
      name,
      filePath: file.path,
      columns,
      languages,
      totalRows: data.length,
      translationCollections: []
    });
    
    await project.save();
    console.log('Project created:', project._id);
    broadcast({ type: 'PROJECT_CREATED', project });
    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error.message);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

exports.startTranslation = async (req, res) => {
  const { id } = req.params;
  let project;
  try {
    project = await Project.findById(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    project.status = 'running';
    if (!project.translationCollections) {
      project.translationCollections = [];
    }
    await project.save();
    setTranslationState(id, true);
    broadcast({ type: 'PROJECT_UPDATED', project });
    
    const workbook = XLSX.readFile(project.filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    let currentCollection = null;
    let collectionIndex = project.translationCollections.length + 1;
    let maxRowsPerCollection = 10000;
    let rowCountInCurrentCollection = 0;

    // Определяем текущую коллекцию
    if (project.translationCollections.length > 0) {
      const lastCollectionName = project.translationCollections[project.translationCollections.length - 1];
      console.log(`Using existing collection: ${lastCollectionName}`);
      const TranslationSchema = new mongoose.Schema({
        imdbid: String,
        original: { title: String, description: String },
        translated: [{
          language: String,
          title: String,
          description: String
        }],
        translations: { type: Array, default: [] }
      });
      const LastCollection = mongoose.model(lastCollectionName, TranslationSchema, lastCollectionName);
      currentCollection = await LastCollection.findOne().sort({ _id: -1 });
      if (!currentCollection) {
        currentCollection = new LastCollection({ translations: [] });
        await currentCollection.save();
      }
      rowCountInCurrentCollection = currentCollection.translations ? currentCollection.translations.length : 0;
    } else {
      console.log('Using project.translations as initial collection');
      currentCollection = project;
      rowCountInCurrentCollection = project.translations ? project.translations.length : 0;
    }

    for (let i = project.translatedRows; i < data.length; i++) {
      if (!getTranslationState(id)) {
        console.log(`Translation stopped for project ${id} at row ${i}`);
        break;
      }
      
      // Проверяем, нужно ли создать новую коллекцию
      if (rowCountInCurrentCollection >= maxRowsPerCollection) {
        const newCollectionName = `project_${id}_${collectionIndex}`;
        console.log(`Creating new collection: ${newCollectionName}`);
        const TranslationSchema = new mongoose.Schema({
          imdbid: String,
          original: { title: String, description: String },
          translated: [{
            language: String,
            title: String,
            description: String
          }],
          translations: { type: Array, default: [] } // Явное определение
        });
        const NewCollection = mongoose.model(newCollectionName, TranslationSchema, newCollectionName);
        currentCollection = new NewCollection({ translations: [] });
        await currentCollection.save();
        console.log(`New collection ${newCollectionName} saved with ID ${currentCollection._id}`);
        project.translationCollections.push(newCollectionName);
        await project.save();
        rowCountInCurrentCollection = 0;
        collectionIndex++;
      }
      
      const row = data[i];
      const translations = [];
      
      for (const lang of project.languages) {
        try {
          const title = await translateText(row[project.columns.title], lang, 'title');
          const description = await translateText(row[project.columns.description], lang, 'description');
          translations.push({ language: lang, title, description });
        } catch (error) {
          if (error.message === 'OpenAI quota exceeded') {
            project.status = 'error';
            project.errorMessage = 'OpenAI quota exceeded. Please top up your account and resume.';
            await project.save();
            setTranslationState(id, false);
            broadcast({ type: 'PROJECT_UPDATED', project });
            return res.status(429).json({ error: project.errorMessage });
          }
          throw error;
        }
      }
      
      if (!currentCollection.translations) {
        console.error('currentCollection.translations is undefined, initializing...');
        currentCollection.translations = [];
      }
      
      console.log(`Adding translation for row ${i + 1} to collection`);
      currentCollection.translations.push({
        imdbid: row[project.columns.imdbid],
        original: {
          title: row[project.columns.title],
          description: row[project.columns.description]
        },
        translated: translations
      });
      
      if (currentCollection !== project) {
        await currentCollection.save();
        console.log(`Saved translation to collection ${currentCollection._id}`);
      }
      
      project.translatedRows = i + 1;
      project.progress = project.translatedRows / data.length * 100;
      await project.save();
      broadcast({ type: 'PROJECT_UPDATED', project });
      rowCountInCurrentCollection++;
    }
    
    if (getTranslationState(id)) {
      project.status = 'completed';
      await project.save();
      setTranslationState(id, false);
      console.log(`Translation completed for project ${id}`);
      broadcast({ type: 'PROJECT_UPDATED', project });
    }
    
    res.json(project);
  } catch (error) {
    console.error('Error in translation:', error.message);
    if (project) {
      project.status = 'error';
      project.errorMessage = error.message;
      await project.save();
      setTranslationState(id, false);
      broadcast({ type: 'PROJECT_UPDATED', project });
    }
    res.status(500).json({ error: 'Translation failed' });
  }
};

exports.cancelTranslation = async (req, res) => {
  const { id } = req.params;
  try {
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    console.log(`Canceling translation for project ${id}`);
    project.status = 'canceled';
    await project.save();
    setTranslationState(id, false);
    broadcast({ type: 'PROJECT_UPDATED', project });
    res.json(project);
  } catch (error) {
    console.error('Error canceling translation:', error.message);
    res.status(500).json({ error: 'Failed to cancel' });
  }
};

exports.resumeTranslation = async (req, res) => {
  const { id } = req.params;
  try {
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    project.status = 'running';
    project.errorMessage = '';
    await project.save();
    setTranslationState(id, true);
    broadcast({ type: 'PROJECT_UPDATED', project });
    
    exports.startTranslation(req, res);
  } catch (error) {
    console.error('Error resuming translation:', error.message);
    res.status(500).json({ error: 'Failed to resume' });
  }
};

exports.deleteProject = async (req, res) => {
  const { id } = req.params;
  try {
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    for (const collectionName of project.translationCollections) {
      try {
        await mongoose.connection.dropCollection(collectionName);
        console.log(`Dropped collection ${collectionName}`);
      } catch (err) {
        console.warn(`Could not drop collection ${collectionName}: ${err.message}`);
      }
    }
    await Project.findByIdAndDelete(id);
    setTranslationState(id, false);
    broadcast({ type: 'PROJECT_DELETED', id });
    res.json({ message: 'Project deleted' });
  } catch (error) {
    console.error('Error deleting project:', error.message);
    res.status(500).json({ error: 'Failed to delete' });
  }
};

exports.downloadXLSX = async (req, res) => {
  const { id } = req.params;
  try {
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    const workbook = XLSX.utils.book_new();
    const data = [];
    
    // Данные из project.translations
    if (project.translations && Array.isArray(project.translations)) {
      console.log(`Processing ${project.translations.length} translations from project.translations`);
      project.translations.forEach(t => {
        const row = {
          imdbid: t.imdbid,
          title: t.original.title,
          description: t.original.description
        };
        t.translated.forEach(tr => {
          row[`${tr.language} title`] = tr.title;
          row[`${tr.language} description`] = tr.description;
        });
        data.push(row);
      });
    }
    
    // Данные из дополнительных коллекций
    for (const collectionName of project.translationCollections) {
      console.log(`Processing translations from collection ${collectionName}`);
      const Collection = mongoose.model(collectionName, mongoose.Schema({
        imdbid: String,
        original: { title: String, description: String },
        translated: [{
          language: String,
          title: String,
          description: String
        }],
        translations: { type: Array, default: [] }
      }));
      const translations = await Collection.find();
      translations.forEach(doc => {
        if (doc.translations && Array.isArray(doc.translations)) {
          console.log(`Found ${doc.translations.length} translations in ${collectionName}`);
          doc.translations.forEach(t => {
            const row = {
              imdbid: t.imdbid,
              title: t.original.title,
              description: t.original.description
            };
            t.translated.forEach(tr => {
              row[`${tr.language} title`] = tr.title;
              row[`${tr.language} description`] = tr.description;
            });
            data.push(row);
          });
        }
      });
    }
    
    console.log(`Total translations processed for XLSX: ${data.length}`);
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Translations');
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename=${project.name}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error generating XLSX:', error.message);
    res.status(500).json({ error: 'Failed to generate XLSX' });
  }
};