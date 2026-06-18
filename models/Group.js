const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Qrup adı tələb olunur'],
    trim: true,
    maxlength: [100, 'Qrup adı 100 simvoldan çox ola bilməz']
  },
  departments: [{
    type: String,
    enum: ['Rus dili', 'İngilis dili', 'Azərbaycan dili'],
    required: [true, 'Ən azı bir bölmə seçilməlidir']
  }],
  teachers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: [true, 'Ən azı bir müəllim seçilməlidir']
  }],
  nannies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Nanny',
    required: [true, 'Ən azı bir baxıcı seçilməlidir']
  }],
  ageRange: {
    type: String,
    enum: ['1-2', '2-3', '3-4', '4-5', '5-6'],
    required: [true, 'Yaş aralığı seçilməlidir'],
    default: '1-2'
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
groupSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for search
groupSchema.index({ name: 'text' });

module.exports = mongoose.model('Group', groupSchema);
