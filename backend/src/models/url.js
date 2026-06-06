const mongoose = require('mongoose');

const urlSchema = new mongoose.Schema({
  shortID: { type: String, required: true, unique: true },
  redirectURL: { type: String, required: true },
  clickCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Url', urlSchema);
