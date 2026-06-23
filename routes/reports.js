const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Payment = require('../models/Payment');

const VALID_MODES = ['monthly', 'weekly', 'daily'];
const MAX_RANGE_DAYS = { monthly: 365, weekly: 182, daily: 365 };

function parseDate(s) {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfISOWeek(d) {
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function defaultDates(mode) {
  const now = new Date();
  if (mode === 'monthly') {
    return { dateFrom: startOfMonth(now), dateTo: endOfMonth(now) };
  }
  if (mode === 'weekly') {
    return { dateFrom: startOfISOWeek(now), dateTo: now };
  }
  // daily
  const thirtyAgo = new Date(now);
  thirtyAgo.setDate(now.getDate() - 30);
  return { dateFrom: thirtyAgo, dateTo: now };
}

function buildPeriodFormat(mode) {
  if (mode === 'monthly') return '%Y-%m';
  if (mode === 'weekly') return '%G-W%V';
  return '%Y-%m-%d';
}

function getMaxDays(mode) {
  return { monthly: 365, weekly: 182, daily: 365 }[mode];
}

router.get('/revenue', async (req, res) => {
  try {
    const mode = req.query.mode;
    if (!VALID_MODES.includes(mode)) {
      return res.status(400).json({ success: false, message: 'Düzgün mode daxil edin (monthly, weekly, daily)' });
    }

    const defaults = defaultDates(mode);
    const dateFrom = req.query.dateFrom ? parseDate(req.query.dateFrom) : defaults.dateFrom;
    const dateTo = req.query.dateTo ? parseDate(req.query.dateTo) : defaults.dateTo;

    if (!dateFrom || !dateTo) {
      return res.status(400).json({ success: false, message: 'Düzgün tarix formatı daxil edin (YYYY-MM-DD)' });
    }
    if (dateFrom > dateTo) {
      return res.status(400).json({ success: false, message: 'Başlanğıc tarixi bitmə tarixindən böyük ola bilməz' });
    }

    const maxDays = getMaxDays(mode);
    const rangeDays = Math.ceil((dateTo - dateFrom) / 86400000);
    if (rangeDays > maxDays) {
      const limits = { monthly: '12 ay', weekly: '26 həftə', daily: '365 gün' };
      return res.status(400).json({
        success: false,
        message: `${mode.charAt(0).toUpperCase() + mode.slice(1)} rejimdə maksimum ${limits[mode]} aralığı seçilə bilər`,
      });
    }

    const aggregation = [
      {
        $match: {
          paymentDate: { $gte: dateFrom, $lte: dateTo },
          isActive: true,
          'packageSnapshot._id': { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: {
            packageId: '$packageSnapshot._id',
            packageName: '$packageSnapshot.name',
            period: { $dateToString: { format: buildPeriodFormat(mode), date: '$paymentDate' } },
          },
          revenue: { $sum: '$paidAmount' },
        },
      },
      {
        $project: {
          _id: 0,
          packageId: '$_id.packageId',
          packageName: '$_id.packageName',
          period: '$_id.period',
          revenue: 1,
        },
      },
      { $sort: { period: -1, packageName: 1 } },
    ];

    const data = await Payment.aggregate(aggregation);
    const totalRevenue = data.reduce((sum, row) => sum + row.revenue, 0);

    res.json({
      data,
      totalRevenue,
      totalRows: data.length,
      mode,
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
    });
  } catch (err) {
    console.error('Revenue aggregation error:', err);
    res.status(500).json({ success: false, message: 'Hesabat yüklənə bilmədi', error: err.message });
  }
});

module.exports = router;