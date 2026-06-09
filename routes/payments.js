const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Child = require('../models/Child');
const Package = require('../models/Package');
const { body, validationResult } = require('express-validator');

// @route   GET /api/payments/form-data
// @desc    Ödəniş formu üçün uşaqlar siyahısını gətir
// @access  Private
router.get('/form-data', async (req, res) => {
  try {
    const children = await Child.find({ isActive: true })
      .select('firstName lastName fatherName motherName birthDate startDate currentDebt package group')
      .populate('package', 'name price')
      .populate('group', 'name')
      .sort({ lastName: 1, firstName: 1 });

    res.json({
      success: true,
      data: {
        children: children.map((c) => ({
          _id: c._id,
          fullName: `${c.lastName} ${c.firstName}`,
          firstName: c.firstName,
          lastName: c.lastName,
          fatherName: c.fatherName || '',
          motherName: c.motherName || '',
          birthDate: c.birthDate,
          package: c.package,
          group: c.group,
          startDate: c.startDate,
          currentDebt: c.currentDebt || 0
        }))
      }
    });
  } catch (error) {
    console.error('Payment form data xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   GET /api/payments
// @desc    Bütün ödənişləri gətir (axtarış + tarix filtri)
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { search, dateFrom, dateTo } = req.query;
    let query = { isActive: true };

    // Tarix aralığı
    if (dateFrom || dateTo) {
      query.paymentDate = {};
      if (dateFrom) query.paymentDate.$gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.paymentDate.$lte = endDate;
      }
    }

    // Əvvəlcə uşaqları filter et (search)
    let childFilter = {};
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const isNumeric = !isNaN(parseFloat(search)) && isFinite(search);

      if (isNumeric) {
        // Rəqəm axtarışı: paidAmount və ya amount
        const num = parseFloat(search);
        query.$or = [
          { paidAmount: num },
          { amount: num }
        ];
      } else {
        // Ad/soyad axtarışı
        const matchingChildren = await Child.find({
          isActive: true,
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { fatherName: searchRegex },
            { motherName: searchRegex }
          ]
        }).select('_id');
        const childIds = matchingChildren.map((c) => c._id);
        if (childIds.length === 0) {
          return res.json({ success: true, count: 0, data: [] });
        }
        query.child = { $in: childIds };
      }
    }

    const payments = await Payment.find(query)
      .populate({
        path: 'child',
        select: 'firstName lastName fatherName motherName startDate package',
        populate: [
          { path: 'package', select: 'name price' }
        ]
      })
      .sort({ paymentDate: -1, createdAt: -1 });

    res.json({
      success: true,
      count: payments.length,
      data: payments
    });
  } catch (error) {
    console.error('Ödənişləri gətirmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   GET /api/payments/:id
// @desc    Tək ödənişi gətir
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate({
        path: 'child',
        select: 'firstName lastName fatherName motherName startDate package',
        populate: [
          { path: 'package', select: 'name price' }
        ]
      });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Ödəniş tapılmadı'
      });
    }

    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Ödəniş gətirmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   POST /api/payments
// @desc    Yeni ödəniş əlavə et
// @access  Private
router.post('/', [
  body('child').notEmpty().withMessage('Uşaq tələb olunur'),
  body('paidAmount').isFloat({ min: 0 }).withMessage('Ödənilən məbləğ düzgün deyil'),
  body('paymentDate').isISO8601().withMessage('Düzgün tarix formatı'),
  body('discount').optional().isFloat({ min: 0 }).withMessage('Endirim düzgün deyil'),
  body('extraPrice').optional().isFloat({ min: 0 }).withMessage('Əlavə qiymət düzgün deyil'),
  body('note').optional().isLength({ max: 500 }).withMessage('Qeyd 500 simvoldan çox ola bilməz')
], async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Validasiya xətası',
        errors: errors.array()
      });
    }

    const { child: childId, discount, extraPrice, paidAmount, paymentDate, note } = req.body;

    // Uşağı tap
    const child = await Child.findById(childId).populate('package', 'price name').session(session);
    if (!child || !child.isActive) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Uşaq tapılmadı'
      });
    }

    const packagePrice = child.package?.price || 0;
    const disc = parseFloat(discount || 0);
    const extra = parseFloat(extraPrice || 0);
    const amount = packagePrice + extra - disc;
    const paid = parseFloat(paidAmount);

    // Real ödəniş: paid + endirim - əlavə
    // Endirim sayəsində daha çox borc bağlanır, əlavə isə borcu artırır
    const realPayment = paid + disc - extra;

    const remainingBefore = child.currentDebt || 0;
    const remainingAfter = remainingBefore - realPayment;

    // Real ödəniş cari borcdan çox ola bilməz
    if (remainingAfter < 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Real ödəniş (${realPayment} ₼) cari borcdan (${remainingBefore} ₼) çox ola bilməz`
      });
    }

    // Payment yarat
    const payment = await Payment.create([{
      child: childId,
      amount,
      discount: disc,
      extraPrice: extra,
      paidAmount: paid,
      paymentDate,
      note: note || '',
      remainingBefore,
      remainingAfter
    }], { session });

    // Child.currentDebt yenilə
    child.currentDebt = remainingAfter;
    await child.save({ session });

    await session.commitTransaction();
    session.endSession();

    const populatedPayment = await Payment.findById(payment[0]._id)
      .populate({
        path: 'child',
        select: 'firstName lastName fatherName motherName startDate package',
        populate: [{ path: 'package', select: 'name price' }]
      });

    res.status(201).json({
      success: true,
      message: 'Ödəniş uğurla əlavə edildi',
      data: populatedPayment
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Ödəniş əlavə etmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   PUT /api/payments/:id
// @desc    Ödənişi redaktə et (mürəkkəb məntiqlə)
// @access  Private
router.put('/:id', [
  body('paidAmount').optional().isFloat({ min: 0 }).withMessage('Ödənilən məbləğ düzgün deyil'),
  body('paymentDate').optional().isISO8601().withMessage('Düzgün tarix formatı'),
  body('discount').optional().isFloat({ min: 0 }).withMessage('Endirim düzgün deyil'),
  body('extraPrice').optional().isFloat({ min: 0 }).withMessage('Əlavə qiymət düzgün deyil'),
  body('note').optional().isLength({ max: 500 }).withMessage('Qeyd 500 simvoldan çox ola bilməz')
], async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Validasiya xətası',
        errors: errors.array()
      });
    }

    // Köhnə payment-i tap
    const oldPayment = await Payment.findById(req.params.id).session(session);
    if (!oldPayment || !oldPayment.isActive) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Ödəniş tapılmadı'
      });
    }

    // Uşağı tap
    const child = await Child.findById(oldPayment.child)
      .populate('package', 'price name')
      .session(session);
    if (!child) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Uşaq tapılmadı'
      });
    }

    // Köhnə ödənişi geri qaytar
    child.currentDebt = (child.currentDebt || 0) + oldPayment.paidAmount;

    // Yeni dəyərləri tətbiq et
    const newDiscount = req.body.discount !== undefined ? parseFloat(req.body.discount) : oldPayment.discount;
    const newExtraPrice = req.body.extraPrice !== undefined ? parseFloat(req.body.extraPrice) : oldPayment.extraPrice;
    const newPaidAmount = req.body.paidAmount !== undefined ? parseFloat(req.body.paidAmount) : oldPayment.paidAmount;
    const newPaymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : oldPayment.paymentDate;
    const newNote = req.body.note !== undefined ? req.body.note : oldPayment.note;

    const packagePrice = child.package?.price || 0;
    const newAmount = packagePrice + newExtraPrice - newDiscount;

    // Real ödəniş: paid + endirim - əlavə
    const newRealPayment = newPaidAmount + newDiscount - newExtraPrice;

    const remainingBefore = child.currentDebt;
    const remainingAfter = remainingBefore - newRealPayment;

    // Yoxlama: real ödəniş cari borcdan çox ola bilməz
    if (remainingAfter < 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Real ödəniş (${newRealPayment} ₼) cari borcdan (${remainingBefore} ₼) çox ola bilməz`
      });
    }

    // Payment-i yenilə
    oldPayment.amount = newAmount;
    oldPayment.discount = newDiscount;
    oldPayment.extraPrice = newExtraPrice;
    oldPayment.paidAmount = newPaidAmount;
    oldPayment.paymentDate = newPaymentDate;
    oldPayment.note = newNote;
    oldPayment.remainingBefore = remainingBefore;
    oldPayment.remainingAfter = remainingAfter;
    oldPayment.updatedAt = Date.now();
    await oldPayment.save({ session });

    // Child.currentDebt yenilə
    child.currentDebt = remainingAfter;
    await child.save({ session });

    await session.commitTransaction();
    session.endSession();

    const populatedPayment = await Payment.findById(oldPayment._id)
      .populate({
        path: 'child',
        select: 'firstName lastName fatherName motherName startDate package',
        populate: [{ path: 'package', select: 'name price' }]
      });

    res.json({
      success: true,
      message: 'Ödəniş uğurla yeniləndi',
      data: populatedPayment
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Ödəniş yeniləmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   DELETE /api/payments/:id
// @desc    Ödənişi sil (soft delete) və borcu geri qaytar
// @access  Private
router.delete('/:id', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payment = await Payment.findById(req.params.id).session(session);
    if (!payment) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Ödəniş tapılmadı'
      });
    }

    // Child.currentDebt-ə ödənişi geri qaytar
    const child = await Child.findById(payment.child).session(session);
    if (child) {
      child.currentDebt = (child.currentDebt || 0) + payment.paidAmount;
      await child.save({ session });
    }

    // Soft delete
    payment.isActive = false;
    payment.updatedAt = Date.now();
    await payment.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: 'Ödəniş uğurla silindi',
      data: payment
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Ödəniş silmə xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// @route   GET /api/payments/export/csv
// @desc    CSV formatında ödənişləri export et
// @access  Private
router.get('/export/csv', async (req, res) => {
  try {
    const { search, dateFrom, dateTo } = req.query;
    let query = { isActive: true };

    if (dateFrom || dateTo) {
      query.paymentDate = {};
      if (dateFrom) query.paymentDate.$gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.paymentDate.$lte = endDate;
      }
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const isNumeric = !isNaN(parseFloat(search)) && isFinite(search);
      if (isNumeric) {
        const num = parseFloat(search);
        query.$or = [{ paidAmount: num }, { amount: num }];
      } else {
        const matchingChildren = await Child.find({
          isActive: true,
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { fatherName: searchRegex },
            { motherName: searchRegex }
          ]
        }).select('_id');
        const childIds = matchingChildren.map((c) => c._id);
        if (childIds.length === 0) {
          return sendCsv(res, []);
        }
        query.child = { $in: childIds };
      }
    }

    const payments = await Payment.find(query)
      .populate({
        path: 'child',
        select: 'firstName lastName fatherName motherName startDate',
        populate: [{ path: 'package', select: 'name' }]
      })
      .sort({ paymentDate: -1 });

    return sendCsv(res, payments);
  } catch (error) {
    console.error('CSV export xətası:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

function sendCsv(res, payments) {
  const headers = [
    'ID',
    'Ad',
    'Soyad',
    'Valideynlər',
    'Paket',
    'Başlama Tarixi',
    'Ödəniş Tarixi',
    'Endirim (₼)',
    'Qiymətə Əlavə (₼)',
    'Ödənilən Məbləğ (₼)',
    'Qalıq (₼)',
    'Qeyd'
  ];

  const rows = payments.map((p, i) => {
    const c = p.child || {};
    const parents = [c.fatherName, c.motherName].filter(Boolean).join(', ');
    const startDate = c.startDate ? new Date(c.startDate).toLocaleDateString('az-AZ') : '';
    const paymentDate = p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('az-AZ') : '';
    const pkgName = c.package?.name || '';
    return [
      String(i + 1).padStart(3, '0'),
      c.firstName || '',
      c.lastName || '',
      parents,
      pkgName,
      startDate,
      paymentDate,
      p.discount || 0,
      p.extraPrice || 0,
      p.paidAmount || 0,
      p.remainingAfter || 0,
      (p.note || '').replace(/"/g, '""')
    ];
  });

  // CSV escape
  const escape = (v) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s}"`;
    }
    return s;
  };

  const csvLines = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(','))
  ];
  // UTF-8 BOM
  const csv = '\ufeff' + csvLines.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=payments-${Date.now()}.csv`);
  res.send(csv);
}

module.exports = router;
