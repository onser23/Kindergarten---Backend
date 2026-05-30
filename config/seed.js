require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Nanny = require('../models/Nanny');
const connectDB = require('./db');

const seedData = async () => {
  try {
    await connectDB();

    // Clear all collections
    await Admin.deleteMany({});
    await Nanny.deleteMany({});
    console.log('✅ Köhnə məlumatlar silindi');

    // Create default admin
    const admin = await Admin.create({
      username: 'admin',
      password: 'admin123',
      fullName: 'Sistem Administrator',
      email: 'admin@kindergarten.az',
      phone: '+994501234567'
    });
    console.log('✅ Default admin yaradıldı:', admin.username);

    // Create demo nannies
    const nannies = [
      {
        firstName: 'Fatimə',
        lastName: 'Əliyeva',
        fatherName: 'Asim',
        phone: '+994557897788',
        birthDate: new Date('1986-06-15')
      },
      {
        firstName: 'Samirə',
        lastName: 'Vəliyeva',
        fatherName: 'Faiz',
        phone: '+994705896633',
        birthDate: new Date('1986-06-17')
      },
      {
        firstName: 'Gülnarə',
        lastName: 'Məmmədova',
        fatherName: 'Rəşid',
        phone: '+994502345678',
        birthDate: new Date('1990-03-22')
      },
      {
        firstName: 'Aygün',
        lastName: 'Hüseynova',
        fatherName: 'Kamil',
        phone: '+994553456789',
        birthDate: new Date('1988-11-08')
      }
    ];

    await Nanny.insertMany(nannies);
    console.log(`✅ ${nannies.length} demo baxıcı əlavə edildi`);

    console.log('\n🎉 Seed tamamlandı!');
    console.log('🔑 Login: admin / admin123');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed xətası:', error);
    process.exit(1);
  }
};

seedData();
