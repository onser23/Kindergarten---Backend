const mongoose = require('mongoose');

const nannySchema = new mongoose.Schema({
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

// Virtual field for formatted ID
nannySchema.virtual('formattedId').get(function() {
  return String(this._id).slice(-6).toUpperCase().padStart(3, '0');
});

// Virtual field for full name
nannySchema.virtual('fullName').get(function() {
  return `${this.lastName} ${this.firstName} ${this.fatherName}`;
});

// Pre-save middleware to update updatedAt
nannySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for search
nannySchema.index({ firstName: 'text', lastName: 'text', fatherName: 'text' });

module.exports = mongoose.model('Nanny', nannySchema);
