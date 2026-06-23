const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');

const MAX_RANGE = {
  monthly: { days: 365, label: '12 ay' },
  weekly:  { days: 182, label: '26 həftə' },
  daily:   { days: 365, label: '365 gün' },
};
const VALID_MODES = Object.keys(MAX_RANGE);

function parseDate(s, endOfDay = false) {
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
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

async function runRevenueQuery(query, res) {
  const mode = query.mode;
  if (!VALID_MODES.includes(mode)) {
    res.status(400).json({ success: false, message: 'Düzgün mode daxil edin (monthly, weekly, daily)' });
    return null;
  }

  const defaults = defaultDates(mode);
  const dateFrom = query.dateFrom ? parseDate(query.dateFrom) : defaults.dateFrom;
  const dateTo = query.dateTo ? parseDate(query.dateTo, true) : defaults.dateTo;

  if (!dateFrom || !dateTo) {
    res.status(400).json({ success: false, message: 'Düzgün tarix formatı daxil edin (YYYY-MM-DD)' });
    return null;
  }
  if (dateFrom > dateTo) {
    res.status(400).json({ success: false, message: 'Başlanğıc tarixi bitmə tarixindən böyük ola bilməz' });
    return null;
  }

  const maxDays = MAX_RANGE[mode].days;
  const rangeDays = Math.ceil((dateTo - dateFrom) / 86400000);
  if (rangeDays > maxDays) {
    res.status(400).json({
      success: false,
      message: `${mode.charAt(0).toUpperCase() + mode.slice(1)} rejimdə maksimum ${MAX_RANGE[mode].label} aralığı seçilə bilər`,
    });
    return null;
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

  return { data, totalRevenue, mode, dateFrom, dateTo };
}

router.get('/revenue', async (req, res) => {
  try {
    const result = await runRevenueQuery(req.query, res);
    if (!result) return;
    res.json({
      data: result.data,
      totalRevenue: result.totalRevenue,
      totalRows: result.data.length,
      mode: result.mode,
      dateFrom: result.dateFrom.toISOString(),
      dateTo: result.dateTo.toISOString(),
    });
  } catch (err) {
    console.error('Revenue aggregation error:', err);
    res.status(500).json({ success: false, message: 'Hesabat yüklənə bilmədi', error: err.message });
  }
});

router.get('/revenue/export/csv', async (req, res) => {
  try {
    const result = await runRevenueQuery(req.query, res);
    if (!result) return;
    const { data, totalRevenue, mode } = result;

    const BOM = '\uFEFF';
    const headers = ['Paket ID', 'Paket Adı', 'Dövr', 'Cəm Gəlir (₼)'];
    const rows = data.map((row) => [
      row.packageId,
      `"${row.packageName.replace(/"/g, '""')}"`,
      row.period,
      row.revenue.toFixed(2),
    ].join(','));
    const totalRow = ['CƏM', '', '', totalRevenue.toFixed(2)].join(',');

    const csv = BOM + [headers.join(','), ...rows, totalRow].join('\n');
    const today = new Date().toISOString().split('T')[0];
    const filename = `revenue-${mode}-${today}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('Revenue CSV error:', err);
    res.status(500).json({ success: false, message: 'CSV export uğursuz oldu', error: err.message });
  }
});

module.exports = router;