const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Xidmət adı tələb olunur'],
    trim: true,
    maxlength: [200, 'Xidmət adı 200 simvoldan çox ola bilməz']
  },
  days: [{
    type: String,
    enum: ['Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə', 'Bazar'],
    required: [true, 'Ən azı bir gün seçilməlidir']
  }],
  startTime: {
    type: String,
    required: [true, 'Başlama saatı tələb olunur'],
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
serviceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for search
serviceSchema.index({ name: 'text' });

module.exports = mongoose.model('Service', serviceSchema);
