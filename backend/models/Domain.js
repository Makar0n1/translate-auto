const mongoose = require('mongoose');

const DomainSchema = new mongoose.Schema({
  url: { type: String, required: true },
  login: { type: String, required: true },
  apiPassword: { type: String, required: true },
  isWordPress: { type: Boolean, required: true, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Domain', DomainSchema);