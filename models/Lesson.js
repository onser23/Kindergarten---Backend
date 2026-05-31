const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Dərs adı tələb olunur'],
    trim: true,
    maxlength: [200, 'Dərs adı 200 simvoldan çox ola bilməz']
  },
  groups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: [true, 'Ən azı bir qrup seçilməlidir']
  }],
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
  duration: {
    type: Number,
    required: [true, 'Müddət tələb olunur'],
    min: [1, 'Müddət ən az 1 dəqiqə olmalıdır'],
    max: [300, 'Müddət 300 dəqiqədən çox ola bilməz']
  },
  teachers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: [true, 'Ən azı bir müəllim seçilməlidir']
  }],
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
lessonSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for search
lessonSchema.index({ name: 'text' });

module.exports = mongoose.model('Lesson', lessonSchema);
