// src/models/Drink.js
const mongoose = require('mongoose');

const drinkSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    required: true,
    enum: ['cerveza', 'gaseosa', 'agua', 'vino', 'otros']
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { collection: 'drinks' });

module.exports = mongoose.model('Drink', drinkSchema);