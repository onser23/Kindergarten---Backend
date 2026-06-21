const express = require('express');
const router = express.Router();
const Food = require('../models/Food');
const { body, validationResult } = require('express-validator');
const { makeStatusHandler } = require('./shared/statusController');

// @route   GET /api/foods
// @desc    Bütün qidaları gətir (axtarış ilə)
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query = {
        $or: [
          { dryFood: searchRegex },
          { soup: searchRegex },
          { drink: searchRegex },
          { dessert: searchRegex },
          { fruit: searchRegex },
          { time: searchRegex },
          { days: searchRegex }
        ]
      };
    }

    const foods = await Food.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: foods.length,
      data: foods
    });
  } catch (error) {
    console.error('Qidaları gətirmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   POST /api/foods
// @desc    Yeni qida menyusu əlavə et
// @access  Private
router.post('/', [
  body('dryFood').optional().trim().isLength({ max: 200 }).withMessage('Quru yemək 200 simvoldan çox ola bilməz'),
  body('soup').optional().trim().isLength({ max: 200 }).withMessage('Sulu yemək 200 simvoldan çox ola bilməz'),
  body('drink').optional().trim().isLength({ max: 200 }).withMessage('İçki 200 simvoldan çox ola bilməz'),
  body('dessert').optional().trim().isLength({ max: 200 }).withMessage('Şirniyyat 200 simvoldan çox ola bilməz'),
  body('fruit').optional().trim().isLength({ max: 200 }).withMessage('Meyvə 200 simvoldan çox ola bilməz'),
  body('days').isArray({ min: 1 }).withMessage('Ən azı bir gün seçilməlidir'),
  body('days.*').isIn(['Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə', 'Bazar']).withMessage('Yanlış gün seçimi'),
  body('time').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Düzgün saat formatı (HH:MM)')
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

    const { dryFood, soup, drink, dessert, fruit, days, time } = req.body;

    const food = await Food.create({
      dryFood: dryFood || '',
      soup: soup || '',
      drink: drink || '',
      dessert: dessert || '',
      fruit: fruit || '',
      days,
      time
    });

    res.status(201).json({
      success: true,
      message: 'Qida menyusu uğurla əlavə edildi',
      data: food
    });
  } catch (error) {
    console.error('Qida əlavə etmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   PUT /api/foods/:id
// @desc    Qida menyusunu yenilə
// @access  Private
router.put('/:id', [
  body('dryFood').optional().trim().isLength({ max: 200 }).withMessage('Quru yemək 200 simvoldan çox ola bilməz'),
  body('soup').optional().trim().isLength({ max: 200 }).withMessage('Sulu yemək 200 simvoldan çox ola bilməz'),
  body('drink').optional().trim().isLength({ max: 200 }).withMessage('İçki 200 simvoldan çox ola bilməz'),
  body('dessert').optional().trim().isLength({ max: 200 }).withMessage('Şirniyyat 200 simvoldan çox ola bilməz'),
  body('fruit').optional().trim().isLength({ max: 200 }).withMessage('Meyvə 200 simvoldan çox ola bilməz'),
  body('days').optional().isArray({ min: 1 }).withMessage('Ən azı bir gün seçilməlidir'),
  body('days.*').optional().isIn(['Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə', 'Bazar']).withMessage('Yanlış gün seçimi'),
  body('time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Düzgün saat formatı (HH:MM)')
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

    const updateData = {};
    const fields = ['dryFood', 'soup', 'drink', 'dessert', 'fruit', 'days', 'time'];
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    updateData.updatedAt = Date.now();

    const food = await Food.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!food) {
      return res.status(404).json({
        success: false,
        message: 'Qida menyusu tapılmadı'
      });
    }

    res.json({
      success: true,
      message: 'Qida menyusu uğurla yeniləndi',
      data: food
    });
  } catch (error) {
    console.error('Qida yeniləmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   PATCH /api/foods/:id/status
// @desc    Qida menyusunu aktivləşdir / passivləşdir
// @access  Private
router.patch('/:id/status', makeStatusHandler('food'));

module.exports = router;
