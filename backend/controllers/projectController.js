const mongoose = require('mongoose');
const XLSX = require('xlsx');
const multer = require('multer');
const { translateText } = require('../utils/openai');
const Project = require('../models/Project');
const TranslationsCache = require('../models/TranslationsCache');
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
      totalRows: data.length
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
  try {
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    project.status = 'running';
    await project.save();
    setTranslationState(id, true);
    broadcast({ type: 'PROJECT_UPDATED', project });
    
    const workbook = XLSX.readFile(project.filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    for (let i = project.translatedRows; i < data.length; i++) {
      if (!getTranslationState(id)) {
        console.log(`Translation stopped for project ${id} at row ${i}`);
        break;
      }
      
      const row = data[i];
      const translations = [];
      
      for (const lang of project.languages) {
        let title, description;
        
        let cache = await TranslationsCache.findOne({ text: row[project.columns.title], language: lang, type: 'title' });
        if (cache) {
          title = cache.translation;
        } else {
          try {
            title = await translateText(row[project.columns.title], lang, 'title');
            await TranslationsCache.create({ text: row[project.columns.title], language: lang, type: 'title', translation: title });
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
        
        cache = await TranslationsCache.findOne({ text: row[project.columns.description], language: lang, type: 'description' });
        if (cache) {
          description = cache.translation;
        } else {
          try {
            description = await translateText(row[project.columns.description], lang, 'description');
            await TranslationsCache.create({ text: row[project.columns.description], language: lang, type: 'description', translation: description });
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
        
        translations.push({ language: lang, title, description });
      }
      
      project.translations.push({
        imdbid: row[project.columns.imdbid],
        original: {
          title: row[project.columns.title],
          description: row[project.columns.description]
        },
        translated: translations
      });
      
      project.translatedRows = i + 1;
      project.progress = project.translatedRows / data.length * 100;
      await project.save();
      broadcast({ type: 'PROJECT_UPDATED', project });
    }
    
    if (getTranslationState(id)) {
      project.status = 'completed';
      await project.save();
      setTranslationState(id, false);
      broadcast({ type: 'PROJECT_UPDATED', project });
    }
    
    res.json(project);
  } catch (error) {
    console.error('Error in translation:', error.message);
    project.status = 'error';
    project.errorMessage = error.message;
    await project.save();
    setTranslationState(id, false);
    broadcast({ type: 'PROJECT_UPDATED', project });
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