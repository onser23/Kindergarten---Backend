const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const { body, validationResult } = require('express-validator');
const { makeStatusHandler } = require('./shared/statusController');
const { parsePagination, buildPaginatedResponse } = require('../utils/pagination');
const { getNextDisplayId } = require('../utils/idGenerator');

// @route GET /api/services
// @desc Bütün xidmətləri gətir (axtarış ilə)
// @access Private
router.get('/', async (req, res) => {
  try {
    const { search, status } = req.query;
    const { page, limit, skip } = parsePagination(req.query, 20);
    let query = {};

    // Status filter (active|passive|all)
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'passive') {
      query.isActive = false;
    }
    // status === 'all' və ya undefined → filter tətbiq olunmur

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { startTime: searchRegex },
        { days: searchRegex }
      ];
    }

    const [total, services] = await Promise.all([
      Service.countDocuments(query),
      Service.find(query).sort({ displayId: -1, _id: -1 }).skip(skip).limit(limit)
    ]);

    res.json(buildPaginatedResponse(services, total, page, limit));
  } catch (error) {
    console.error('Xidmətləri gətirmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route POST /api/services
// @desc Yeni xidmət əlavə et
// @access Private
router.post('/', [
  body('name').trim().notEmpty().withMessage('Xidmət adı tələb olunur'),
  body('days').isArray({ min: 1 }).withMessage('Ən azı bir gün seçilməlidir'),
  body('days.*').isIn(['Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə', 'Bazar']).withMessage('Yanlış gün seçimi'),
  body('startTime').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Düzgün saat formatı (HH:MM)')
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

    const { name, days, startTime } = req.body;

    const displayId = await getNextDisplayId('Service');

    const service = await Service.create({
      name: name.trim(),
      days,
      startTime,
      displayId
    });

    res.status(201).json({
      success: true,
      message: 'Xidmət uğurla əlavə edildi',
      data: service
    });
  } catch (error) {
    console.error('Xidmət əlavə etmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route PUT /api/services/:id
// @desc Xidməti yenilə
// @access Private
router.put('/:id', [
  body('name').optional().trim().notEmpty().withMessage('Xidmət adı boş ola bilməz'),
  body('days').optional().isArray({ min: 1 }).withMessage('Ən azı bir gün seçilməlidir'),
  body('days.*').optional().isIn(['Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə', 'Bazar']).withMessage('Yanlış gün seçimi'),
  body('startTime').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Düzgün saat formatı (HH:MM)')
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

    const { name, days, startTime } = req.body;

    const service = await Service.findByIdAndUpdate(
      req.params.id,
      {
        ...(name && { name: name.trim() }),
        days,
        startTime,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Xidmət tapılmadı'
      });
    }

    res.json({
      success: true,
      message: 'Xidmət uğurla yeniləndi',
      data: service
    });
  } catch (error) {
    console.error('Xidmət yeniləmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route PATCH /api/services/:id/status
// @desc Xidməti aktivləşdir / passivləşdir (istifadə yoxlaması ilə)
// @access Private
router.patch('/:id/status', makeStatusHandler('service'));

module.exports = router;
