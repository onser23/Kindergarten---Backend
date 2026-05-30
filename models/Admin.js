const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'İstifadəçi adı tələb olunur'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'İstifadəçi adı ən az 3 simvol olmalıdır'],
    maxlength: [30, 'İstifadəçi adı 30 simvoldan çox ola bilməz']
  },
  password: {
    type: String,
    required: [true, 'Şifrə tələb olunur'],
    minlength: [6, 'Şifrə ən az 6 simvol olmalıdır'],
    select: false // Default olaraq password gəlməsin
  },
  fullName: {
    type: String,
    default: 'Administrator',
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Düzgün email formatı daxil edin']
  },
  phone: {
    type: String,
    trim: true
  },
  avatar: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['admin', 'superadmin'],
    default: 'admin'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
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

// Pre-save: şifrəni hash et
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.updatedAt = Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-update: şifrəni hash et
adminSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  if (update.password) {
    try {
      const salt = await bcrypt.genSalt(12);
      update.password = await bcrypt.hash(update.password, salt);
      update.updatedAt = Date.now();
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Şifrəni müqayisə et metodu
adminSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual: adın baş hərfini göstər
adminSchema.virtual('initials').get(function() {
  return this.fullName ? this.fullName.charAt(0).toUpperCase() : this.username.charAt(0).toUpperCase();
});

module.exports = mongoose.model('Admin', adminSchema);
