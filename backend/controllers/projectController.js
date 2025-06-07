const mongoose = require('mongoose');
const XLSX = require('xlsx');
const multer = require('multer');
const fs = require('fs').promises; // Для удаления файлов
const path = require('path'); // Для работы с путями
const { translateText } = require('../utils/openai');
const Project = require('../models/Project');
const { broadcast } = require('../utils/websocket');
const { setTranslationState, getTranslationState } = require('../utils/translationState');

const upload = multer({ dest: 'uploads/' });

// Кэш для моделей коллекций
const collectionModels = new Map();

exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find().lean();
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
      translations: [],
      translationCollections: []
    });
    
    await project.save();
    console.log('Project created:', project._id, 'translations:', project.translations, 'translationCollections:', project.translationCollections);
    broadcast({ type: 'PROJECT_CREATED', project: project.toObject() });
    res.status(201).json(project.toObject());
  } catch (error) {
    console.error('Error creating project:', error.message);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

exports.startTranslation = async (req, res) => {
  const { id } = req.params;
  let project;
  try {
    project = await Project.findById(id).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    await Project.updateOne({ _id: id }, { status: 'running' });
    if (!Array.isArray(project.translations)) {
      await Project.updateOne({ _id: id }, { translations: [] });
      console.log(`Initialized translations for project ${id}`);
    }
    if (!Array.isArray(project.translationCollections)) {
      await Project.updateOne({ _id: id }, { translationCollections: [] });
      console.log(`Initialized translationCollections for project ${id}`);
    }
    project = await Project.findById(id).lean();
    setTranslationState(id, true);
    broadcast({ type: 'PROJECT_UPDATED', project });
    
    const workbook = XLSX.readFile(project.filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    let currentCollection = null;
    let collectionIndex = project.translationCollections.length + 1;
    let maxRowsPerCollection = 5; // Для теста
    let rowCountInCurrentCollection = 0;

    // Определяем текущую коллекцию
    if (project.translationCollections.length > 0) {
      const lastCollectionName = project.translationCollections[project.translationCollections.length - 1];
      console.log(`Using existing collection: ${lastCollectionName}`);
      let LastCollection = collectionModels.get(lastCollectionName);
      if (!LastCollection) {
        const TranslationSchema = new mongoose.Schema({
          translations: [{
            imdbid: String,
            original: { title: String, description: String },
            translated: [{
              language: String,
              title: String,
              description: String
            }]
          }]
        });
        LastCollection = mongoose.model(lastCollectionName, TranslationSchema, lastCollectionName);
        collectionModels.set(lastCollectionName, LastCollection);
      }
      currentCollection = await LastCollection.findOne().sort({ _id: -1 });
      if (!currentCollection) {
        currentCollection = new LastCollection({ translations: [] });
        await currentCollection.save();
      }
      rowCountInCurrentCollection = currentCollection.translations ? currentCollection.translations.length : 0;
    } else {
      console.log('Using project.translations as initial collection');
      currentCollection = await Project.findById(id);
      rowCountInCurrentCollection = currentCollection.translations ? currentCollection.translations.length : 0;
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
        let NewCollection = collectionModels.get(newCollectionName);
        if (!NewCollection) {
          const TranslationSchema = new mongoose.Schema({
            translations: [{
              imdbid: String,
              original: { title: String, description: String },
              translated: [{
                language: String,
                title: String,
                description: String
              }]
            }]
          });
          NewCollection = mongoose.model(newCollectionName, TranslationSchema, newCollectionName);
          collectionModels.set(newCollectionName, NewCollection);
        }
        currentCollection = new NewCollection({ translations: [] });
        await currentCollection.save();
        console.log(`New collection ${newCollectionName} saved with ID ${currentCollection._id}`);
        await Project.updateOne(
          { _id: id },
          { $push: { translationCollections: newCollectionName } }
        );
        console.log(`Updated translationCollections for project ${id}`);
        project = await Project.findById(id).lean();
        console.log(`Current translationCollections:`, project.translationCollections);
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
            await Project.updateOne(
              { _id: id },
              { status: 'error', errorMessage: 'OpenAI quota exceeded. Please top up your account and resume.' }
            );
            setTranslationState(id, false);
            broadcast({ type: 'PROJECT_UPDATED', project: await Project.findById(id).lean() });
            return res.status(429).json({ error: 'Translation failed' });
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
      } else {
        await Project.updateOne(
          { _id: id },
          { $push: { translations: currentCollection.translations[currentCollection.translations.length - 1] } }
        );
      }
      
      await Project.updateOne(
        { _id: id },
        { translatedRows: i + 1, progress: ((i + 1) / data.length) * 100 }
      );
      project = await Project.findById(id).lean();
      broadcast({ type: 'PROJECT_UPDATED', project });
      rowCountInCurrentCollection++;
    }
    
    if (getTranslationState(id)) {
      await Project.updateOne({ _id: id }, { status: 'completed' });
      setTranslationState(id, false);
      console.log(`Translation completed for project ${id}`);
      broadcast({ type: 'PROJECT_UPDATED', project: await Project.findById(id).lean() });
    }
    
    res.json(await Project.findById(id).lean());
  } catch (error) {
    console.error('Error in translation:', error.message);
    if (project) {
      await Project.updateOne(
        { _id: id },
        { status: 'error', errorMessage: error.message }
      );
      setTranslationState(id, false);
      broadcast({ type: 'PROJECT_UPDATED', project: await Project.findById(id).lean() });
    }
    res.status(500).json({ error: 'Translation failed' });
  }
};

exports.cancelTranslation = async (req, res) => {
  const { id } = req.params;
  try {
    const project = await Project.findById(id).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    console.log(`Canceling translation for project ${id}`);
    await Project.updateOne({ _id: id }, { status: 'canceled' });
    setTranslationState(id, false);
    broadcast({ type: 'PROJECT_UPDATED', project: await Project.findById(id).lean() });
    res.json(await Project.findById(id).lean());
  } catch (error) {
    console.error('Error canceling translation:', error.message);
    res.status(500).json({ error: 'Failed to cancel' });
  }
};

exports.resumeTranslation = async (req, res) => {
  const { id } = req.params;
  try {
    const project = await Project.findById(id).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    await Project.updateOne({ _id: id }, { status: 'running', errorMessage: '' });
    setTranslationState(id, true);
    broadcast({ type: 'PROJECT_UPDATED', project: await Project.findById(id).lean() });
    
    exports.startTranslation(req, res);
  } catch (error) {
    console.error('Error resuming translation:', error.message);
    res.status(500).json({ error: 'Failed to resume' });
  }
};

exports.deleteProject = async (req, res) => {
  const { id } = req.params;
  try {
    const project = await Project.findById(id).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    console.log(`Deleting project ${id}, filePath: ${project.filePath}, translationCollections:`, project.translationCollections);
    
    // Удаляем связанные коллекции
    const translationCollections = Array.isArray(project.translationCollections) ? project.translationCollections : [];
    for (const collectionName of translationCollections) {
      try {
        await mongoose.connection.dropCollection(collectionName);
        console.log(`Dropped collection ${collectionName}`);
      } catch (err) {
        console.warn(`Could not drop collection ${collectionName}: ${err.message}`);
      }
    }
    
    // Удаляем файл из uploads
    if (project.filePath) {
      try {
        const filePath = path.resolve(project.filePath);
        await fs.unlink(filePath);
        console.log(`Deleted file ${filePath}`);
      } catch (err) {
        console.warn(`Could not delete file ${project.filePath}: ${err.message}`);
      }
    }
    
    // Удаляем документ проекта
    await Project.deleteOne({ _id: id });
    console.log(`Deleted project document ${id}`);
    
    setTranslationState(id, false);
    broadcast({ type: 'PROJECT_DELETED', id });
    res.json({ message: 'Project deleted' });
  } catch (error) {
    console.error('Error deleting project:', error.message);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};

exports.downloadXLSX = async (req, res) => {
  const { id } = req.params;
  try {
    const project = await Project.findById(id).lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    console.log(`Downloading XLSX for project ${id}, raw document:`, JSON.stringify(project, null, 2));
    
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
    } else {
      console.log('No translations in project.translations');
    }
    
    // Данные из дополнительных коллекций
    const translationCollections = Array.isArray(project.translationCollections) ? project.translationCollections : [];
    console.log(`Processing ${translationCollections.length} additional collections`);
    for (const collectionName of translationCollections) {
      console.log(`Loading collection: ${collectionName}`);
      try {
        let Collection = collectionModels.get(collectionName);
        if (!Collection) {
          const TranslationSchema = new mongoose.Schema({
            translations: [{
              imdbid: String,
              original: { title: String, description: String },
              translated: [{
                language: String,
                title: String,
                description: String
              }]
            }]
          });
          Collection = mongoose.model(collectionName, TranslationSchema, collectionName);
          collectionModels.set(collectionName, Collection);
        }
        const docs = await Collection.find().lean();
        console.log(`Found ${docs.length} documents in ${collectionName}`);
        for (const doc of docs) {
          if (doc.translations && Array.isArray(doc.translations)) {
            console.log(`Processing ${doc.translations.length} translations in ${collectionName}`);
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
          } else {
            console.log(`No translations array in document of ${collectionName}`);
          }
        }
      } catch (err) {
        console.error(`Error loading collection ${collectionName}:`, err.message);
      }
    }
    
    console.log(`Total translations processed for XLSX: ${data.length}`);
    if (data.length === 0) {
      console.warn('No translations found for XLSX generation');
    }
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