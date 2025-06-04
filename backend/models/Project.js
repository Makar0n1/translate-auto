const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  filePath: { type: String, required: true },
  columns: {
    imdbid: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true }
  },
  languages: [{ type: String, required: true }],
  status: { type: String, enum: ['idle', 'running', 'completed', 'error', 'canceled'], default: 'idle' },
  progress: { type: Number, default: 0 },
  totalRows: { type: Number, default: 0 },
  translatedRows: { type: Number, default: 0 },
  translations: [{
    imdbid: String,
    original: { title: String, description: String },
    translated: [{
      language: String,
      title: String,
      description: String
    }]
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Project', ProjectSchema);