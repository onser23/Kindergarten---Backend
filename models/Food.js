const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema({
  dryFood: {
    type: String,
    trim: true,
    maxlength: [200, 'Quru yemək 200 simvoldan çox ola bilməz'],
    default: ''
  },
  soup: {
    type: String,
    trim: true,
    maxlength: [200, 'Sulu yemək 200 simvoldan çox ola bilməz'],
    default: ''
  },
  drink: {
    type: String,
    trim: true,
    maxlength: [200, 'İçki 200 simvoldan çox ola bilməz'],
    default: ''
  },
  dessert: {
    type: String,
    trim: true,
    maxlength: [200, 'Şirniyyat 200 simvoldan çox ola bilməz'],
    default: ''
  },
  fruit: {
    type: String,
    trim: true,
    maxlength: [200, 'Meyvə 200 simvoldan çox ola bilməz'],
    default: ''
  },
  days: [{
    type: String,
    enum: ['Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə', 'Bazar'],
    required: [true, 'Ən azı bir gün seçilməlidir']
  }],
  time: {
    type: String,
    required: [true, 'Saat tələb olunur'],
    match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Düzgün saat formatı (HH:MM)']
  },
  displayId: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to update updatedAt
foodSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for search
foodSchema.index({ dryFood: 'text', soup: 'text', drink: 'text', dessert: 'text', fruit: 'text' });

module.exports = mongoose.model('Food', foodSchema);
