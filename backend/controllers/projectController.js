require('dotenv').config();
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const { translateText } = require('../utils/openai');
const { getPostByUrl, updatePost } = require('../utils/wordpress');
const Project = require('../models/Project');
const Domain = require('../models/Domain');
const { broadcast } = require('../utils/websocket');
const { setTranslationState, getTranslationState } = require('../utils/translationState');

const upload = multer({ dest: 'uploads/' });
const collectionModels = new Map();

exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find().populate('domainId').lean();
    console.log(`Fetched ${projects.length} projects`);
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error.message);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

exports.createProject = async (req, res) => {
  const { name, type, importToSite, generateOnly, generateMetaDescription } = req.body;
  let { columns, languages, domain } = req.body;
  const file = req.file;

  try {
    console.log('Create project request:', { name, type, importToSite, generateOnly, generateMetaDescription, columns, languages, file: file?.path });

    if (typeof columns === 'string') columns = JSON.parse(columns);
    if (typeof languages === 'string') languages = JSON.parse(languages);
    if (typeof domain === 'string' && domain) domain = JSON.parse(domain);

    if (!name || !file || !columns || !languages || !languages.length) {
      if (file) await fs.unlink(file.path).catch(err => console.warn(`Failed to delete file ${file.path}:`, err.message));
      return res.status(400).json({ error: 'Name, file, columns, and at least one language are required' });
    }

    let requiredFields = type === 'csv' ? ['id', 'Title', 'Content', 'Permalink', 'Slug'] : ['imdbid', 'title', 'description'];
    if (!requiredFields.every(field => columns[field])) {
      if (file) await fs.unlink(file.path).catch(err => console.warn(`Failed to delete file ${file.path}:`, err.message));
      return res.status(400).json({ error: `All required columns (${requiredFields.join(', ')}) must be provided` });
    }

    let domainId = null;
    if (importToSite === 'true' || importToSite === true) {
      console.log('Validating WordPress data for import:', domain);
      if (!domain || !domain.url || !domain.login || !domain.apiPassword || !domain.isWordPress) {
        if (file) await fs.unlink(file.path).catch(err => console.warn(`Failed to delete file ${file.path}:`, err.message));
        return res.status(400).json({ error: 'Domain URL, login, API password, and WordPress confirmation are required for import' });
      }
      let normalizedUrl = domain.url.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
      if (!normalizedUrl.endsWith('/wp-json/wp/v2')) {
        normalizedUrl = normalizedUrl.replace(/\/$/, '') + '/wp-json/wp/v2';
      }
      const newDomain = new Domain({
        url: normalizedUrl,
        login: domain.login,
        apiPassword: domain.apiPassword,
        isWordPress: domain.isWordPress
      });
      await newDomain.save();
      domainId = newDomain._id;
    } else {
      console.log('No import required, skipping WordPress validation');
    }

    const workbook = XLSX.readFile(file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    const project = new Project({
      name,
      type: type || 'standard',
      filePath: file.path,
      columns,
      languages,
      totalRows: data.length,
      translations: [],
      translationCollections: [],
      importToSite: importToSite === 'true' || importToSite === true,
      generateOnly: generateOnly === 'true' || generateOnly === true,
      generateMetaDescription: generateMetaDescription === 'true' || generateMetaDescription === true,
      domainId,
      failedImports: []
    });
    
    await project.save();
    console.log('Project created:', project._id, 'type:', project.type, 'importToSite:', project.importToSite, 'generateOnly:', project.generateOnly, 'generateMetaDescription:', project.generateMetaDescription);
    broadcast({ type: 'PROJECT_CREATED', project: await Project.findById(project._id).populate('domainId').lean() });
    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error.message);
    if (file) await fs.unlink(file.path).catch(err => console.warn(`Failed to delete file ${file.path}:`, err.message));
    res.status(500).json({ error: 'Failed to create project' });
  }
};

exports.startTranslation = async (req, res) => {
  const { id } = req.params;
  let project;
  try {
    project = await Project.findById(id).populate('domainId').lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    console.log(`Starting ${project.generateOnly ? 'description generation' : 'translation'} for project ${id}`);
    await Project.updateOne({ _id: id }, { status: 'running' });
    if (!Array.isArray(project.translations)) {
      await Project.updateOne({ _id: id }, { translations: [] });
      console.log(`Initialized translations for project ${id}`);
    }
    if (!Array.isArray(project.translationCollections)) {
      await Project.updateOne({ _id: id }, { translationCollections: [] });
      console.log(`Initialized translationCollections for project ${id}`);
    }
    project = await Project.findById(id).populate('domainId').lean();
    setTranslationState(id, true);
    console.log(`Broadcasting PROJECT_UPDATED for project ${id}, status: running, project data:`, project);
    broadcast({ type: 'PROJECT_UPDATED', project });
    
    res.json(project);
    
    const workbook = XLSX.readFile(project.filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    let currentCollection = null;
    let collectionIndex = project.translationCollections.length + 1;
    let maxRowsPerCollection = 1000;
    let rowCountInCurrentCollection = 0;

    const isCSV = project.type === 'csv';
    const TranslationSchema = new mongoose.Schema({
      translations: [{
        id: String,
        imdbid: String,
        Permalink: String,
        Slug: String,
        original: {
          title: String,
          Title: String,
          description: String,
          Content: String
        },
        translated: [{
          language: String,
          title: String,
          Title: String,
          description: String,
          Content: String,
          custom_description: String
        }]
      }]
    });

    if (project.translationCollections.length > 0) {
      const lastCollectionName = project.translationCollections[project.translationCollections.length - 1];
      console.log(`Using existing collection: ${lastCollectionName}`);
      let LastCollection = collectionModels.get(lastCollectionName);
      if (!LastCollection) {
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
      
      if (rowCountInCurrentCollection >= maxRowsPerCollection) {
        const newCollectionName = `project_${id}_${collectionIndex}`;
        console.log(`Creating new collection: ${newCollectionName}`);
        let NewCollection = collectionModels.get(newCollectionName);
        if (!NewCollection) {
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
        project = await Project.findById(id).populate('domainId').lean();
        console.log(`Current translationCollections:`, project.translationCollections);
        rowCountInCurrentCollection = 0;
        collectionIndex++;
      }
      
      const row = data[i];
      const translations = [];
      
      for (const lang of project.languages) {
        try {
          if (isCSV) {
            let title, content, custom_description;
            if (project.generateOnly) {
              title = row[project.columns.Title];
              content = await translateText(row[project.columns.Title], lang, 'generateDescription', true);
              if (project.generateMetaDescription) {
                custom_description = await translateText(row[project.columns.Title], lang, 'metaDescription', true);
              }
            } else {
              title = await translateText(row[project.columns.Title], lang, 'title', true);
              content = row[project.columns.Content] === 'N/A' ?
                await translateText(row[project.columns.Title], lang, 'generateDescription', true) :
                await translateText(row[project.columns.Content], lang, 'description', true);
              if (project.generateMetaDescription) {
                custom_description = await translateText(row[project.columns.Title], lang, 'metaDescription', true);
              }
            }
            translations.push({ 
              language: lang, 
              Title: title, 
              Content: content,
              custom_description
            });
            
            if (project.importToSite && lang === project.languages[0]) {
              try {
                const post = await getPostByUrl(row[project.columns.Permalink], project.domainId);
                const updateData = { content };
                if (project.generateMetaDescription && custom_description) {
                  updateData.meta = { custom_description }; // Для плагина
                  // Добавляем meta description в yoast_head
                  const metaTag = `<meta name="description" content="${custom_description.replace(/"/g, '&quot;')}" />`;
                  updateData.yoast_head = metaTag + '\n' + (post.yoast_head || '');
                }
                await updatePost(post.id, updateData, project.domainId, post.type);
                await Project.updateOne(
                  { _id: id },
                  { $inc: { importedRows: 1 }, $set: { importProgress: ((project.importedRows + 1) / project.totalRows) * 100 } }
                );
                console.log(`Broadcasting PROJECT_UPDATED for project ${id}, import progress: ${project.importedRows + 1}/${project.totalRows}`);
                broadcast({ type: 'PROJECT_UPDATED', project: await Project.findById(id).populate('domainId').lean() });
              } catch (wpError) {
                console.warn(`Failed to import to WordPress for ${row[project.columns.Permalink]}:`, wpError.message);
                await Project.updateOne(
                  { _id: id },
                  { $push: { failedImports: { url: row[project.columns.Permalink], error: wpError.message } } }
                );
              }
            }
          } else {
            const title = await translateText(row[project.columns.title], lang, 'title');
            const description = await translateText(row[project.columns.description], lang, 'description');
            translations.push({ 
              language: lang, 
              title, 
              description 
            });
          }
        } catch (error) {
          if (error.message === 'OpenAI quota exceeded') {
            await Project.updateOne(
              { _id: id },
              { status: 'error', errorMessage: 'OpenAI quota exceeded. Please top up your account and resume.' }
            );
            setTranslationState(id, false);
            console.log(`Broadcasting PROJECT_UPDATED for project ${id}, status: error`);
            broadcast({ type: 'PROJECT_UPDATED', project: await Project.findById(id).populate('domainId').lean() });
            return;
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
        id: row[project.columns.id],
        imdbid: row[project.columns.imdbid],
        Permalink: row[project.columns.Permalink],
        Slug: row[project.columns.Slug],
        original: {
          title: row[project.columns.title],
          Title: row[project.columns.Title],
          description: row[project.columns.description],
          Content: row[project.columns.Content]
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
        { translatedRows: i + 1, progress: ((i + 1) / project.totalRows) * 100 }
      );
      project = await Project.findById(id).populate('domainId').lean();
      console.log(`Broadcasting PROJECT_UPDATED for project ${id}, progress: ${project.progress}%`);
      broadcast({ type: 'PROJECT_UPDATED', project });
      rowCountInCurrentCollection++;
    }
    
    if (getTranslationState(id)) {
      await Project.updateOne({ _id: id }, { status: 'completed' });
      setTranslationState(id, false);
      console.log(`Translation completed for project ${id}`);
      console.log(`Broadcasting PROJECT_UPDATED for project ${id}, status: completed`);
      broadcast({ type: 'PROJECT_UPDATED', project: await Project.findById(id).populate('domainId').lean() });
    }
  } catch (error) {
    console.error('Error in translation:', error.message);
    if (project) {
      await Project.updateOne(
        { _id: id },
        { status: 'error', errorMessage: error.message }
      );
      setTranslationState(id, false);
      console.log(`Broadcasting PROJECT_UPDATED for project ${id}, status: error`);
      broadcast({ type: 'PROJECT_UPDATED', project: await Project.findById(id).populate('domainId').lean() });
    }
  }
};

exports.cancelTranslation = async (req, res) => {
  const { id } = req.params;
  try {
    const project = await Project.findById(id).populate('domainId').lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    console.log(`Canceling translation for project ${id}`);
    await Project.updateOne({ _id: id }, { status: 'canceled' });
    setTranslationState(id, false);
    const updatedProject = await Project.findById(id).populate('domainId').lean();
    console.log(`Broadcasting PROJECT_UPDATED for project ${id}, status: canceled, project data:`, updatedProject);
    broadcast({ type: 'PROJECT_UPDATED', project: updatedProject });
    res.json(updatedProject);
  } catch (error) {
    console.error('Error canceling translation:', error.message);
    res.status(500).json({ error: 'Failed to cancel' });
  }
};

exports.resumeTranslation = async (req, res) => {
  const { id } = req.params;
  try {
    const project = await Project.findById(id).populate('domainId').lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    await Project.updateOne({ _id: id }, { status: 'running', errorMessage: '' });
    setTranslationState(id, true);
    console.log(`Broadcasting PROJECT_UPDATED for project ${id}, status: running`);
    broadcast({ type: 'PROJECT_UPDATED', project: await Project.findById(id).populate('domainId').lean() });
    
    exports.startTranslation(req, res);
  } catch (error) {
    console.error('Error resuming translation:', error.message);
    res.status(500).json({ error: 'Failed to resume' });
  }
};

exports.deleteProject = async (req, res) => {
  const { id } = req.params;
  try {
    const project = await Project.findById(id).populate('domainId').lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    console.log(`Deleting project ${id}, filePath: ${project.filePath}, translationCollections:`, project.translationCollections);
    
    const translationCollections = Array.isArray(project.translationCollections) ? project.translationCollections : [];
    for (const collectionName of translationCollections) {
      try {
        await mongoose.connection.dropCollection(collectionName);
        console.log(`Dropped collection ${collectionName}`);
      } catch (err) {
        console.warn(`Could not drop collection ${collectionName}: ${err.message}`);
      }
    }
    
    if (project.filePath) {
      try {
        const filePath = path.resolve(project.filePath);
        await fs.unlink(filePath);
        console.log(`Deleted file ${filePath}`);
      } catch (err) {
        console.warn(`Could not delete file ${project.filePath}:`, err.message);
      }
    }
    
    if (project.domainId) {
      try {
        await Domain.deleteOne({ _id: project.domainId });
        console.log(`Deleted domain ${project.domainId}`);
      } catch (err) {
        console.warn(`Could not delete domain ${project.domainId}:`, err.message);
      }
    }
    
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
    const project = await Project.findById(id).populate('domainId').lean();
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    console.log(`Downloading XLSX for project ${id}`);
    
    const workbook = XLSX.utils.book_new();
    const data = [];
    
    const isCSV = project.type === 'csv';
    
    if (project.translations && Array.isArray(project.translations)) {
      console.log(`Processing ${project.translations.length} translations from project.translations`);
      project.translations.forEach(t => {
        const row = isCSV ? {
          id: t.id,
          Title: t.translated[0]?.Title || t.original.Title,
          Content: t.translated[0]?.Content || t.original.Content,
          Permalink: t.Permalink,
          Slug: t.Slug,
          custom_description: t.translated[0]?.custom_description
        } : {
          imdbid: t.imdbid,
          title: t.translated[0]?.title || t.original.title,
          description: t.translated[0]?.description || t.original.description
        };
        data.push(row);
      });
    }
    
    const translationCollections = Array.isArray(project.translationCollections) ? project.translationCollections : [];
    console.log(`Processing ${translationCollections.length} additional collections`);
    for (const collectionName of translationCollections) {
      console.log(`Loading collection: ${collectionName}`);
      try {
        let Collection = collectionModels.get(collectionName);
        if (!Collection) {
          const TranslationSchema = new mongoose.Schema({
            translations: [{
              id: String,
              imdbid: String,
              Permalink: String,
              Slug: String,
              original: {
                title: String,
                Title: String,
                description: String,
                Content: String
              },
              translated: [{
                language: String,
                title: String,
                Title: String,
                description: String,
                Content: String,
                custom_description: String
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
              const row = isCSV ? {
                id: t.id,
                Title: t.translated[0]?.Title || t.original.Title,
                Content: t.translated[0]?.Content || t.original.Content,
                Permalink: t.Permalink,
                Slug: t.Slug,
                custom_description: t.translated[0]?.custom_description
              } : {
                imdbid: t.imdbid,
                title: t.translated[0]?.title || t.original.title,
                description: t.translated[0]?.description || t.original.description
              };
              data.push(row);
            });
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
    const worksheet = XLSX.utils.json_to_sheet(data, { header: isCSV ? ['id', 'Title', 'Content', 'Permalink', 'Slug', 'custom_description'] : ['imdbid', 'title', 'description'] });
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