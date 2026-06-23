const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Child = require('../models/Child');
const Package = require('../models/Package');
const { body, validationResult } = require('express-validator');
const { getNextDisplayId } = require('../utils/idGenerator');

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

// @route   GET /api/payments/preview
// @desc    Ana dashboard üçün pending və ya paid preview (limit param)
// @access  Private
router.get('/preview', async (req, res) => {
  try {
    const { type, limit = 10 } = req.query;
    if (!type || !['pending', 'paid'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type param tələb olunur: pending | paid'
      });
    }
    const lim = Math.min(parseInt(limit, 10) || 10, 100);

    if (type === 'paid') {
      const payments = await Payment.find({ isActive: true })
        .populate({
          path: 'child',
          select: 'firstName lastName fatherName motherName startDate package currentDebt',
          populate: [{ path: 'package', select: 'name price' }]
        })
        .sort({ paymentDate: -1, createdAt: -1 })
        .limit(lim);
      return res.json({ success: true, count: payments.length, data: payments });
    }

    // type === 'pending'
    const allChildren = await Child.find({ isActive: true })
      .populate('package', 'name price days duration');

    const pending = [];
    for (const child of allChildren) {
      if (child.currentDebt > 0) {
        pending.push({ child, reason: 'debt', nextDue: new Date() });
        continue;
      }
      if (child.currentDebt < 0) {
        // Ailədə kredit qalığı var — baxça borcludur, ödəniş tələb olunmur
        continue;
      }
      const pkg = child.package;
      if (!pkg) continue;
      // Günlük paket üçün pending yaranmır
      if (pkg.duration === 'Günlük') continue;
      // nextDueDate field-ini istifadə et (varsa), yoxsa dinamik fallback
      let nextDue;
      if (child.nextDueDate) {
        nextDue = new Date(child.nextDueDate);
      } else {
        // Fallback: legacy data üçün dinamik hesablama
        const lastPayment = await Payment.findOne({ child: child._id, isActive: true })
          .sort({ paymentDate: -1 });
        const lastDate = lastPayment ? lastPayment.paymentDate : child.startDate;
        nextDue = new Date(lastDate);
        nextDue.setDate(nextDue.getDate() + (pkg.days || 30));
      }
      const threeDaysBefore = new Date(nextDue);
      threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
      if (new Date() >= threeDaysBefore) {
        pending.push({ child, reason: 'due', nextDue });
      }
    }

    pending.sort((a, b) => {
      if (a.reason === 'debt' && b.reason !== 'debt') return -1;
      if (a.reason !== 'debt' && b.reason === 'debt') return 1;
      return a.nextDue - b.nextDue;
    });

    const limited = pending.slice(0, lim);
    const data = limited.map((p) => ({
      ...p.child.toObject(),
      currentDebt: p.child.currentDebt,
      package: p.child.package,
      nextDueDate: p.nextDue
    }));

    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error('Preview xətası:', error);
    res.status(500).json({ success: false, message: 'Server xətası', error: error.message });
  }
});

// @route   GET /api/payments
// @desc    Tam pending və ya paid siyahısı (filter + pagination)
// @access  Private
router.get('/', async (req, res) => {
  try {
    const {
      type, page = 1, limit = 15, search, sort = 'nextDue', order = 'asc',
      package: pkgFilter, group: grpFilter, debtMin, debtMax,
      dateFrom, dateTo, preset, serviceMonth
    } = req.query;

    if (!type || !['pending', 'paid'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type param tələb olunur: pending | paid'
      });
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const lim = Math.min(Math.max(parseInt(limit, 10) || 15, 1), 100);
    const skip = (pageNum - 1) * lim;

    if (type === 'paid') {
      const query = { isActive: true };
      if (serviceMonth) query.serviceMonth = serviceMonth;
      if (preset) {
        const now = new Date();
        if (preset === 'today') {
          const s = new Date(now); s.setHours(0, 0, 0, 0);
          const e = new Date(now); e.setHours(23, 59, 59, 999);
          query.paymentDate = { $gte: s, $lte: e };
        } else if (preset === 'week') {
          const s = new Date(now); s.setDate(s.getDate() - 7); s.setHours(0, 0, 0, 0);
          query.paymentDate = { $gte: s };
        } else if (preset === 'month') {
          const s = new Date(now.getFullYear(), now.getMonth(), 1);
          query.paymentDate = { $gte: s };
        }
      } else if (dateFrom || dateTo) {
        query.paymentDate = {};
        if (dateFrom) query.paymentDate.$gte = new Date(dateFrom);
        if (dateTo) {
          const e = new Date(dateTo); e.setHours(23, 59, 59, 999);
          query.paymentDate.$lte = e;
        }
      }
      if (search && search.trim()) {
        const re = new RegExp(search.trim(), 'i');
        const isNum = !isNaN(parseFloat(search)) && isFinite(search);
        if (isNum) {
          const n = parseFloat(search);
          query.$or = [{ paidAmount: n }, { amount: n }];
        } else {
          const m = await Child.find({
            isActive: true,
            $or: [
              { firstName: re }, { lastName: re },
              { fatherName: re }, { motherName: re }
            ]
          }).select('_id');
          const ids = m.map((c) => c._id);
          if (ids.length === 0) {
            return res.json({ success: true, count: 0, total: 0, page: pageNum, totalPages: 0, data: [] });
          }
          query.child = { $in: ids };
        }
      }
      let sortObj = { paymentDate: -1, createdAt: -1 };
      if (sort === 'name') sortObj = { 'child.lastName': order === 'asc' ? 1 : -1 };
      else if (sort === 'amount') sortObj = { paidAmount: order === 'asc' ? 1 : -1 };
      const [total, payments] = await Promise.all([
        Payment.countDocuments(query),
        Payment.find(query)
          .populate({
            path: 'child',
            select: 'firstName lastName fatherName motherName startDate package group currentDebt',
            populate: [
              { path: 'package', select: 'name price' },
              { path: 'group', select: 'name' }
            ]
          })
          .sort(sortObj).skip(skip).limit(lim)
      ]);
      return res.json({
        success: true, count: payments.length, total,
        page: pageNum, totalPages: Math.ceil(total / lim), data: payments
      });
    }

    // type === 'pending'
    let childQuery = { isActive: true };
    if (pkgFilter) childQuery.package = pkgFilter;
    if (grpFilter) childQuery.group = grpFilter;
    if (search && search.trim()) {
      const re = new RegExp(search.trim(), 'i');
      childQuery.$or = [
        { firstName: re }, { lastName: re },
        { fatherName: re }, { motherName: re }
      ];
    }
    const allChildren = await Child.find(childQuery).populate('package', 'name price days duration');
    const pending = [];
    for (const child of allChildren) {
      if (debtMin !== undefined && child.currentDebt < parseFloat(debtMin)) continue;
      if (debtMax !== undefined && child.currentDebt > parseFloat(debtMax)) continue;
      if (child.currentDebt < 0) continue;
      if (child.currentDebt > 0) {
        pending.push({ child, reason: 'debt', nextDue: new Date() });
        continue;
      }
      const pkg = child.package;
      if (!pkg) continue;
      // Günlük paket üçün pending yaranmır
      if (pkg.duration === 'Günlük') continue;
      // nextDueDate field-ini istifadə et (varsa), yoxsa dinamik fallback
      let nextDue;
      if (child.nextDueDate) {
        nextDue = new Date(child.nextDueDate);
      } else {
        // Fallback: legacy data üçün dinamik hesablama
        const lastP = await Payment.findOne({ child: child._id, isActive: true })
          .sort({ paymentDate: -1 });
        const last = lastP ? lastP.paymentDate : child.startDate;
        nextDue = new Date(last);
        nextDue.setDate(nextDue.getDate() + (pkg.days || 30));
      }
      const tdb = new Date(nextDue);
      tdb.setDate(tdb.getDate() - 3);
      if (new Date() >= tdb) {
        pending.push({ child, reason: 'due', nextDue });
      }
    }
    pending.sort((a, b) => {
      if (sort === 'name') {
        return order === 'desc'
          ? b.child.lastName.localeCompare(a.child.lastName)
          : a.child.lastName.localeCompare(b.child.lastName);
      }
      if (sort === 'debt') {
        return order === 'asc'
          ? a.child.currentDebt - b.child.currentDebt
          : b.child.currentDebt - a.child.currentDebt;
      }
      return a.nextDue - b.nextDue;
    });
    const total = pending.length;
    const totalPages = Math.ceil(total / lim);
    const slice = pending.slice(skip, skip + lim);
    const data = slice.map((p) => ({ ...p.child.toObject(), nextDueDate: p.nextDue }));
    return res.json({ success: true, count: data.length, total, page: pageNum, totalPages, data });
  } catch (error) {
    console.error('Ödənişlər siyahısı xətası:', error);
    res.status(500).json({ success: false, message: 'Server xətası', error: error.message });
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
        select: 'firstName lastName fatherName motherName startDate package currentDebt',
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
// @desc    Yeni ödəniş əlavə et (overpayment/avans ödənişinə icazə verilir)
// @access  Private
router.post('/', [
  body('child').notEmpty().withMessage('Uşaq tələb olunur'),
  body('paidAmount').isFloat({ min: 0 }).withMessage('Ödənilən məbləğ düzgün deyil'),
  body('paymentDate').isISO8601().withMessage('Düzgün tarix formatı'),
  body('serviceMonth')
    .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
    .withMessage('Xidmət ayı düzgün formatda deyil (YYYY-MM)'),
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
    const { serviceMonth } = req.body;

    const child = await Child.findById(childId).populate('package', 'price name days duration').session(session);
    if (!child || !child.isActive) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Uşaq tapılmadı'
      });
    }

    const packageSnapshot = child.package ? {
      _id: child.package._id,
      name: child.package.name,
      price: child.package.price
    } : null;

    const packagePrice = child.package?.price || 0;
    const disc = parseFloat(discount || 0);
    const extra = parseFloat(extraPrice || 0);
    const amount = packagePrice + extra - disc;
    const paid = parseFloat(paidAmount);

    const realPayment = paid + disc - extra;

    const remainingBefore = child.currentDebt || 0;
    // Mənfi qalıq = baxçanın ailəyə borcu (avans/kredit) — qəsdən dəstəklənir
    const remainingAfter = remainingBefore - realPayment;

    const payment = await Payment.create([{
      child: childId,
      packageSnapshot,
      amount,
      discount: disc,
      extraPrice: extra,
      paidAmount: paid,
      paymentDate,
      serviceMonth,
      note: note || '',
      remainingBefore,
      remainingAfter
    }], { session });

    child.currentDebt = remainingAfter;
    // nextDueDate advance et (Günlük paket üçün null)
    if (child.package && child.package.duration === 'Günlük') {
      child.nextDueDate = null;
    } else if (child.package && child.package.days) {
      const newNextDue = new Date(paymentDate);
      newNextDue.setDate(newNextDue.getDate() + child.package.days);
      child.nextDueDate = newNextDue;
    }
    await child.save({ session });

    await session.commitTransaction();
    session.endSession();

    // ✅ Counter increment olunur YALNIZ commit uğurlu olduqdan sonra
    // (əvvəlki seq=5 commit-ə qədər artırılırdısa, transaction abort olsaydı
    //  orphan seq qalırdı — yəni seq=6 heç bir Payment-ə aid deyildi)
    const displayId = await getNextDisplayId('Payment');
    await Payment.findByIdAndUpdate(payment[0]._id, { displayId }, { new: true });

    const populatedPayment = await Payment.findById(payment[0]._id)
      .populate({
        path: 'child',
        select: 'firstName lastName fatherName motherName startDate package',
        populate: [{ path: 'package', select: 'name price' }]
      });

    res.status(201).json({
      success: true,
      message: remainingAfter < 0
        ? `Ödəniş uğurla əlavə edildi (avans: ${Math.abs(remainingAfter)} ₼)`
        : 'Ödəniş uğurla əlavə edildi',
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
// @desc    Ödənişi redaktə et (mürəkkəb məntiqlə, overpayment dəstəyi ilə)
// @access  Private
router.put('/:id', [
  body('paidAmount').optional().isFloat({ min: 0 }).withMessage('Ödənilən məbləğ düzgün deyil'),
  body('paymentDate').optional().isISO8601().withMessage('Düzgün tarix formatı'),
  body('discount').optional().isFloat({ min: 0 }).withMessage('Endirim düzgün deyil'),
  body('extraPrice').optional().isFloat({ min: 0 }).withMessage('Əlavə qiymət düzgün deyil'),
  body('note').optional().isLength({ max: 500 }).withMessage('Qeyd 500 simvoldan çox ola bilməz'),
  body('updatedReason')
    .trim()
    .notEmpty()
    .withMessage('Redaktə səbəbi tələb olunur')
    .isLength({ max: 500 })
    .withMessage('Redaktə səbəbi 500 simvoldan çox ola bilməz')
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

    const oldPayment = await Payment.findById(req.params.id).session(session);
    if (!oldPayment || !oldPayment.isActive) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Ödəniş tapılmadı'
      });
    }

    const child = await Child.findById(oldPayment.child)
      .populate('package', 'price name days duration')
      .session(session);
    if (!child) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Uşaq tapılmadı'
      });
    }

    // Köhnə ödənişi geri qaytar (real ödəniş: paidAmount + discount - extraPrice)
    const oldRealPayment = (oldPayment.paidAmount || 0)
      + (oldPayment.discount || 0)
      - (oldPayment.extraPrice || 0);
    child.currentDebt = (child.currentDebt || 0) + oldRealPayment;

    const newDiscount = req.body.discount !== undefined ? parseFloat(req.body.discount) : oldPayment.discount;
    const newExtraPrice = req.body.extraPrice !== undefined ? parseFloat(req.body.extraPrice) : oldPayment.extraPrice;
    const newPaidAmount = req.body.paidAmount !== undefined ? parseFloat(req.body.paidAmount) : oldPayment.paidAmount;
    const newPaymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : oldPayment.paymentDate;
    const newNote = req.body.note !== undefined ? req.body.note : oldPayment.note;
    const newUpdatedReason = req.body.updatedReason !== undefined ? req.body.updatedReason.trim() : oldPayment.updatedReason;

    const packagePrice = child.package?.price || 0;
    const newAmount = packagePrice + newExtraPrice - newDiscount;

    const newRealPayment = newPaidAmount + newDiscount - newExtraPrice;

    const remainingBefore = child.currentDebt;
    // Mənfi qalıq = baxçanın ailəyə borcu (avans/kredit) — qəsdən dəstəklənir
    const remainingAfter = remainingBefore - newRealPayment;

    oldPayment.amount = newAmount;
    oldPayment.discount = newDiscount;
    oldPayment.extraPrice = newExtraPrice;
    oldPayment.paidAmount = newPaidAmount;
    oldPayment.paymentDate = newPaymentDate;
    oldPayment.note = newNote;
    oldPayment.updatedReason = newUpdatedReason;
    oldPayment.remainingBefore = remainingBefore;
    oldPayment.remainingAfter = remainingAfter;
    oldPayment.updatedAt = Date.now();
    await oldPayment.save({ session });

    child.currentDebt = remainingAfter;
    // nextDueDate advance et (Günlük paket üçün null)
    if (child.package && child.package.duration === 'Günlük') {
      child.nextDueDate = null;
    } else if (child.package && child.package.days) {
      const newNextDue = new Date(newPaymentDate);
      newNextDue.setDate(newNextDue.getDate() + child.package.days);
      child.nextDueDate = newNextDue;
    }
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
      message: remainingAfter < 0
        ? `Ödəniş uğurla yeniləndi (avans: ${Math.abs(remainingAfter)} ₼)`
        : 'Ödəniş uğurla yeniləndi',
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

// @route   GET /api/payments/export/csv
// @desc    CSV formatında export (type: pending | paid | all)
// @access  Private
router.get('/export/csv', async (req, res) => {
  try {
    const {
      type, search, dateFrom, dateTo, preset, serviceMonth,
      package: pkgFilter, group: grpFilter, debtMin, debtMax
    } = req.query;

    if (!type || !['pending', 'paid', 'all'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type param tələb olunur: pending | paid | all'
      });
    }

    const bom = '\ufeff';
    const escape = (v) => {
      const s = String(v ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('az-AZ') : '';

    const headers = [
      'STATUS', 'ID', 'Ad', 'Soyad', 'Valideynlər', 'Paket',
      'Paket (tarixi)',
      'Başlama Tarixi', 'Xidmət Ayı', 'Ödəniş Tarixi',
      'Endirim (₼)', 'Qiymətə Əlavə (₼)', 'Ödənilən Məbləğ (₼)',
      'Borc (₼)', 'Qalıq (₼)', 'Redaktə Səbəbi', 'Qeyd'
    ];

    const rows = [];

    if (type === 'paid' || type === 'all') {
      const q = { isActive: true };
      if (serviceMonth) q.serviceMonth = serviceMonth;
      if (preset === 'today') {
        const s = new Date(); s.setHours(0, 0, 0, 0);
        const e = new Date(); e.setHours(23, 59, 59, 999);
        q.paymentDate = { $gte: s, $lte: e };
      } else if (preset === 'week') {
        const s = new Date(); s.setDate(s.getDate() - 7); s.setHours(0, 0, 0, 0);
        q.paymentDate = { $gte: s };
      } else if (preset === 'month') {
        q.paymentDate = { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) };
      } else if (dateFrom || dateTo) {
        q.paymentDate = {};
        if (dateFrom) q.paymentDate.$gte = new Date(dateFrom);
        if (dateTo) {
          const e = new Date(dateTo); e.setHours(23, 59, 59, 999);
          q.paymentDate.$lte = e;
        }
      }
      if (search && search.trim()) {
        const re = new RegExp(search.trim(), 'i');
        const isNum = !isNaN(parseFloat(search)) && isFinite(search);
        if (isNum) {
          const n = parseFloat(search);
          q.$or = [{ paidAmount: n }, { amount: n }];
        } else {
          const m = await Child.find({
            isActive: true,
            $or: [
              { firstName: re }, { lastName: re },
              { fatherName: re }, { motherName: re }
            ]
          }).select('_id');
          q.child = { $in: m.map((c) => c._id) };
        }
      }
      const payments = await Payment.find(q)
        .populate({
          path: 'child',
          select: 'firstName lastName fatherName motherName startDate package currentDebt',
          populate: [{ path: 'package', select: 'name' }]
        })
        .sort({ paymentDate: -1 });
      for (const p of payments) {
        const c = p.child || {};
        const parents = [c.fatherName, c.motherName].filter(Boolean).join(', ');
        const qaliq = p.remainingAfter || 0;
        const pkgName = p.packageSnapshot?.name || c.package?.name || '';
        rows.push([
          'Ödənilib',
          p.displayId || '—',
          c.firstName || '', c.lastName || '', parents,
          c.package?.name || '',
          pkgName,
          fmtDate(c.startDate),
          p.serviceMonth || '',
          fmtDate(p.paymentDate),
          p.discount || 0, p.extraPrice || 0, p.paidAmount || 0,
          c.currentDebt ?? 0, qaliq < 0 ? `Avans: ${Math.abs(qaliq)}` : qaliq,
          p.updatedReason || '',
          p.note || ''
        ]);
      }
    }

    if (type === 'pending' || type === 'all') {
      let cq = { isActive: true };
      if (pkgFilter) cq.package = pkgFilter;
      if (grpFilter) cq.group = grpFilter;
      if (search && search.trim()) {
        const re = new RegExp(search.trim(), 'i');
        cq.$or = [
          { firstName: re }, { lastName: re },
          { fatherName: re }, { motherName: re }
        ];
      }
      const allChildren = await Child.find(cq).populate('package', 'name days');
      for (const child of allChildren) {
        if (child.currentDebt < 0) continue;
        if (debtMin !== undefined && child.currentDebt < parseFloat(debtMin)) continue;
        if (debtMax !== undefined && child.currentDebt > parseFloat(debtMax)) continue;
        const isDebt = child.currentDebt > 0;
        if (!isDebt) {
          const lastP = await Payment.findOne({ child: child._id, isActive: true })
            .sort({ paymentDate: -1 });
          const pkg = child.package;
          if (pkg) {
            const last = lastP ? lastP.paymentDate : child.startDate;
            const nd = new Date(last);
            nd.setDate(nd.getDate() + (pkg.days || 30));
            const tdb = new Date(nd); tdb.setDate(tdb.getDate() - 3);
            if (new Date() < tdb) continue;
          }
        }
        const parents = [child.fatherName, child.motherName].filter(Boolean).join(', ');
        rows.push([
          'Gözləyən',
          child.displayId || '—',
          child.firstName, child.lastName, parents,
          child.package?.name || '',
          '',
          fmtDate(child.startDate), '', '',
          '', '', '',
          child.currentDebt, '',
          '', ''
        ]);
      }
    }

    const csv = bom + [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=payments-${type}-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('CSV export xətası:', error);
    res.status(500).json({ success: false, message: 'Server xətası', error: error.message });
  }
});

module.exports = router;
