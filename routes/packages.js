const express = require('express');
const router = express.Router();
const Package = require('../models/Package');
const Service = require('../models/Service');
const Lesson = require('../models/Lesson');
const { body, validationResult } = require('express-validator');

const DURATIONS = ['Bir aylıq tam gün', 'Bir aylıq yarım gün', 'Həftəlik tam gün', 'Həftəlik yarım gün', 'Günlük'];

// @route GET /api/packages
// @desc Bütün paketləri gətir (axtarış ilə) - populate ilə xidmət və dərs adları
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
          { duration: searchRegex }
        ]
      };
    }

    const packages = await Package.find(query)
      .populate('services', 'name')
      .populate('lessons', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: packages.length,
      data: packages
    });
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
  body('services').isArray({ min: 1 }).withMessage('Ən azı bir xidmət seçilməlidir'),
  body('lessons').isArray({ min: 1 }).withMessage('Ən azı bir dərs seçilməlidir'),
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

    const pkg = await Package.create({
      name: name.trim(),
      services,
      lessons,
      duration,
      price: parseFloat(price)
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
  body('services').optional().isArray({ min: 1 }).withMessage('Ən azı bir xidmət seçilməlidir'),
  body('lessons').optional().isArray({ min: 1 }).withMessage('Ən azı bir dərs seçilməlidir'),
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
    if (duration !== undefined) updateData.duration = duration;
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

// @route DELETE /api/packages/:id
// @desc Paketi sil (soft delete)
// @access Private
router.delete('/:id', async (req, res) => {
  try {
    const pkg = await Package.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: 'Paket tapılmadı'
      });
    }

    res.json({
      success: true,
      message: 'Paket uğurla silindi',
      data: pkg
    });
  } catch (error) {
    console.error('Paket silmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

module.exports = router;
