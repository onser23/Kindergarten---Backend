const express = require('express');
const { body, validationResult } = require('express-validator');
const Refund = require('../models/Refund');
const Child = require('../models/Child');
const Payment = require('../models/Payment');

const router = express.Router();

// POST /api/refunds — Yeni refund yarat
router.post('/', [
  body('child').notEmpty().withMessage('Uşaq tələb olunur').isMongoId(),
  body('refundDate').isISO8601().withMessage('Düzgün tarix formatı'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Məbləğ ən az 0.01 olmalıdır'),
  body('reason').isString().trim().isLength({ min: 3, max: 500 }).withMessage('Səbəb 3-500 simvol aralığında olmalıdır'),
  body('notes').optional().isString().trim().isLength({ max: 500 }),
  body('originalPayment').optional().isMongoId()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const child = await Child.findById(req.body.child);
    if (!child) {
      return res.status(404).json({ success: false, message: 'Uşaq tapılmadı' });
    }

    // YALNIZ PASSIV uşaqlar üçün
    if (child.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Yalnız passiv (baxçadan ayrılmış) uşaqlar üçün refund edilə bilər'
      });
    }

    // OriginalPayment validation (optional)
    let originalPayment = null;
    if (req.body.originalPayment) {
      originalPayment = await Payment.findById(req.body.originalPayment);
      if (!originalPayment) {
        return res.status(404).json({ success: false, message: 'Orijinal ödəniş tapılmadı' });
      }
      if (!originalPayment.child.equals(child._id)) {
        return res.status(400).json({
          success: false,
          message: 'Orijinal ödəniş bu uşağa aid deyil'
        });
      }
    }

    const refund = await Refund.create({
      child: child._id,
      originalPayment: originalPayment?._id || null,
      amount: req.body.amount,
      reason: req.body.reason,
      refundDate: req.body.refundDate,
      createdBy: req.user.id,
      notes: req.body.notes || ''
    });

    const populated = await Refund.findById(refund._id)
      .populate('child', 'firstName lastName fatherName currentDebt isActive')
      .populate('originalPayment', 'paidAmount paymentDate serviceMonth')
      .populate('createdBy', 'username fullName');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('POST /api/refunds error:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// GET /api/refunds — Filter ilə siyahı
router.get('/', async (req, res) => {
  try {
    const {
      search, childId, dateFrom, dateTo,
      serviceMonth, minAmount, maxAmount,
      page = 1, limit = 15,
      sort = 'refundDate', order = 'desc'
    } = req.query;

    let query = { isActive: true };

    if (childId) {
      query.child = childId;
    }

    if (dateFrom || dateTo) {
      query.refundDate = {};
      if (dateFrom) query.refundDate.$gte = new Date(dateFrom);
      if (dateTo) query.refundDate.$lte = new Date(dateTo);
    }

    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }

    if (serviceMonth) {
      const payments = await Payment.find({ serviceMonth }).select('_id');
      const paymentIds = payments.map(p => p._id);
      if (paymentIds.length === 0) {
        return res.json({ success: true, data: [], total: 0, page: 1, totalPages: 0 });
      }
      query.originalPayment = { $in: paymentIds };
    }

    if (search && search.trim()) {
      const re = new RegExp(search.trim(), 'i');
      const children = await Child.find({
        $or: [
          { firstName: re }, { lastName: re },
          { fatherName: re }, { motherName: re }
        ]
      }).select('_id');
      const childIds = children.map(c => c._id);
      if (childIds.length === 0) {
        return res.json({ success: true, data: [], total: 0, page: 1, totalPages: 0 });
      }
      query.child = { $in: childIds };
    }

    const sortObj = {};
    if (sort === 'amount') sortObj.amount = order === 'desc' ? -1 : 1;
    else sortObj.refundDate = order === 'desc' ? -1 : 1;

    const pageNum = parseInt(page);
    const lim = parseInt(limit);
    const total = await Refund.countDocuments(query);
    const refunds = await Refund.find(query)
      .populate('child', 'firstName lastName fatherName motherName currentDebt isActive')
      .populate('originalPayment', 'paidAmount paymentDate serviceMonth')
      .populate('createdBy', 'username fullName')
      .sort(sortObj)
      .skip((pageNum - 1) * lim)
      .limit(lim);

    res.json({
      success: true,
      data: refunds,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / lim)
    });
  } catch (error) {
    console.error('GET /api/refunds error:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

module.exports = router;
