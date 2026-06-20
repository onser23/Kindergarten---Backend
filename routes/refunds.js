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
    if (originalPayment.child.toString() !== child._id.toString()) {
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
});

module.exports = router;
