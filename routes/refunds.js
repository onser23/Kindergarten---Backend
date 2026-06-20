const express = require('express');
const mongoose = require('mongoose');
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

    // childId validation
    if (childId && !mongoose.isValidObjectId(childId)) {
      return res.status(400).json({ success: false, message: 'Yanlış childId formatı' });
    }

    // Date validation
    let dateFromObj = null, dateToObj = null;
    if (dateFrom) {
      dateFromObj = new Date(dateFrom);
      if (isNaN(dateFromObj.getTime())) {
        return res.status(400).json({ success: false, message: 'Yanlış dateFrom formatı' });
      }
    }
    if (dateTo) {
      dateToObj = new Date(dateTo);
      if (isNaN(dateToObj.getTime())) {
        return res.status(400).json({ success: false, message: 'Yanlış dateTo formatı' });
      }
      dateToObj.setHours(23, 59, 59, 999);
    }

    // NaN-safe numeric parsing with caps
    const minAmountNum = minAmount ? parseFloat(minAmount) : null;
    const maxAmountNum = maxAmount ? parseFloat(maxAmount) : null;
    if (minAmount && isNaN(minAmountNum)) {
      return res.status(400).json({ success: false, message: 'Yanlış minAmount formatı' });
    }
    if (maxAmount && isNaN(maxAmountNum)) {
      return res.status(400).json({ success: false, message: 'Yanlış maxAmount formatı' });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));

    let query = { isActive: true };

    if (childId) {
      query.child = childId;
    }

    if (dateFromObj || dateToObj) {
      query.refundDate = {};
      if (dateFromObj) query.refundDate.$gte = dateFromObj;
      if (dateToObj) query.refundDate.$lte = dateToObj;
    }

    if (minAmountNum !== null || maxAmountNum !== null) {
      query.amount = {};
      if (minAmountNum !== null) query.amount.$gte = minAmountNum;
      if (maxAmountNum !== null) query.amount.$lte = maxAmountNum;
    }

    if (serviceMonth) {
      const payments = await Payment.find({ serviceMonth, isActive: true }).select('_id');
      const paymentIds = payments.map(p => p._id);
      if (paymentIds.length === 0) {
        return res.json({ success: true, data: [], total: 0, page: pageNum, totalPages: 0 });
      }
      query.originalPayment = { $in: paymentIds };
    }

    if (search && search.trim()) {
      const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const children = await Child.find({
        $or: [
          { firstName: re }, { lastName: re },
          { fatherName: re }, { motherName: re }
        ]
      }).select('_id');
      const childIds = children.map(c => c._id);
      if (childIds.length === 0) {
        return res.json({ success: true, data: [], total: 0, page: pageNum, totalPages: 0 });
      }
      query.child = { $in: childIds };
    }

    const sortObj = {};
    if (sort === 'amount') sortObj.amount = order === 'desc' ? -1 : 1;
    else sortObj.refundDate = order === 'desc' ? -1 : 1;

    const [total, refunds] = await Promise.all([
      Refund.countDocuments(query),
      Refund.find(query)
        .populate('child', 'firstName lastName fatherName motherName currentDebt isActive')
        .populate('originalPayment', 'paidAmount paymentDate serviceMonth')
        .populate('createdBy', 'username fullName')
        .sort(sortObj)
        .skip((pageNum - 1) * lim)
        .limit(lim)
    ]);

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
