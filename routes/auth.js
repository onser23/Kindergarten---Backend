const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// @route   POST /api/auth/login
// @desc    Admin login
// @access  Public
router.post('/login', [
  body('username').trim().notEmpty().withMessage('İstifadəçi adı tələb olunur'),
  body('password').notEmpty().withMessage('Şifrə tələb olunur')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validasiya xətası',
        errors: errors.array()
      });
    }

    const { username, password } = req.body;

    // Admini tap (şifrəni də gətir)
    const admin = await Admin.findOne({ 
      username: username.toLowerCase(),
      isActive: true 
    }).select('+password');

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'İstifadəçi adı və ya şifrə yanlışdır'
      });
    }

    // Şifrəni yoxla
    const isMatch = await admin.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'İstifadəçi adı və ya şifrə yanlışdır'
      });
    }

    // Son giriş vaxtını yenilə
    admin.lastLogin = new Date();
    await admin.save();

    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      success: true,
      message: 'Giriş uğurlu',
      token,
      user: {
        id: admin._id,
        username: admin.username,
        fullName: admin.fullName,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        initials: admin.initials
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

// @route   GET /api/auth/me
// @desc    Cari admin məlumatlarını gətir
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select('-password');
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin tapılmadı'
      });
    }

    res.json({
      success: true,
      data: admin
    });
  } catch (error) {
    console.error('Me xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Admin şifrəsini dəyiş
// @access  Private
router.put('/change-password', [
  auth,
  body('currentPassword').notEmpty().withMessage('Cari şifrə tələb olunur'),
  body('newPassword')
    .isLength({ min: 6 }).withMessage('Yeni şifrə ən az 6 simvol olmalıdır')
    .notEmpty().withMessage('Yeni şifrə tələb olunur'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Şifrələr uyğun gəlmir');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validasiya xətası',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Admini tap (şifrəni də gətir)
    const admin = await Admin.findById(req.user.id).select('+password');
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin tapılmadı'
      });
    }

    // Cari şifrəni yoxla
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Cari şifrə yanlışdır'
      });
    }

    // Yeni şifrəni təyin et (pre-save hash edəcək)
    admin.password = newPassword;
    await admin.save();

    res.json({
      success: true,
      message: 'Şifrə uğurla dəyişdirildi'
    });
  } catch (error) {
    console.error('Change password xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Admin profilini yenilə
// @access  Private
router.put('/profile', [
  auth,
  body('fullName').optional().trim().notEmpty().withMessage('Ad boş ola bilməz'),
  body('email').optional().trim().isEmail().withMessage('Düzgün email daxil edin'),
  body('phone').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validasiya xətası',
        errors: errors.array()
      });
    }

    const { fullName, email, phone } = req.body;

    const admin = await Admin.findByIdAndUpdate(
      req.user.id,
      { fullName, email, phone, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).select('-password');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin tapılmadı'
      });
    }

    res.json({
      success: true,
      message: 'Profil uğurla yeniləndi',
      data: admin
    });
  } catch (error) {
    console.error('Profile update xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

module.exports = router;
