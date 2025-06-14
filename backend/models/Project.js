const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  filePath: { type: String, required: true },
  type: { type: String, enum: ['standard', 'csv'], default: 'standard' },
  columns: {
    id: String,
    imdbid: String,
    title: String,
    Title: String,
    description: String,
    Content: String,
    Permalink: String,
    Slug: String
  },
  languages: [{ type: String, required: true }],
  status: { type: String, enum: ['idle', 'running', 'completed', 'error', 'canceled'], default: 'idle' },
  errorMessage: { type: String, default: '' },
  progress: { type: Number, default: 0 },
  totalRows: { type: Number, default: 0 },
  translatedRows: { type: Number, default: 0 },
  importToSite: { type: Boolean, default: false },
  domainId: { type: mongoose.Schema.Types.ObjectId, ref: 'Domain', default: null },
  importProgress: { type: Number, default: 0 },
  importedRows: { type: Number, default: 0 },
  failedImports: [{
    url: String,
    error: String
  }],
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
      Content: String
    }]
  }],
  translationCollections: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Project', ProjectSchema);