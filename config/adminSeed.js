require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const connectDB = require('./db');

const createDefaultAdmin = async () => {
  try {
    await connectDB();

    // Yoxla ki, admin varmı
    const existingAdmin = await Admin.findOne({ username: 'admin' });

    if (existingAdmin) {
      console.log('✅ Admin artıq mövcuddur:', existingAdmin.username);
      console.log('📧 Email:', existingAdmin.email || 'təyin edilməyib');
      console.log('👤 Ad:', existingAdmin.fullName);
      process.exit(0);
    }

    // Default admin yarat
    const admin = await Admin.create({
      username: 'admin',
      password: 'admin123',
      fullName: 'Administrator',
      email: 'admin@kindergarten.az',
      phone: '+994501234567',
      role: 'admin'
    });

    console.log('✅ Default admin yaradıldı!');
    console.log('👤 İstifadəçi adı: admin');
    console.log('🔑 Şifrə: admin123');
    console.log('📧 Email:', admin.email);
    process.exit(0);
  } catch (error) {
    console.error('❌ Admin seed xətası:', error);
    process.exit(1);
  }
};

createDefaultAdmin();
