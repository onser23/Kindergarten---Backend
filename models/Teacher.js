const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Ad tələb olunur'],
    trim: true,
    maxlength: [50, 'Ad 50 simvoldan çox ola bilməz']
  },
  lastName: {
    type: String,
    required: [true, 'Soyad tələb olunur'],
    trim: true,
    maxlength: [50, 'Soyad 50 simvoldan çox ola bilməz']
  },
  fatherName: {
    type: String,
    required: [true, 'Ata adı tələb olunur'],
    trim: true,
    maxlength: [50, 'Ata adı 50 simvoldan çox ola bilməz']
  },
  departments: [{
    type: String,
    enum: ['Rus dili', 'İngilis dili', 'Azərbaycan dili'],
    required: [true, 'Ən azı bir bölmə seçilməlidir']
  }],
  phone: {
    type: String,
    required: [true, 'Telefon nömrəsi tələb olunur'],
    trim: true,
    match: [/^\+994[0-9]{9}$/, 'Düzgün Azərbaycan telefon nömrəsi daxil edin (məs: +994551234567)']
  },
  birthDate: {
    type: Date,
    required: [true, 'Doğum tarixi tələb olunur']
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

// Virtual field for full name
teacherSchema.virtual('fullName').get(function() {
  return `${this.lastName} ${this.firstName} ${this.fatherName}`;
});

// Pre-save middleware to update updatedAt
teacherSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for search
teacherSchema.index({ firstName: 'text', lastName: 'text', fatherName: 'text' });

module.exports = mongoose.model('Teacher', teacherSchema);
