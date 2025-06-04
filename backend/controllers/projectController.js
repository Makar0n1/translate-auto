const mongoose = require('mongoose');
const XLSX = require('xlsx');
const multer = require('multer');
const { translateText } = require('../utils/openai');
const Project = require('../models/Project');
const { broadcast } = require('../utils/websocket');

const upload = multer({ dest: 'uploads/' });

exports.createProject = async (req, res) => {
  const { name, columns, languages } = req.body;
  const file = req.file;
  try {
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
    broadcast({ type: 'PROJECT_CREATED', project });
    res.status(201).json(project);
  } catch (error) {
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
    broadcast({ type: 'PROJECT_UPDATED', project });
    
    const workbook = XLSX.readFile(project.filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    for (let i = project.translatedRows; i < data.length; i++) {
      if (project.status !== 'running') break;
      
      const row = data[i];
      const translations = [];
      
      for (const lang of project.languages) {
        const title = await translateText(row[project.columns.title], lang, 'title');
        const description = await translateText(row[project.columns.description], lang, 'description');
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
      project.progress = (i + 1) / data.length * 100;
      await project.save();
      broadcast({ type: 'PROJECT_UPDATED', project });
    }
    
    if (project.status === 'running') {
      project.status = 'completed';
      await project.save();
      broadcast({ type: 'PROJECT_UPDATED', project });
    }
    
    res.json(project);
  } catch (error) {
    project.status = 'error';
    await project.save();
    broadcast({ type: 'PROJECT_UPDATED', project });
    res.status(500).json({ error: 'Translation failed' });
  }
};

exports.cancelTranslation = async (req, res) => {
  const { id } = req.params;
  try {
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    project.status = 'canceled';
    await project.save();
    broadcast({ type: 'PROJECT_UPDATED', project });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel' });
  }
};

exports.resumeTranslation = async (req, res) => {
  const { id } = req.params;
  try {
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    project.status = 'running';
    await project.save();
    broadcast({ type: 'PROJECT_UPDATED', project });
    
    // Resume from last translated row
    exports.startTranslation(req, res);
  } catch (error) {
    res.status(500).json({ error: 'Failed to resume' });
  }
};

exports.deleteProject = async (req, res) => {
  const { id } = req.params;
  try {
    await Project.findByIdAndDelete(id);
    broadcast({ type: 'PROJECT_DELETED', id });
    res.json({ message: 'Project deleted' });
  } catch (error) {
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
    res.status(500).json({ error: 'Failed to generate XLSX' });
  }
};