const express = require('express');
const router = express.Router();
const Child = require('../models/Child');
const Package = require('../models/Package');
const Group = require('../models/Group');
const Nanny = require('../models/Nanny');
const { body, validationResult } = require('express-validator');

// @route GET /api/children
// @desc Bütün uşaqları gətir (axtarış ilə) - populate ilə əlaqəli məlumatlar
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
          { firstName: searchRegex },
          { lastName: searchRegex },
          { fatherName: searchRegex },
          { motherName: searchRegex },
          { phone1: searchRegex },
          { phone2: searchRegex },
          { username: searchRegex }
        ]
      };
    }

    const children = await Child.find(query)
      .populate('package', 'name price days')
      .populate({
        path: 'group',
        select: 'name departments ageRange',
        populate: [
          { path: 'teachers', select: 'firstName lastName fatherName' },
          { path: 'nannies', select: 'firstName lastName fatherName' }
        ]
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: children.length,
      data: children
    });
  } catch (error) {
    console.error('Uşaqları gətirmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route GET /api/children/form-data
// @desc Uşaq formu üçün paket, qrup və baxıcı siyahısını gətir
// @access Private
router.get('/form-data', async (req, res) => {
  try {
    const [packages, groups, nannies] = await Promise.all([
      Package.find({ isActive: true }).select('_id name price days').sort({ name: 1 }),
      Group.find({ isActive: true }).select('_id name departments').sort({ name: 1 }),
      Nanny.find({ isActive: true }).select('_id firstName lastName fatherName').sort({ lastName: 1 })
    ]);

    res.json({
      success: true,
      data: {
        packages: packages.map(p => ({ _id: p._id, name: p.name, price: p.price, days: p.days })),
        groups: groups.map(g => ({ _id: g._id, name: g.name, departments: g.departments })),
        nannies: nannies.map(n => ({ _id: n._id, fullName: `${n.lastName} ${n.firstName} ${n.fatherName}` }))
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

// @route POST /api/children
// @desc Yeni uşaq əlavə et
// @access Private
router.post('/', [
  body('firstName').trim().notEmpty().withMessage('Ad tələb olunur'),
  body('lastName').trim().notEmpty().withMessage('Soyad tələb olunur'),
  body('birthDate').isISO8601().withMessage('Düzgün tarix formatı'),
  body('fatherName').optional().trim(),
  body('motherName').optional().trim(),
  body('phone1').matches(/^\+994[0-9]{9}$/).withMessage('Düzgün telefon nömrəsi daxil edin (məs: +994551234567)'),
  body('phone2').optional().matches(/^\+994[0-9]{9}$/).withMessage('Düzgün telefon nömrəsi daxil edin'),
  body('username').isEmail().withMessage('Düzgün email formatı daxil edin').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Şifrə ən az 6 simvol olmalıdır'),
  body('package').notEmpty().withMessage('Paket seçilməlidir'),
  body('group').notEmpty().withMessage('Qrup seçilməlidir'),
  body('startDate').isISO8601().withMessage('Düzgün tarix formatı'),
  body('discount').optional().isFloat({ min: 0 }).withMessage('Endirim 0-dan kiçik ola bilməz'),
  body('extraPrice').optional().isFloat({ min: 0 }).withMessage('Əlavə qiymət 0-dan kiçik ola bilməz'),
  body('notes').optional().trim()
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

    // Check if username already exists
    const existingChild = await Child.findOne({ username: req.body.username.toLowerCase() });
    if (existingChild) {
      return res.status(400).json({
        success: false,
        message: 'Bu email artıq istifadə edilir'
      });
    }

    const child = await Child.create({
      ...req.body,
      discount: parseFloat(req.body.discount || 0),
      extraPrice: parseFloat(req.body.extraPrice || 0)
    });

    const populatedChild = await Child.findById(child._id)
      .populate('package', 'name price days')
      .populate({
        path: 'group',
        select: 'name departments ageRange',
        populate: [
          { path: 'teachers', select: 'firstName lastName fatherName' },
          { path: 'nannies', select: 'firstName lastName fatherName' }
        ]
      });

    res.status(201).json({
      success: true,
      message: 'Uşaq uğurla əlavə edildi',
      data: populatedChild
    });
  } catch (error) {
    console.error('Uşaq əlavə etmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route PUT /api/children/:id
// @desc Uşağı yenilə
// @access Private
router.put('/:id', [
  body('firstName').optional().trim().notEmpty().withMessage('Ad boş ola bilməz'),
  body('lastName').optional().trim().notEmpty().withMessage('Soyad boş ola bilməz'),
  body('birthDate').optional().isISO8601().withMessage('Düzgün tarix formatı'),
  body('fatherName').optional().trim(),
  body('motherName').optional().trim(),
  body('phone1').optional().matches(/^\+994[0-9]{9}$/).withMessage('Düzgün telefon nömrəsi daxil edin'),
  body('phone2').optional().matches(/^\+994[0-9]{9}$/).withMessage('Düzgün telefon nömrəsi daxil edin'),
  body('username').optional().isEmail().withMessage('Düzgün email formatı daxil edin').normalizeEmail(),
  body('password').optional().isLength({ min: 6 }).withMessage('Şifrə ən az 6 simvol olmalıdır'),
  body('package').optional().notEmpty().withMessage('Paket seçilməlidir'),
  body('group').optional().notEmpty().withMessage('Qrup seçilməlidir'),
  body('startDate').optional().isISO8601().withMessage('Düzgün tarix formatı'),
  body('discount').optional().isFloat({ min: 0 }).withMessage('Endirim 0-dan kiçik ola bilməz'),
  body('extraPrice').optional().isFloat({ min: 0 }).withMessage('Əlavə qiymət 0-dan kiçik ola bilməz'),
  body('notes').optional().trim()
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

    // Check if username already exists (excluding current child)
    if (req.body.username) {
      const existingChild = await Child.findOne({ 
        username: req.body.username.toLowerCase(),
        _id: { $ne: req.params.id }
      });
      if (existingChild) {
        return res.status(400).json({
          success: false,
          message: 'Bu email artıq istifadə edilir'
        });
      }
    }

    const updateData = {};
    const fields = ['firstName', 'lastName', 'birthDate', 'fatherName', 'motherName', 
                    'phone1', 'phone2', 'username', 'password', 'package', 'group', 'startDate', 'notes'];
    fields.forEach(field => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });
    if (req.body.discount !== undefined) updateData.discount = parseFloat(req.body.discount);
    if (req.body.extraPrice !== undefined) updateData.extraPrice = parseFloat(req.body.extraPrice);

    const child = await Child.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('package', 'name price days')
      .populate({
        path: 'group',
        select: 'name departments ageRange',
        populate: [
          { path: 'teachers', select: 'firstName lastName fatherName' },
          { path: 'nannies', select: 'firstName lastName fatherName' }
        ]
      });

    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Uşaq tapılmadı'
      });
    }

    res.json({
      success: true,
      message: 'Uşaq uğurla yeniləndi',
      data: child
    });
  } catch (error) {
    console.error('Uşaq yeniləmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route DELETE /api/children/:id
// @desc Uşağı sil (soft delete)
// @access Private
router.delete('/:id', async (req, res) => {
  try {
    const child = await Child.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Uşaq tapılmadı'
      });
    }

    res.json({
      success: true,
      message: 'Uşaq uğurla silindi',
      data: child
    });
  } catch (error) {
    console.error('Uşaq silmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

module.exports = router;
