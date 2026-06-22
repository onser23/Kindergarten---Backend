const express = require('express');
const router = express.Router();
const Nanny = require('../models/Nanny');
const { body, validationResult } = require('express-validator');
const { makeStatusHandler } = require('./shared/statusController');
const { parsePagination, buildPaginatedResponse } = require('../utils/pagination');

// @route   GET /api/nannies
// @desc    Bütün baxıcıları gətir (axtarış ilə)
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const { page, limit, skip } = parsePagination(req.query, 20);
    let query = {};

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query = {
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { fatherName: searchRegex },
          { phone: searchRegex }
        ]
      };
    }

    const [total, nannies] = await Promise.all([
      Nanny.countDocuments(query),
      Nanny.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)
    ]);

    res.json(buildPaginatedResponse(nannies, total, page, limit));
  } catch (error) {
    console.error('Baxıcıları gətirmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   POST /api/nannies
// @desc    Yeni baxıcı əlavə et
// @access  Private
router.post('/', [
  body('firstName').trim().notEmpty().withMessage('Ad tələb olunur'),
  body('lastName').trim().notEmpty().withMessage('Soyad tələb olunur'),
  body('fatherName').trim().notEmpty().withMessage('Ata adı tələb olunur'),
  body('phone').matches(/^\+994[0-9]{9}$/).withMessage('Düzgün telefon nömrəsi daxil edin (məs: +994551234567)'),
  body('birthDate').isISO8601().withMessage('Düzgün tarix formatı')
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

    const { firstName, lastName, fatherName, phone, birthDate } = req.body;

    // Telefon nömrəsinin unikallığını yoxla
    const existingNanny = await Nanny.findOne({ phone });
    if (existingNanny) {
      return res.status(400).json({
        success: false,
        message: 'Bu telefon nömrəsi ilə baxıcı artıq mövcuddur'
      });
    }

    const nanny = await Nanny.create({
      firstName,
      lastName,
      fatherName,
      phone,
      birthDate
    });

    res.status(201).json({
      success: true,
      message: 'Baxıcı uğurla əlavə edildi',
      data: nanny
    });
  } catch (error) {
    console.error('Baxıcı əlavə etmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   PUT /api/nannies/:id
// @desc    Baxıcını yenilə
// @access  Private
router.put('/:id', [
  body('firstName').optional().trim().notEmpty().withMessage('Ad boş ola bilməz'),
  body('lastName').optional().trim().notEmpty().withMessage('Soyad boş ola bilməz'),
  body('fatherName').optional().trim().notEmpty().withMessage('Ata adı boş ola bilməz'),
  body('phone').optional().matches(/^\+994[0-9]{9}$/).withMessage('Düzgün telefon nömrəsi daxil edin'),
  body('birthDate').optional().isISO8601().withMessage('Düzgün tarix formatı')
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

    const { firstName, lastName, fatherName, phone, birthDate } = req.body;

    // Əgər telefon dəyişibsə, unikallığını yoxla
    if (phone) {
      const existingNanny = await Nanny.findOne({ phone, _id: { $ne: req.params.id } });
      if (existingNanny) {
        return res.status(400).json({
          success: false,
          message: 'Bu telefon nömrəsi ilə baxıcı artıq mövcuddur'
        });
      }
    }

    const nanny = await Nanny.findByIdAndUpdate(
      req.params.id,
      { firstName, lastName, fatherName, phone, birthDate },
      { new: true, runValidators: true }
    );

    if (!nanny) {
      return res.status(404).json({
        success: false,
        message: 'Baxıcı tapılmadı'
      });
    }

    res.json({
      success: true,
      message: 'Baxıcı uğurla yeniləndi',
      data: nanny
    });
  } catch (error) {
    console.error('Baxıcı yeniləmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   PATCH /api/nannies/:id/status
// @desc    Baxıcını aktivləşdir / passivləşdir (istifadə yoxlaması ilə)
// @access  Private
router.patch('/:id/status', makeStatusHandler('nanny'));

module.exports = router;
