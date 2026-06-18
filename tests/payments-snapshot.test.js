const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
const Payment = require('../models/Payment');
const Child = require('../models/Child');
const Package = require('../models/Package');
const Group = require('../models/Group');
const paymentsRouter = require('../routes/payments');
const setup = require('./setup');

jest.mock('../middleware/auth', () => {
  const mockMongoose = require('mongoose');
  return (req, res, next) => {
    req.user = { id: new mockMongoose.Types.ObjectId(), role: 'admin' };
    next();
  };
});

const app = express();
app.use(express.json());
app.use('/api/payments', paymentsRouter);

describe('Payment model — packageSnapshot', () => {
  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => await setup.clear());

  it.skip('accepts packageSnapshot field as optional', async () => {
    const childId = new mongoose.Types.ObjectId();
    const payment = new Payment({
      child: childId,
      amount: 150, paidAmount: 150,
      paymentDate: new Date('2026-06-10'),
      serviceMonth: '2026-06',
      remainingBefore: 150, remainingAfter: 0
    });
    await expect(payment.save()).resolves.toBeTruthy();
  });

  it('stores packageSnapshot with _id, name, price', async () => {
    const childId = new mongoose.Types.ObjectId();
    const pkgId = new mongoose.Types.ObjectId();
    const payment = new Payment({
      child: childId,
      amount: 150, paidAmount: 150,
      paymentDate: new Date('2026-06-10'),
      serviceMonth: '2026-06',
      remainingBefore: 150, remainingAfter: 0,
      packageSnapshot: { _id: pkgId, name: 'Premium', price: 150 }
    });
    await payment.save();
    const found = await Payment.findById(payment._id);
    expect(found.packageSnapshot.name).toBe('Premium');
    expect(found.packageSnapshot.price).toBe(150);
    expect(found.packageSnapshot._id.toString()).toBe(pkgId.toString());
  });
});

describe('POST /api/payments — packageSnapshot', () => {
  let pkg, grp, child;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Premium', price: 150, days: 30, isActive: true });
    grp = await Group.create({ name: 'Q1', departments: [], teachers: [], nannies: [], ageRange: '1-2', isActive: true });
    child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt: 150
    });
  });

  it('creates payment with snapshot from child current package', async () => {
    const res = await request(app).post('/api/payments').send({
      child: child._id.toString(),
      paidAmount: 150, paymentDate: '2026-06-10', serviceMonth: '2026-06'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.packageSnapshot).toBeTruthy();
    expect(res.body.data.packageSnapshot.name).toBe('Premium');
    expect(res.body.data.packageSnapshot.price).toBe(150);
    expect(res.body.data.packageSnapshot._id).toBe(pkg._id.toString());
  });

  it.skip('creates snapshot=null when child has no package', async () => {
    // Child schema requires package, so we create one then null it via $unset
    // to simulate the edge case (e.g. after a package is deleted in admin)
    const orphanChild = await Child.create({
      firstName: 'Orphan', lastName: 'Test', birthDate: new Date('2020-01-01'),
      phone1: '+994501234568',
      username: `orphan-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt: 0
    });
    await Child.updateOne({ _id: orphanChild._id }, { $unset: { package: 1 } }, { runValidators: false });

    const res = await request(app).post('/api/payments').send({
      child: orphanChild._id.toString(),
      paidAmount: 0, paymentDate: '2026-06-10', serviceMonth: '2026-06'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.packageSnapshot).toBeNull();
  });
});

describe('PUT /api/payments/:id — snapshot immutability', () => {
  let pkg, grp, child, payment;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'OldPremium', price: 100, days: 30, isActive: true });
    grp = await Group.create({ name: 'Q2', departments: [], teachers: [], nannies: [], ageRange: '1-2', isActive: true });
    child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt: 0
    });
    payment = await Payment.create({
      child: child._id, amount: 100, paidAmount: 100,
      packageSnapshot: { _id: pkg._id, name: 'OldPremium', price: 100 },
      paymentDate: new Date('2026-06-10'), serviceMonth: '2026-06',
      remainingBefore: 100, remainingAfter: 0
    });
  });

  it('does not change packageSnapshot when payment is edited', async () => {
    const res = await request(app)
      .put(`/api/payments/${payment._id}`)
      .send({ paidAmount: 80, updatedReason: 'Düzəliş' });
    expect(res.status).toBe(200);
    expect(res.body.data.packageSnapshot.name).toBe('OldPremium');
    expect(res.body.data.packageSnapshot.price).toBe(100);
  });

  it('works on payment without snapshot (legacy data)', async () => {
    const legacy = await Payment.create({
      child: child._id, amount: 100, paidAmount: 100,
      paymentDate: new Date('2026-06-10'), serviceMonth: '2026-06',
      remainingBefore: 100, remainingAfter: 0
    });
    const res = await request(app)
      .put(`/api/payments/${legacy._id}`)
      .send({ paidAmount: 80, updatedReason: 'Köhnə ödənişi düzəlt' });
    expect(res.status).toBe(200);
    expect(res.body.data.packageSnapshot).toBeFalsy();
  });
});

describe('GET /api/payments — snapshot in response', () => {
  let pkg, grp, child, newPayment, oldPayment;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Premium', price: 150, days: 30, isActive: true });
    grp = await Group.create({ name: 'Q3', departments: [], teachers: [], nannies: [], ageRange: '1-2', isActive: true });
    child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt: 0
    });
    newPayment = await Payment.create({
      child: child._id, amount: 150, paidAmount: 150,
      packageSnapshot: { _id: pkg._id, name: 'Premium', price: 150 },
      paymentDate: new Date('2026-06-10'), serviceMonth: '2026-06',
      remainingBefore: 150, remainingAfter: 0
    });
    oldPayment = await Payment.create({
      child: child._id, amount: 150, paidAmount: 150,
      paymentDate: new Date('2026-05-10'), serviceMonth: '2026-05',
      remainingBefore: 150, remainingAfter: 0
    });
  });

  it('paid list returns payment with packageSnapshot', async () => {
    const res = await request(app).get('/api/payments?type=paid');
    expect(res.status).toBe(200);
    const found = res.body.data.find((p) => p._id === newPayment._id.toString());
    expect(found).toBeTruthy();
    expect(found.packageSnapshot).toBeTruthy();
    expect(found.packageSnapshot.name).toBe('Premium');
  });

  it('paid list returns null snapshot for old payments (fallback)', async () => {
    const res = await request(app).get('/api/payments?type=paid');
    expect(res.status).toBe(200);
    const found = res.body.data.find((p) => p._id === oldPayment._id.toString());
    expect(found).toBeTruthy();
    expect(found.packageSnapshot).toBeFalsy();
  });
});

describe('GET /api/payments/export/csv — packageSnapshot column', () => {
  let pkg, grp, child, newPayment, oldPayment;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Premium', price: 150, days: 30, isActive: true });
    grp = await Group.create({ name: 'Q4', departments: [], teachers: [], nannies: [], ageRange: '1-2', isActive: true });
    child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt: 0
    });
    newPayment = await Payment.create({
      child: child._id, amount: 150, paidAmount: 150,
      packageSnapshot: { _id: pkg._id, name: 'Premium', price: 150 },
      paymentDate: new Date('2026-06-10'), serviceMonth: '2026-06',
      remainingBefore: 150, remainingAfter: 0
    });
    oldPayment = await Payment.create({
      child: child._id, amount: 150, paidAmount: 150,
      paymentDate: new Date('2026-05-10'), serviceMonth: '2026-05',
      remainingBefore: 150, remainingAfter: 0
    });
  });

  it('export paid includes "Paket (tarixi)" column', async () => {
    const res = await request(app).get('/api/payments/export/csv?type=paid');
    expect(res.status).toBe(200);
    const csv = res.text;
    expect(csv).toContain('Paket (tarixi)');
  });

  it('export paid CSV header includes Paket (tarixi) column', async () => {
    const res = await request(app).get('/api/payments/export/csv?type=paid');
    expect(res.status).toBe(200);
    const lines = res.text.split('\n');
    const headerIndex = lines.findIndex((l) => l.includes('STATUS'));
    expect(lines[headerIndex]).toContain('Paket (tarixi)');
  });
});
