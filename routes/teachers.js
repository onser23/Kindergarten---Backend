const express = require('express');
const router = express.Router();
const Teacher = require('../models/Teacher');
const { body, validationResult } = require('express-validator');
const { makeStatusHandler } = require('./shared/statusController');
const { parsePagination, buildPaginatedResponse } = require('../utils/pagination');
const { getNextDisplayId } = require('../utils/idGenerator');

// @route   GET /api/teachers
// @desc    Bütün müəllimləri gətir (axtarış ilə)
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
          { phone: searchRegex },
          { departments: searchRegex }
        ]
      };
    }

    const [total, teachers] = await Promise.all([
      Teacher.countDocuments(query),
      Teacher.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)
    ]);

    res.json(buildPaginatedResponse(teachers, total, page, limit));
  } catch (error) {
    console.error('Müəllimləri gətirmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   POST /api/teachers
// @desc    Yeni müəllim əlavə et
// @access  Private
router.post('/', [
  body('firstName').trim().notEmpty().withMessage('Ad tələb olunur'),
  body('lastName').trim().notEmpty().withMessage('Soyad tələb olunur'),
  body('fatherName').trim().notEmpty().withMessage('Ata adı tələb olunur'),
  body('departments').isArray({ min: 1 }).withMessage('Ən azı bir bölmə seçilməlidir'),
  body('departments.*').isIn(['Rus dili', 'İngilis dili', 'Azərbaycan dili']).withMessage('Yanlış bölmə seçimi'),
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

    const { firstName, lastName, fatherName, departments, phone, birthDate } = req.body;

    // Telefon nömrəsinin unikallığını yoxla
    const existingTeacher = await Teacher.findOne({ phone });
    if (existingTeacher) {
      return res.status(400).json({
        success: false,
        message: 'Bu telefon nömrəsi ilə müəllim artıq mövcuddur'
      });
    }

    const displayId = await getNextDisplayId('Teacher');

    const teacher = await Teacher.create({
      firstName,
      lastName,
      fatherName,
      departments,
      phone,
      birthDate,
      displayId
    });

    res.status(201).json({
      success: true,
      message: 'Müəllim uğurla əlavə edildi',
      data: teacher
    });
  } catch (error) {
    console.error('Müəllim əlavə etmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   PUT /api/teachers/:id
// @desc    Müəllimi yenilə
// @access  Private
router.put('/:id', [
  body('firstName').optional().trim().notEmpty().withMessage('Ad boş ola bilməz'),
  body('lastName').optional().trim().notEmpty().withMessage('Soyad boş ola bilməz'),
  body('fatherName').optional().trim().notEmpty().withMessage('Ata adı boş ola bilməz'),
  body('departments').optional().isArray({ min: 1 }).withMessage('Ən azı bir bölmə seçilməlidir'),
  body('departments.*').optional().isIn(['Rus dili', 'İngilis dili', 'Azərbaycan dili']).withMessage('Yanlış bölmə seçimi'),
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

    const { firstName, lastName, fatherName, departments, phone, birthDate } = req.body;

    // Əgər telefon dəyişibsə, unikallığını yoxla
    if (phone) {
      const existingTeacher = await Teacher.findOne({ phone, _id: { $ne: req.params.id } });
      if (existingTeacher) {
        return res.status(400).json({
          success: false,
          message: 'Bu telefon nömrəsi ilə müəllim artıq mövcuddur'
        });
      }
    }

    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      { firstName, lastName, fatherName, departments, phone, birthDate },
      { new: true, runValidators: true }
    );

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Müəllim tapılmadı'
      });
    }

    res.json({
      success: true,
      message: 'Müəllim uğurla yeniləndi',
      data: teacher
    });
  } catch (error) {
    console.error('Müəllim yeniləmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   PATCH /api/teachers/:id/status
// @desc    Müəllimi aktivləşdir / passivləşdir (istifadə yoxlaması ilə)
// @access  Private
router.patch('/:id/status', makeStatusHandler('teacher'));

module.exports = router;
