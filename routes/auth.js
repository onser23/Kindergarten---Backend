const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Sadə admin autentifikasiya (real layihədə User modeli ilə genişləndirilməlidir)
// @route   POST /api/auth/login
// @desc    Admin login
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Demo admin məlumatları (real layihədə DB-dən yoxlanmalıdır)
    const adminUser = {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || '$2a$10$YourHashedPasswordHere' // bcrypt hash
    };

    if (username !== adminUser.username) {
      return res.status(401).json({
        success: false,
        message: 'İstifadəçi adı və ya şifrə yanlışdır'
      });
    }

    // Demo üçün sadə yoxlama (real layihədə bcrypt.compare istifadə edin)
    const isMatch = password === 'admin123'; // DEMO ONLY - real layihədə hash yoxlayın

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'İstifadəçi adı və ya şifrə yanlışdır'
      });
    }

    const token = jwt.sign(
      { id: 'admin_id', username: adminUser.username, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      success: true,
      message: 'Giriş uğurlu',
      token,
      user: {
        id: 'admin_id',
        username: adminUser.username,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Login xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

module.exports = router;
