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
  errorMessage: { type: String, default: '' },
  progress: { type: Number, default: 0 },
  totalRows: { type: Number, default: 0 },
  translatedRows: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Project', ProjectSchema);