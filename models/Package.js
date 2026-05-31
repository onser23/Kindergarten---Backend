const mongoose = require('mongoose');

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
    required: [true, 'Ən azı bir xidmət seçilməlidir']
  }],
  lessons: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: [true, 'Ən azı bir dərs seçilməlidir']
  }],
  duration: {
    type: String,
    enum: ['Bir aylıq tam gün', 'Bir aylıq yarım gün', 'Həftəlik tam gün', 'Həftəlik yarım gün', 'Günlük'],
    required: [true, 'Müddət seçilməlidir']
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
