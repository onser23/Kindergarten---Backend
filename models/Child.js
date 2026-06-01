const mongoose = require('mongoose');

const childSchema = new mongoose.Schema({
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
  birthDate: {
    type: Date,
    required: [true, 'Doğum tarixi tələb olunur']
  },
  fatherName: {
    type: String,
    trim: true,
    maxlength: [50, 'Ata adı 50 simvoldan çox ola bilməz'],
    default: ''
  },
  motherName: {
    type: String,
    trim: true,
    maxlength: [50, 'Ana adı 50 simvoldan çox ola bilməz'],
    default: ''
  },
  phone1: {
    type: String,
    required: [true, 'Telefon 1 tələb olunur'],
    trim: true,
    match: [/^\+994[0-9]{9}$/, 'Düzgün Azərbaycan telefon nömrəsi daxil edin (məs: +994551234567)']
  },
  phone2: {
    type: String,
    trim: true,
    match: [/^\+994[0-9]{9}$/, 'Düzgün Azərbaycan telefon nömrəsi daxil edin'],
    default: ''
  },
  package: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: [true, 'Paket seçilməlidir']
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: [true, 'Qrup seçilməlidir']
  },
  startDate: {
    type: Date,
    required: [true, 'Başlama tarixi tələb olunur']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Endirim 0-dan kiçik ola bilməz']
  },
  extraPrice: {
    type: Number,
    default: 0,
    min: [0, 'Əlavə qiymət 0-dan kiçik ola bilməz']
  },
  nannies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Nanny',
    default: []
  }],
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Qeyd 500 simvoldan çox ola bilməz'],
    default: ''
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
childSchema.virtual('fullName').get(function() {
  return `${this.lastName} ${this.firstName}`;
});

// Virtual field for parent name (father first, then mother)
childSchema.virtual('parentName').get(function() {
  return this.fatherName || this.motherName || '-';
});

// Virtual field for payment calculation
childSchema.virtual('payment').get(function() {
  const pkgPrice = this.package?.price || 0;
  return pkgPrice - (this.discount || 0) + (this.extraPrice || 0);
});

// Pre-save middleware to update updatedAt
childSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for search
childSchema.index({ firstName: 'text', lastName: 'text', fatherName: 'text', motherName: 'text' });

module.exports = mongoose.model('Child', childSchema);
