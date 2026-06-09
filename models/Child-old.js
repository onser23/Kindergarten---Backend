const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
  username: {
    type: String,
    required: [true, 'İstifadəçi adı tələb olunur'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Düzgün email formatı daxil edin']
  },
  password: {
    type: String,
    required: [true, 'Şifrə tələb olunur'],
    minlength: [6, 'Şifrə ən az 6 simvol olmalıdır']
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

// Hash password before saving
childSchema.pre('save', async function(next) {
  this.updatedAt = Date.now();
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Hash password before updating
childSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  if (update.password) {
    update.password = await bcrypt.hash(update.password, 10);
  }
  update.updatedAt = Date.now();
  next();
});

// Compare password method
childSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Index for search
childSchema.index({ firstName: 'text', lastName: 'text', fatherName: 'text', motherName: 'text', username: 'text' });

module.exports = mongoose.model('Child', childSchema);
