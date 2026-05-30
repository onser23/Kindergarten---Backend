const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Group = require('../models/Group');
const { body, validationResult } = require('express-validator');

// @route   GET /api/events
// @desc    Bütün tədbirləri gətir (axtarış ilə) - populate ilə qrup adları
// @access  Private
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
          { startTime: searchRegex }
        ]
      };
    }

    const events = await Event.find(query)
      .populate('groups', 'name')
      .sort({ startDate: 1, startTime: 1 });

    res.json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    console.error('Tədbirləri gətirmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   GET /api/events/form-data
// @desc    Tədbir formu üçün qrup siyahısını gətir
// @access  Private
router.get('/form-data', async (req, res) => {
  try {
    const groups = await Group.find({ isActive: true })
      .select('_id name')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: {
        groups: groups.map(g => ({
          _id: g._id,
          name: g.name
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

// @route   POST /api/events
// @desc    Yeni tədbir əlavə et
// @access  Private
router.post('/', [
  body('name').trim().notEmpty().withMessage('Tədbir adı tələb olunur'),
  body('groups').isArray({ min: 1 }).withMessage('Ən azı bir qrup seçilməlidir'),
  body('startDate').isISO8601().withMessage('Düzgün başlama tarixi formatı'),
  body('startTime').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Düzgün saat formatı (HH:MM)'),
  body('endDate').isISO8601().withMessage('Düzgün bitmə tarixi formatı')
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

    const { name, groups, startDate, startTime, endDate } = req.body;

    // Bitmə tarixi başlama tarixindən əvvəl olmamalıdır
    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({
        success: false,
        message: 'Bitmə tarixi başlama tarixindən əvvəl ola bilməz'
      });
    }

    const event = await Event.create({
      name: name.trim(),
      groups,
      startDate,
      startTime,
      endDate
    });

    // Populate edilmiş halda qaytar
    const populatedEvent = await Event.findById(event._id)
      .populate('groups', 'name');

    res.status(201).json({
      success: true,
      message: 'Tədbir uğurla əlavə edildi',
      data: populatedEvent
    });
  } catch (error) {
    console.error('Tədbir əlavə etmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   PUT /api/events/:id
// @desc    Tədbiri yenilə
// @access  Private
router.put('/:id', [
  body('name').optional().trim().notEmpty().withMessage('Tədbir adı boş ola bilməz'),
  body('groups').optional().isArray({ min: 1 }).withMessage('Ən azı bir qrup seçilməlidir'),
  body('startDate').optional().isISO8601().withMessage('Düzgün başlama tarixi formatı'),
  body('startTime').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Düzgün saat formatı (HH:MM)'),
  body('endDate').optional().isISO8601().withMessage('Düzgün bitmə tarixi formatı')
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

    const { name, groups, startDate, startTime, endDate } = req.body;

    // Bitmə tarixi başlama tarixindən əvvəl olmamalıdır
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({
        success: false,
        message: 'Bitmə tarixi başlama tarixindən əvvəl ola bilməz'
      });
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { 
        ...(name && { name: name.trim() }), 
        groups, 
        startDate, 
        startTime, 
        endDate,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    )
    .populate('groups', 'name');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Tədbir tapılmadı'
      });
    }

    res.json({
      success: true,
      message: 'Tədbir uğurla yeniləndi',
      data: event
    });
  } catch (error) {
    console.error('Tədbir yeniləmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   DELETE /api/events/:id
// @desc    Tədbiri sil (soft delete)
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Tədbir tapılmadı'
      });
    }

    res.json({
      success: true,
      message: 'Tədbir uğurla silindi',
      data: event
    });
  } catch (error) {
    console.error('Tədbir silmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

module.exports = router;
