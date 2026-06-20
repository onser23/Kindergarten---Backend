const express = require('express');
const router = express.Router();
const Lesson = require('../models/Lesson');
const Group = require('../models/Group');
const Teacher = require('../models/Teacher');
const { body, validationResult } = require('express-validator');
const { makeStatusHandler } = require('./shared/statusController');

// @route GET /api/lessons
// @desc Bütün dərsləri gətir (axtarış ilə) - populate ilə qrup və müəllim adları
// @access Private
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = { isActive: true };

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query = {
        isActive: true,
        $or: [
          { name: searchRegex },
          { startTime: searchRegex },
          { days: searchRegex }
        ]
      };
    }

    const lessons = await Lesson.find(query)
      .populate('groups', 'name')
      .populate('teachers', 'firstName lastName fatherName')
      .sort({ startTime: 1 });

    res.json({
      success: true,
      count: lessons.length,
      data: lessons
    });
  } catch (error) {
    console.error('Dərsləri gətirmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route GET /api/lessons/form-data
// @desc Dərs formu üçün qrup və müəllim siyahısını gətir
// @access Private
router.get('/form-data', async (req, res) => {
  try {
    const [groups, teachers] = await Promise.all([
      Group.find({ isActive: true }).select('_id name').sort({ name: 1 }),
      Teacher.find({ isActive: true }).select('_id firstName lastName fatherName').sort({ lastName: 1 })
    ]);

    res.json({
      success: true,
      data: {
        groups: groups.map(g => ({
          _id: g._id,
          name: g.name
        })),
        teachers: teachers.map(t => ({
          _id: t._id,
          fullName: `${t.lastName} ${t.firstName} ${t.fatherName}`
        }))
      }
    });
  } catch (error) {
    console.error('Form data xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route POST /api/lessons
// @desc Yeni dərs əlavə et
// @access Private
router.post('/', [
  body('name').trim().notEmpty().withMessage('Dərs adı tələb olunur'),
  body('groups').isArray({ min: 1 }).withMessage('Ən azı bir qrup seçilməlidir'),
  body('days').isArray({ min: 1 }).withMessage('Ən azı bir gün seçilməlidir'),
  body('days.*').isIn(['Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə', 'Bazar']).withMessage('Yanlış gün seçimi'),
  body('startTime').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Düzgün saat formatı (HH:MM)'),
  body('duration').isInt({ min: 1, max: 300 }).withMessage('Müddət 1-300 dəqiqə arası olmalıdır'),
  body('teachers').isArray({ min: 1 }).withMessage('Ən azı bir müəllim seçilməlidir')
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

    const { name, groups, days, startTime, duration, teachers } = req.body;

    const lesson = await Lesson.create({
      name: name.trim(),
      groups,
      days,
      startTime,
      duration,
      teachers
    });

    // Populate edilmiş halda qaytar
    const populatedLesson = await Lesson.findById(lesson._id)
      .populate('groups', 'name')
      .populate('teachers', 'firstName lastName fatherName');

    res.status(201).json({
      success: true,
      message: 'Dərs uğurla əlavə edildi',
      data: populatedLesson
    });
  } catch (error) {
    console.error('Dərs əlavə etmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route PUT /api/lessons/:id
// @desc Dərsi yenilə
// @access Private
router.put('/:id', [
  body('name').optional().trim().notEmpty().withMessage('Dərs adı boş ola bilməz'),
  body('groups').optional().isArray({ min: 1 }).withMessage('Ən azı bir qrup seçilməlidir'),
  body('days').optional().isArray({ min: 1 }).withMessage('Ən azı bir gün seçilməlidir'),
  body('days.*').optional().isIn(['Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə', 'Bazar']).withMessage('Yanlış gün seçimi'),
  body('startTime').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Düzgün saat formatı (HH:MM)'),
  body('duration').optional().isInt({ min: 1, max: 300 }).withMessage('Müddət 1-300 dəqiqə arası olmalıdır'),
  body('teachers').optional().isArray({ min: 1 }).withMessage('Ən azı bir müəllim seçilməlidir')
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

    const { name, groups, days, startTime, duration, teachers } = req.body;

    const lesson = await Lesson.findByIdAndUpdate(
      req.params.id,
      {
        ...(name && { name: name.trim() }),
        groups,
        days,
        startTime,
        duration,
        teachers,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    )
      .populate('groups', 'name')
      .populate('teachers', 'firstName lastName fatherName');

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Dərs tapılmadı'
      });
    }

    res.json({
      success: true,
      message: 'Dərs uğurla yeniləndi',
      data: lesson
    });
  } catch (error) {
    console.error('Dərs yeniləmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route PATCH /api/lessons/:id/status
// @desc Dərsi aktivləşdir / passivləşdir (istifadə yoxlaması ilə)
// @access Private
router.patch('/:id/status', makeStatusHandler('lesson'));

module.exports = router;
