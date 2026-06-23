const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Package = require('../models/Package');
const Child = require('../models/Child');
const Group = require('../models/Group');
const reportsRouter = require('../routes/reports');

jest.mock('../middleware/auth', () => {
  const mockMongoose = require('mongoose');
  return (req, res, next) => {
    req.user = { id: new mockMongoose.Types.ObjectId(), role: 'admin' };
    next();
  };
});

const app = express();
app.use(express.json());
app.use('/api/reports', reportsRouter);
const setup = require('./setup');

describe('GET /api/reports/revenue', () => {
  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => await setup.clear());

  describe('monthly mode', () => {
    it('returns empty data and totalRevenue=0 for empty DB', async () => {
      const res = await request(app).get('/api/reports/revenue?mode=monthly');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.totalRevenue).toBe(0);
      expect(res.body.totalRows).toBe(0);
      expect(res.body.mode).toBe('monthly');
    });

    it('returns 1 row for single payment with correct revenue', async () => {
      const pkg = await Package.create({ name: 'Tam Günlük', price: 500, days: 30, isActive: true });
      const grp = await Group.create({ name: 'G1', departments: [], teachers: [], nannies: [], ageRange: '2-3', isActive: true });
      const child = await Child.create({
        firstName: 'Əli', lastName: 'Əliyev', birthDate: new Date('2020-01-01'),
        phone1: '+994501111111',
        username: `ali-${Date.now()}@t.com`, password: 'pass123',
        package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'), currentDebt: 0,
      });
      await Payment.create({
        child: child._id, amount: 500, paidAmount: 500,
        paymentDate: new Date('2026-06-15'), serviceMonth: '2026-06',
        remainingBefore: 500, remainingAfter: 0,
        packageSnapshot: { _id: pkg._id, name: pkg.name, price: pkg.price, days: pkg.days },
        isActive: true,
      });

      const res = await request(app).get('/api/reports/revenue?mode=monthly');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        packageName: 'Tam Günlük',
        period: '2026-06',
        revenue: 500,
      });
      expect(res.body.totalRevenue).toBe(500);
    });

    it('groups multiple payments in same month by package', async () => {
      const pkg = await Package.create({ name: 'Yarım Günlük', price: 300, days: 30, isActive: true });
      const grp = await Group.create({ name: 'G2', departments: [], teachers: [], nannies: [], ageRange: '3-4', isActive: true });
      const c1 = await Child.create({
        firstName: 'Vəli', lastName: 'Vəliyev', birthDate: new Date('2019-01-01'),
        phone1: '+994502222222',
        username: `v-${Date.now()}@t.com`, password: 'pass123',
        package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'), currentDebt: 0,
      });
      const c2 = await Child.create({
        firstName: 'Nərmin', lastName: 'Nərminli', birthDate: new Date('2019-01-01'),
        phone1: '+994503333333',
        username: `n-${Date.now()}@t.com`, password: 'pass123',
        package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'), currentDebt: 0,
      });
      const snap = { _id: pkg._id, name: pkg.name, price: pkg.price, days: pkg.days };
      await Payment.create({
        child: c1._id, amount: 300, paidAmount: 300,
        paymentDate: new Date('2026-06-05'), serviceMonth: '2026-06',
        remainingBefore: 300, remainingAfter: 0, packageSnapshot: snap, isActive: true,
      });
      await Payment.create({
        child: c2._id, amount: 300, paidAmount: 300,
        paymentDate: new Date('2026-06-20'), serviceMonth: '2026-06',
        remainingBefore: 300, remainingAfter: 0, packageSnapshot: snap, isActive: true,
      });

      const res = await request(app).get('/api/reports/revenue?mode=monthly');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].revenue).toBe(600);
    });

    it('returns separate rows for different months', async () => {
      const pkg = await Package.create({ name: 'P', price: 100, days: 30, isActive: true });
      const grp = await Group.create({ name: 'G3', departments: [], teachers: [], nannies: [], ageRange: '4-5', isActive: true });
      const c = await Child.create({
        firstName: 'A', lastName: 'B', birthDate: new Date('2020-01-01'),
        phone1: '+994504444444',
        username: `ab-${Date.now()}@t.com`, password: 'pass123',
        package: pkg._id, group: grp._id, startDate: new Date('2026-01-01'), currentDebt: 0,
      });
      const snap = { _id: pkg._id, name: pkg.name, price: pkg.price, days: pkg.days };
      await Payment.create({
        child: c._id, amount: 100, paidAmount: 100,
        paymentDate: new Date('2026-06-15'), serviceMonth: '2026-06',
        remainingBefore: 100, remainingAfter: 0, packageSnapshot: snap, isActive: true,
      });
      await Payment.create({
        child: c._id, amount: 100, paidAmount: 100,
        paymentDate: new Date('2026-05-15'), serviceMonth: '2026-05',
        remainingBefore: 100, remainingAfter: 0, packageSnapshot: snap, isActive: true,
      });

      const res = await request(app).get(
        '/api/reports/revenue?mode=monthly&dateFrom=2026-05-01&dateTo=2026-06-30'
      );
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      // Sort: period DESC → 2026-06 first
      expect(res.body.data[0].period).toBe('2026-06');
      expect(res.body.data[1].period).toBe('2026-05');
    });

    it('excludes payments outside date range', async () => {
      const pkg = await Package.create({ name: 'P', price: 100, days: 30, isActive: true });
      const grp = await Group.create({ name: 'G4', departments: [], teachers: [], nannies: [], ageRange: '5-6', isActive: true });
      const c = await Child.create({
        firstName: 'X', lastName: 'Y', birthDate: new Date('2020-01-01'),
        phone1: '+994505555555',
        username: `xy-${Date.now()}@t.com`, password: 'pass123',
        package: pkg._id, group: grp._id, startDate: new Date('2026-01-01'), currentDebt: 0,
      });
      const snap = { _id: pkg._id, name: pkg.name, price: pkg.price, days: pkg.days };
      await Payment.create({
        child: c._id, amount: 100, paidAmount: 100,
        paymentDate: new Date('2026-03-15'), serviceMonth: '2026-03',
        remainingBefore: 100, remainingAfter: 0, packageSnapshot: snap, isActive: true,
      });

      const res = await request(app).get(
        '/api/reports/revenue?mode=monthly&dateFrom=2026-06-01&dateTo=2026-06-30'
      );
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('excludes payments without packageSnapshot', async () => {
      const pkg = await Package.create({ name: 'P', price: 100, days: 30, isActive: true });
      const grp = await Group.create({ name: 'G5', departments: [], teachers: [], nannies: [], ageRange: '2-3', isActive: true });
      const c = await Child.create({
        firstName: 'Z', lastName: 'W', birthDate: new Date('2020-01-01'),
        phone1: '+994506666666',
        username: `zw-${Date.now()}@t.com`, password: 'pass123',
        package: pkg._id, group: grp._id, startDate: new Date('2026-01-01'), currentDebt: 0,
      });
      // No packageSnapshot — pre-2026-06-14 payment style
      await Payment.create({
        child: c._id, amount: 100, paidAmount: 100,
        paymentDate: new Date('2026-06-15'), serviceMonth: '2026-06',
        remainingBefore: 100, remainingAfter: 0, isActive: true,
      });

      const res = await request(app).get('/api/reports/revenue?mode=monthly');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('excludes isActive=false payments', async () => {
      const pkg = await Package.create({ name: 'P', price: 100, days: 30, isActive: true });
      const grp = await Group.create({ name: 'G6', departments: [], teachers: [], nannies: [], ageRange: '3-4', isActive: true });
      const c = await Child.create({
        firstName: 'Q', lastName: 'R', birthDate: new Date('2020-01-01'),
        phone1: '+994507777777',
        username: `qr-${Date.now()}@t.com`, password: 'pass123',
        package: pkg._id, group: grp._id, startDate: new Date('2026-01-01'), currentDebt: 0,
      });
      const snap = { _id: pkg._id, name: pkg.name, price: pkg.price, days: pkg.days };
      await Payment.create({
        child: c._id, amount: 100, paidAmount: 100,
        paymentDate: new Date('2026-06-15'), serviceMonth: '2026-06',
        remainingBefore: 100, remainingAfter: 0, packageSnapshot: snap, isActive: false,
      });

      const res = await request(app).get('/api/reports/revenue?mode=monthly');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('does NOT subtract refunds from revenue', async () => {
      const pkg = await Package.create({ name: 'P', price: 500, days: 30, isActive: true });
      const grp = await Group.create({ name: 'G11', departments: [], teachers: [], nannies: [], ageRange: '2-3', isActive: true });
      const c = await Child.create({
        firstName: 'Rf', lastName: 'Rf', birthDate: new Date('2020-01-01'),
        phone1: '+994504040404',
        username: `rf-${Date.now()}@t.com`, password: 'pass123',
        package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'), currentDebt: 0,
      });
      const snap = { _id: pkg._id, name: pkg.name, price: pkg.price, days: pkg.days };
      const payment = await Payment.create({
        child: c._id, amount: 500, paidAmount: 500,
        paymentDate: new Date('2026-06-15'), serviceMonth: '2026-06',
        remainingBefore: 500, remainingAfter: 0, packageSnapshot: snap, isActive: true,
      });
      // Create a refund for this payment (full schema per Refund model — required: child, amount, reason, refundDate, createdBy)
      await mongoose.model('Refund').create({
        originalPayment: payment._id, child: c._id, amount: 200,
        reason: 'Test refund for revenue', refundDate: new Date('2026-06-20'),
        createdBy: new mongoose.Types.ObjectId(),
      });

      const res = await request(app).get('/api/reports/revenue?mode=monthly');
      expect(res.status).toBe(200);
      // Revenue is paidAmount (500), NOT paidAmount - refund (300)
      // Refunds do not affect this aggregation (separate concept)
      expect(res.body.data[0].revenue).toBe(500);
    });
  });

  describe('weekly mode', () => {
    it('groups two payments in same ISO week', async () => {
      const pkg = await Package.create({ name: 'P', price: 100, days: 30, isActive: true });
      const grp = await Group.create({ name: 'G7', departments: [], teachers: [], nannies: [], ageRange: '3-4', isActive: true });
      const c = await Child.create({
        firstName: 'W1', lastName: 'W1', birthDate: new Date('2020-01-01'),
        phone1: '+994508888888',
        username: `w1-${Date.now()}@t.com`, password: 'pass123',
        package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'), currentDebt: 0,
      });
      const snap = { _id: pkg._id, name: pkg.name, price: pkg.price, days: pkg.days };
      // Same ISO week (2026-06-15 Mon → 2026-06-21 Sun = W25)
      await Payment.create({
        child: c._id, amount: 100, paidAmount: 100,
        paymentDate: new Date('2026-06-15'), serviceMonth: '2026-06',
        remainingBefore: 100, remainingAfter: 0, packageSnapshot: snap, isActive: true,
      });
      await Payment.create({
        child: c._id, amount: 100, paidAmount: 100,
        paymentDate: new Date('2026-06-19'), serviceMonth: '2026-06',
        remainingBefore: 100, remainingAfter: 0, packageSnapshot: snap, isActive: true,
      });

      const res = await request(app).get('/api/reports/revenue?mode=weekly&dateFrom=2026-06-15&dateTo=2026-06-21');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].revenue).toBe(200);
      expect(res.body.data[0].period).toMatch(/^\d{4}-W\d{2}$/);
    });

    it('separates payments in different ISO weeks', async () => {
      const pkg = await Package.create({ name: 'P', price: 100, days: 30, isActive: true });
      const grp = await Group.create({ name: 'G8', departments: [], teachers: [], nannies: [], ageRange: '4-5', isActive: true });
      const c = await Child.create({
        firstName: 'W2', lastName: 'W2', birthDate: new Date('2020-01-01'),
        phone1: '+994509999999',
        username: `w2-${Date.now()}@t.com`, password: 'pass123',
        package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'), currentDebt: 0,
      });
      const snap = { _id: pkg._id, name: pkg.name, price: pkg.price, days: pkg.days };
      // Different weeks — 2026-06-08 (week 24) vs 2026-06-22 (week 26)
      await Payment.create({
        child: c._id, amount: 100, paidAmount: 100,
        paymentDate: new Date('2026-06-08'), serviceMonth: '2026-06',
        remainingBefore: 100, remainingAfter: 0, packageSnapshot: snap, isActive: true,
      });
      await Payment.create({
        child: c._id, amount: 100, paidAmount: 100,
        paymentDate: new Date('2026-06-22'), serviceMonth: '2026-06',
        remainingBefore: 100, remainingAfter: 0, packageSnapshot: snap, isActive: true,
      });

      // Explicit date range covering both weeks (default weekly range is current week only)
      const res = await request(app).get(
        '/api/reports/revenue?mode=weekly&dateFrom=2026-06-01&dateTo=2026-06-30'
      );
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('daily mode', () => {
    it('groups multiple payments on same day', async () => {
      const pkg = await Package.create({ name: 'P', price: 100, days: 30, isActive: true });
      const grp = await Group.create({ name: 'G9', departments: [], teachers: [], nannies: [], ageRange: '3-4', isActive: true });
      const c1 = await Child.create({
        firstName: 'D1', lastName: 'D1', birthDate: new Date('2020-01-01'),
        phone1: '+994501010101',
        username: `d1-${Date.now()}@t.com`, password: 'pass123',
        package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'), currentDebt: 0,
      });
      const c2 = await Child.create({
        firstName: 'D2', lastName: 'D2', birthDate: new Date('2020-01-01'),
        phone1: '+994502020202',
        username: `d2-${Date.now()}@t.com`, password: 'pass123',
        package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'), currentDebt: 0,
      });
      const snap = { _id: pkg._id, name: pkg.name, price: pkg.price, days: pkg.days };
      await Payment.create({
        child: c1._id, amount: 100, paidAmount: 100,
        paymentDate: new Date('2026-06-15'), serviceMonth: '2026-06',
        remainingBefore: 100, remainingAfter: 0, packageSnapshot: snap, isActive: true,
      });
      await Payment.create({
        child: c2._id, amount: 100, paidAmount: 100,
        paymentDate: new Date('2026-06-15'), serviceMonth: '2026-06',
        remainingBefore: 100, remainingAfter: 0, packageSnapshot: snap, isActive: true,
      });

      // Explicit date range covering 2026-06-15 (default daily is last 30 days, which includes 06-15 since today is 2026-06-23)
      const res = await request(app).get('/api/reports/revenue?mode=daily');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].period).toBe('2026-06-15');
      expect(res.body.data[0].revenue).toBe(200);
    });

    it('returns separate rows for different days', async () => {
      const pkg = await Package.create({ name: 'P', price: 100, days: 30, isActive: true });
      const grp = await Group.create({ name: 'G10', departments: [], teachers: [], nannies: [], ageRange: '4-5', isActive: true });
      const c = await Child.create({
        firstName: 'D3', lastName: 'D3', birthDate: new Date('2020-01-01'),
        phone1: '+994503030303',
        username: `d3-${Date.now()}@t.com`, password: 'pass123',
        package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'), currentDebt: 0,
      });
      const snap = { _id: pkg._id, name: pkg.name, price: pkg.price, days: pkg.days };
      await Payment.create({
        child: c._id, amount: 100, paidAmount: 100,
        paymentDate: new Date('2026-06-10'), serviceMonth: '2026-06',
        remainingBefore: 100, remainingAfter: 0, packageSnapshot: snap, isActive: true,
      });
      await Payment.create({
        child: c._id, amount: 100, paidAmount: 100,
        paymentDate: new Date('2026-06-20'), serviceMonth: '2026-06',
        remainingBefore: 100, remainingAfter: 0, packageSnapshot: snap, isActive: true,
      });

      // Explicit range covering both days (both are within 30 days of today 2026-06-23, but explicit is safer)
      const res = await request(app).get(
        '/api/reports/revenue?mode=daily&dateFrom=2026-06-01&dateTo=2026-06-30'
      );
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('validation', () => {
    it('returns 400 for missing mode', async () => {
      const res = await request(app).get('/api/reports/revenue');
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/mode/);
    });

    it('returns 400 for invalid mode', async () => {
      const res = await request(app).get('/api/reports/revenue?mode=yearly');
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/mode/);
    });

    it('returns 400 when dateFrom > dateTo', async () => {
      const res = await request(app).get(
        '/api/reports/revenue?mode=monthly&dateFrom=2026-06-30&dateTo=2026-06-01'
      );
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Başlanğıc tarixi/);
    });

    it('returns 400 for invalid date format', async () => {
      const res = await request(app).get(
        '/api/reports/revenue?mode=monthly&dateFrom=not-a-date'
      );
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/tarix formatı/);
    });

    it('returns 400 for monthly range > 365 days', async () => {
      const res = await request(app).get(
        '/api/reports/revenue?mode=monthly&dateFrom=2025-01-01&dateTo=2026-12-31'
      );
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/12 ay/);
    });

    it('returns 400 for weekly range > 182 days', async () => {
      const res = await request(app).get(
        '/api/reports/revenue?mode=weekly&dateFrom=2025-06-01&dateTo=2026-06-01'
      );
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/26 həftə/);
    });

    it('returns 400 for daily range > 365 days', async () => {
      const res = await request(app).get(
        '/api/reports/revenue?mode=daily&dateFrom=2025-01-01&dateTo=2026-06-01'
      );
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/365 gün/);
    });
  });
});