const mongoose = require('mongoose');

const DURATIONS = ['Bir aylıq tam gün', 'Bir aylıq yarım gün', 'Həftəlik tam gün', 'Həftəlik yarım gün', 'Günlük'];

const packageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Paket adı tələb olunur'],
    trim: true,
    maxlength: [200, 'Paket adı 200 simvoldan çox ola bilməz']
  },
  services: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    default: []
  }],
  lessons: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    default: []
  }],
  duration: {
    type: String,
    enum: DURATIONS,
    required: [true, 'Müddət seçilməlidir'],
    default: 'Bir aylıq tam gün'
  },
  days: {
    type: Number,
    required: [true, 'Gün sayı tələb olunur'],
    min: [1, 'Gün sayı ən az 1 olmalıdır']
  },
  price: {
    type: Number,
    required: [true, 'Qiymət tələb olunur'],
    min: [0, 'Qiymət 0-dan böyük olmalıdır']
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
packageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for search
packageSchema.index({ name: 'text' });

module.exports = mongoose.model('Package', packageSchema);
