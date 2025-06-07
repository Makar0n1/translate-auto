const mongoose = require('mongoose');

const TranslationSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  imdbid: { type: String, required: true },
  original: {
    title: { type: String, required: true },
    description: { type: String, required: true }
  },
  translated: [{
    language: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Translation', TranslationSchema);