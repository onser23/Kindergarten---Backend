const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Refund = require('../models/Refund');
const Child = require('../models/Child');
const Payment = require('../models/Payment');
const { getNextDisplayId } = require('../utils/idGenerator');

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

    const displayId = await getNextDisplayId('Refund');

    const refund = await Refund.create({
      child: child._id,
      originalPayment: originalPayment?._id || null,
      amount: req.body.amount,
      reason: req.body.reason,
      refundDate: req.body.refundDate,
      createdBy: req.user.id,
      notes: req.body.notes || '',
      displayId
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

// GET /api/refunds/by-child/:childId — Uşağın tarixçəsi
router.get('/by-child/:childId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.childId)) {
      return res.status(400).json({ success: false, message: 'Yanlış childId formatı' });
    }
    const refunds = await Refund.find({
      child: req.params.childId,
      isActive: true
    })
      .populate('originalPayment', 'paidAmount paymentDate serviceMonth')
      .populate('createdBy', 'username fullName')
      .sort({ refundDate: -1 });

    const totalAmount = refunds.reduce((sum, r) => sum + r.amount, 0);

    res.json({
      success: true,
      data: refunds,
      totalAmount,
      count: refunds.length
    });
  } catch (error) {
    console.error('GET /api/refunds/by-child/:childId error:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// GET /api/refunds/form-data — Modal üçün passiv uşaqlar
router.get('/form-data', async (req, res) => {
  try {
    const children = await Child.find({ isActive: false })
      .populate('package', 'name price duration')
      .select('firstName lastName fatherName motherName package passiveDate passiveReason currentDebt')
      .sort({ firstName: 1 });

    const childIds = children.map(c => c._id);
    const payments = await Payment.find({
      child: { $in: childIds },
      isActive: true
    })
      .select('child paidAmount paymentDate serviceMonth packageSnapshot')
      .sort({ paymentDate: -1 });

    const paymentsByChild = {};
    for (const c of children) {
      paymentsByChild[c._id.toString()] = [];
    }
    for (const p of payments) {
      const cid = p.child.toString();
      paymentsByChild[cid].push(p);
    }

    res.json({
      success: true,
      data: { children, paymentsByChild }
    });
  } catch (error) {
    console.error('GET /api/refunds/form-data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// GET /api/refunds/export/csv — CSV export
router.get('/export/csv', async (req, res) => {
  try {
    const { search, dateFrom, dateTo, serviceMonth, minAmount, maxAmount } = req.query;
    let query = { isActive: true };

    // Date validation (with end-of-day for dateTo)
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

    if (dateFromObj || dateToObj) {
      query.refundDate = {};
      if (dateFromObj) query.refundDate.$gte = dateFromObj;
      if (dateToObj) query.refundDate.$lte = dateToObj;
    }

    const minAmountNum = minAmount ? parseFloat(minAmount) : null;
    const maxAmountNum = maxAmount ? parseFloat(maxAmount) : null;
    if (minAmount && isNaN(minAmountNum)) {
      return res.status(400).json({ success: false, message: 'Yanlış minAmount formatı' });
    }
    if (maxAmount && isNaN(maxAmountNum)) {
      return res.status(400).json({ success: false, message: 'Yanlış maxAmount formatı' });
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
        const emptyCsv = '\uFEFF' + ['ID', 'Uşaq', 'Məbləğ'].join(',') + '\n';
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=refunds-${Date.now()}.csv`);
        return res.send(emptyCsv);
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
        const emptyCsv = '\uFEFF' + ['ID', 'Uşaq', 'Məbləğ'].join(',') + '\n';
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=refunds-${Date.now()}.csv`);
        return res.send(emptyCsv);
      }
      query.child = { $in: childIds };
    }

    const refunds = await Refund.find(query)
      .populate('child', 'firstName lastName fatherName motherName')
      .populate('originalPayment', 'paidAmount paymentDate serviceMonth')
      .populate('createdBy', 'username')
      .sort({ refundDate: -1 });

    let csv = '\uFEFF';
    csv += [
      'ID', 'Uşaq', 'Ata adı', 'Ana adı',
      'Orijinal Ödəniş (₼)', 'Qaytarılan (₼)',
      'Qaytarma Tarixi', 'Səbəb', 'Qeyd', 'Yaradan Admin'
    ].join(',') + '\n';

    for (const r of refunds) {
      csv += [
        r._id.toString(),
        `"${(r.child?.lastName || '').replace(/"/g, '""')} ${(r.child?.firstName || '').replace(/"/g, '""')}"`,
        `"${(r.child?.fatherName || '').replace(/"/g, '""')}"`,
        `"${(r.child?.motherName || '').replace(/"/g, '""')}"`,
        r.originalPayment?.paidAmount ?? '',
        r.amount,
        new Date(r.refundDate).toISOString().slice(0, 10),
        `"${r.reason.replace(/"/g, '""')}"`,
        `"${r.notes.replace(/"/g, '""')}"`,
        r.createdBy?.username || ''
      ].join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=refunds-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('GET /api/refunds/export/csv error:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// GET /api/refunds/:id — Tək refund
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Yanlış id formatı' });
    }
    const refund = await Refund.findById(req.params.id)
      .populate('child', 'firstName lastName fatherName motherName currentDebt isActive passiveDate passiveReason')
      .populate('originalPayment')
      .populate('createdBy', 'username fullName');
    if (!refund) {
      return res.status(404).json({ success: false, message: 'Refund tapılmadı' });
    }
    res.json({ success: true, data: refund });
  } catch (error) {
    console.error('GET /api/refunds/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// PUT /api/refunds/:id — Redaktə
router.put('/:id', [
  body('amount').optional().isFloat({ min: 0.01 }),
  body('reason').optional().isString().trim().isLength({ min: 3, max: 500 }),
  body('refundDate').optional().isISO8601(),
  body('notes').optional().isString().trim().isLength({ max: 500 })
], async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Yanlış id formatı' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const refund = await Refund.findById(req.params.id);
    if (!refund || !refund.isActive) {
      return res.status(404).json({ success: false, message: 'Aktiv refund tapılmadı' });
    }

    // Immutable: child, originalPayment, createdBy dəyişmir
    if (req.body.amount !== undefined) refund.amount = req.body.amount;
    if (req.body.reason !== undefined) refund.reason = req.body.reason;
    if (req.body.refundDate !== undefined) refund.refundDate = req.body.refundDate;
    if (req.body.notes !== undefined) refund.notes = req.body.notes;

    await refund.save();

    const populated = await Refund.findById(refund._id)
      .populate('child', 'firstName lastName fatherName currentDebt isActive')
      .populate('originalPayment', 'paidAmount paymentDate serviceMonth')
      .populate('createdBy', 'username fullName');

    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('PUT /api/refunds/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

// DELETE /api/refunds/:id — Soft delete
router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Yanlış id formatı' });
    }
    const refund = await Refund.findById(req.params.id);
    if (!refund || !refund.isActive) {
      return res.status(404).json({ success: false, message: 'Aktiv refund tapılmadı' });
    }

    refund.isActive = false;
    await refund.save();

    res.json({ success: true, data: refund });
  } catch (error) {
    console.error('DELETE /api/refunds/:id error:', error);
    res.status(500).json({
      success: false,
      message: 'Server xətası',
      error: error.message
    });
  }
});

module.exports = router;
