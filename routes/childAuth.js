const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Child = require('../models/Child');
const { body, validationResult } = require('express-validator');

// @route POST /api/child-auth/login
// @desc Uşaq login (email + password)
// @access Public
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Email daxil edin').isEmail().withMessage('Düzgün email formatı daxil edin'),
  body('password').notEmpty().withMessage('Şifrə daxil edin')
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

    // Find child by username (email)
    const child = await Child.findOne({ username: username.toLowerCase(), isActive: true })
      .populate('package', 'name price days duration')
      .populate({
        path: 'group',
        select: 'name departments ageRange',
        populate: [
          { path: 'teachers', select: 'firstName lastName fatherName phone' },
          { path: 'nannies', select: 'firstName lastName fatherName phone' }
        ]
      });

    if (!child) {
      return res.status(401).json({
        success: false,
        message: 'Email və ya şifrə yanlışdır'
      });
    }

    // Check password
    const isMatch = await child.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email və ya şifrə yanlışdır'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: child._id,
        username: child.username,
        role: 'child'
      },
      process.env.JWT_SECRET || 'kindergarten_secret_key',
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: 'Uğurla daxil oldunuz',
      data: {
        token,
        child: {
          _id: child._id,
          firstName: child.firstName,
          lastName: child.lastName,
          fullName: `${child.lastName} ${child.firstName}`,
          birthDate: child.birthDate,
          fatherName: child.fatherName,
          motherName: child.motherName,
          phone1: child.phone1,
          phone2: child.phone2,
          username: child.username,
          package: child.package,
          group: child.group,
          startDate: child.startDate,
          discount: child.discount,
          extraPrice: child.extraPrice,
          notes: child.notes,
          createdAt: child.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Uşaq login xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route GET /api/child-auth/me
// @desc Cari uşağın məlumatlarını gətir (token ilə)
// @access Private (Child only)
router.get('/me', async (req, res) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token tapılmadı'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'kindergarten_secret_key');

    if (decoded.role !== 'child') {
      return res.status(403).json({
        success: false,
        message: 'Bu əməliyyat üçün icazəniz yoxdur'
      });
    }

    // Find child and populate all relations
    const child = await Child.findById(decoded.id)
      .populate('package', 'name price days duration')
      .populate({
        path: 'group',
        select: 'name departments ageRange',
        populate: [
          { path: 'teachers', select: 'firstName lastName fatherName phone' },
          { path: 'nannies', select: 'firstName lastName fatherName phone' }
        ]
      });

    if (!child || !child.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Uşaq tapılmadı'
      });
    }

    res.json({
      success: true,
      data: {
        child: {
          _id: child._id,
          firstName: child.firstName,
          lastName: child.lastName,
          fullName: `${child.lastName} ${child.firstName}`,
          birthDate: child.birthDate,
          fatherName: child.fatherName,
          motherName: child.motherName,
          phone1: child.phone1,
          phone2: child.phone2,
          username: child.username,
          package: child.package,
          group: child.group,
          startDate: child.startDate,
          discount: child.discount,
          extraPrice: child.extraPrice,
          notes: child.notes,
          createdAt: child.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Uşaq məlumatları xətası:', error);
    res.status(401).json({
      success: false,
      message: 'Yanlış və ya vaxtı bitmiş token'
    });
  }
});

// @route PUT /api/child-auth/change-password
// @desc Uşaq şifrəsini dəyiş
// @access Private (Child only)
router.put('/change-password', [
  body('currentPassword').notEmpty().withMessage('Cari şifrə daxil edin'),
  body('newPassword').isLength({ min: 6 }).withMessage('Yeni şifrə ən az 6 simvol olmalıdır')
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

    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token tapılmadı'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'kindergarten_secret_key');

    if (decoded.role !== 'child') {
      return res.status(403).json({
        success: false,
        message: 'Bu əməliyyat üçün icazəniz yoxdur'
      });
    }

    const { currentPassword, newPassword } = req.body;

    const child = await Child.findById(decoded.id);
    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Uşaq tapılmadı'
      });
    }

    const isMatch = await child.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Cari şifrə yanlışdır'
      });
    }

    child.password = newPassword;
    await child.save();

    res.json({
      success: true,
      message: 'Şifrə uğurla dəyişdirildi'
    });
  } catch (error) {
    console.error('Şifrə dəyişmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

module.exports = router;
