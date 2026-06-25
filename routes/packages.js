const express = require('express');
const router = express.Router();
const Package = require('../models/Package');
const Service = require('../models/Service');
const Lesson = require('../models/Lesson');
const { body, validationResult } = require('express-validator');
const { makeStatusHandler } = require('./shared/statusController');
const { parsePagination, buildPaginatedResponse } = require('../utils/pagination');
const { getNextDisplayId } = require('../utils/idGenerator');

const DURATIONS = ['Bir aylıq tam gün', 'Bir aylıq yarım gün', 'Həftəlik tam gün', 'Həftəlik yarım gün', 'Günlük'];

// Duration to days mapping
const DURATION_DAYS = {
  'Bir aylıq tam gün': 30,
  'Bir aylıq yarım gün': 30,
  'Həftəlik tam gün': 7,
  'Həftəlik yarım gün': 7,
  'Günlük': 1
};

// @route GET /api/packages
// @desc Bütün paketləri gətir (axtarış ilə) - populate ilə xidmət və dərs adları
// @access Private
router.get('/', async (req, res) => {
  try {
    const { search, status } = req.query;
    const { page, limit, skip } = parsePagination(req.query, 20);
    let query = {};

    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'passive') {
      query.isActive = false;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { duration: searchRegex }
      ];
    }

    const [total, packages] = await Promise.all([
      Package.countDocuments(query),
      Package.find(query)
        .populate('services', 'name')
        .populate('lessons', 'name')
        .sort({ displayId: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
    ]);

    res.json(buildPaginatedResponse(packages, total, page, limit));
  } catch (error) {
    console.error('Paketləri gətirmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route GET /api/packages/form-data
// @desc Paket formu üçün xidmət və dərs siyahısını gətir
// @access Private
router.get('/form-data', async (req, res) => {
  try {
    const [services, lessons] = await Promise.all([
      Service.find({ isActive: true }).select('_id name').sort({ name: 1 }),
      Lesson.find({ isActive: true }).select('_id name').sort({ name: 1 })
    ]);

    res.json({
      success: true,
      data: {
        services: services.map(s => ({ _id: s._id, name: s.name })),
        lessons: lessons.map(l => ({ _id: l._id, name: l.name })),
        durations: DURATIONS
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

// @route POST /api/packages
// @desc Yeni paket əlavə et
// @access Private
router.post('/', [
  body('name').trim().notEmpty().withMessage('Paket adı tələb olunur'),
  body('services').optional().isArray().withMessage('Xidmətlər massiv olmalıdır'),
  body('lessons').optional().isArray().withMessage('Dərslər massiv olmalıdır'),
  body('duration').isIn(DURATIONS).withMessage('Yanlış müddət seçimi'),
  body('price').isFloat({ min: 0 }).withMessage('Qiymət 0-dan böyük olmalıdır')
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

    const { name, services, lessons, duration, price } = req.body;

    // Auto-calculate days from duration
    const days = DURATION_DAYS[duration];

    const displayId = await getNextDisplayId('Package');

    const pkg = await Package.create({
      name: name.trim(),
      services: services || [],
      lessons: lessons || [],
      duration,
      days,
      price: parseFloat(price),
      displayId
    });

    // Populate edilmiş halda qaytar
    const populatedPackage = await Package.findById(pkg._id)
      .populate('services', 'name')
      .populate('lessons', 'name');

    res.status(201).json({
      success: true,
      message: 'Paket uğurla əlavə edildi',
      data: populatedPackage
    });
  } catch (error) {
    console.error('Paket əlavə etmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route PUT /api/packages/:id
// @desc Paketi yenilə
// @access Private
router.put('/:id', [
  body('name').optional().trim().notEmpty().withMessage('Paket adı boş ola bilməz'),
  body('services').optional().isArray().withMessage('Xidmətlər massiv olmalıdır'),
  body('lessons').optional().isArray().withMessage('Dərslər massiv olmalıdır'),
  body('duration').optional().isIn(DURATIONS).withMessage('Yanlış müddət seçimi'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Qiymət 0-dan böyük olmalıdır')
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

    const { name, services, lessons, duration, price } = req.body;

    const updateData = { updatedAt: Date.now() };
    if (name !== undefined) updateData.name = name.trim();
    if (services !== undefined) updateData.services = services;
    if (lessons !== undefined) updateData.lessons = lessons;
    if (duration !== undefined) {
      updateData.duration = duration;
      // Auto-recalculate days when duration changes
      updateData.days = DURATION_DAYS[duration];
    }
    if (price !== undefined) updateData.price = parseFloat(price);

    const pkg = await Package.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('services', 'name')
      .populate('lessons', 'name');

    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: 'Paket tapılmadı'
      });
    }

    res.json({
      success: true,
      message: 'Paket uğurla yeniləndi',
      data: pkg
    });
  } catch (error) {
    console.error('Paket yeniləmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route PATCH /api/packages/:id/status
// @desc Paketi aktivləşdir / passivləşdir (istifadə yoxlaması ilə)
// @access Private
router.patch('/:id/status', makeStatusHandler('package'));

module.exports = router;
