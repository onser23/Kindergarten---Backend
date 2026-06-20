const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const Teacher = require('../models/Teacher');
const Nanny = require('../models/Nanny');
const { body, validationResult } = require('express-validator');
const { makeStatusHandler } = require('./shared/statusController');

// @route   GET /api/groups
// @desc    Bütün qrupları gətir (axtarış ilə) - populate ilə müəllim və baxıcı adları
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
          { ageRange: searchRegex },
          { departments: searchRegex }
        ]
      };
    }

    const groups = await Group.find(query)
      .populate('teachers', 'firstName lastName fatherName')
      .populate('nannies', 'firstName lastName fatherName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: groups.length,
      data: groups
    });
  } catch (error) {
    console.error('Qrupları gətirmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   GET /api/groups/form-data
// @desc    Qrup formu üçün müəllim və baxıcı siyahısını gətir
// @access  Private
router.get('/form-data', async (req, res) => {
  try {
    const [teachers, nannies] = await Promise.all([
      Teacher.find({ isActive: true }).select('_id firstName lastName fatherName').sort({ lastName: 1 }),
      Nanny.find({ isActive: true }).select('_id firstName lastName fatherName').sort({ lastName: 1 })
    ]);

    res.json({
      success: true,
      data: {
        teachers: teachers.map(t => ({
          _id: t._id,
          fullName: `${t.lastName} ${t.firstName} ${t.fatherName}`
        })),
        nannies: nannies.map(n => ({
          _id: n._id,
          fullName: `${n.lastName} ${n.firstName} ${n.fatherName}`
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

// @route   POST /api/groups
// @desc    Yeni qrup əlavə et
// @access  Private
router.post('/', [
  body('name').trim().notEmpty().withMessage('Qrup adı tələb olunur'),
  body('departments').isArray({ min: 1 }).withMessage('Ən azı bir bölmə seçilməlidir'),
  body('departments.*').isIn(['Rus dili', 'İngilis dili', 'Azərbaycan dili']).withMessage('Yanlış bölmə seçimi'),
  body('teachers').isArray({ min: 1 }).withMessage('Ən azı bir müəllim seçilməlidir'),
  body('nannies').isArray({ min: 1 }).withMessage('Ən azı bir baxıcı seçilməlidir'),
  body('ageRange').isIn(['1-2', '2-3', '3-4', '4-5', '5-6']).withMessage('Yaş aralığı seçilməlidir')
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

    const { name, departments, teachers, nannies, ageRange } = req.body;

    // Qrup adının unikallığını yoxla
    const existingGroup = await Group.findOne({ name: name.trim() });
    if (existingGroup) {
      return res.status(400).json({
        success: false,
        message: 'Bu ad ilə qrup artıq mövcuddur'
      });
    }

    const group = await Group.create({
      name: name.trim(),
      departments,
      teachers,
      nannies,
      ageRange
    });

    // Populate edilmiş halda qaytar
    const populatedGroup = await Group.findById(group._id)
      .populate('teachers', 'firstName lastName fatherName')
      .populate('nannies', 'firstName lastName fatherName');

    res.status(201).json({
      success: true,
      message: 'Qrup uğurla əlavə edildi',
      data: populatedGroup
    });
  } catch (error) {
    console.error('Qrup əlavə etmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   PUT /api/groups/:id
// @desc    Qrupu yenilə
// @access  Private
router.put('/:id', [
  body('name').optional().trim().notEmpty().withMessage('Qrup adı boş ola bilməz'),
  body('departments').optional().isArray({ min: 1 }).withMessage('Ən azı bir bölmə seçilməlidir'),
  body('departments.*').optional().isIn(['Rus dili', 'İngilis dili', 'Azərbaycan dili']).withMessage('Yanlış bölmə seçimi'),
  body('teachers').optional().isArray({ min: 1 }).withMessage('Ən azı bir müəllim seçilməlidir'),
  body('nannies').optional().isArray({ min: 1 }).withMessage('Ən azı bir baxıcı seçilməlidir'),
  body('ageRange').optional().isIn(['1-2', '2-3', '3-4', '4-5', '5-6']).withMessage('Yaş aralığı seçilməlidir')
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

    const { name, departments, teachers, nannies, ageRange } = req.body;

    // Əgər ad dəyişibsə, unikallığını yoxla
    if (name) {
      const existingGroup = await Group.findOne({ name: name.trim(), _id: { $ne: req.params.id } });
      if (existingGroup) {
        return res.status(400).json({
          success: false,
          message: 'Bu ad ilə qrup artıq mövcuddur'
        });
      }
    }

    const group = await Group.findByIdAndUpdate(
      req.params.id,
      { 
        ...(name && { name: name.trim() }), 
        departments, 
        teachers, 
        nannies, 
        ageRange,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    )
    .populate('teachers', 'firstName lastName fatherName')
    .populate('nannies', 'firstName lastName fatherName');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Qrup tapılmadı'
      });
    }

    res.json({
      success: true,
      message: 'Qrup uğurla yeniləndi',
      data: group
    });
  } catch (error) {
    console.error('Qrup yeniləmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   PATCH /api/groups/:id/status
// @desc    Qrupu aktivləşdir / passivləşdir (istifadə yoxlaması ilə)
// @access  Private
router.patch('/:id/status', makeStatusHandler('group'));

module.exports = router;
