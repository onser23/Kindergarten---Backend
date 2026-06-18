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

describe('GET /api/payments?type=paid — child.currentDebt populate', () => {
  let pkg, grp, child, payment;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Həftəlik', price: 150, days: 7, duration: 'Həftəlik tam gün', isActive: true });
    grp = await Group.create({ name: 'Q1', ageRange: '1-2', teachers: [], nannies: [], departments: [], isActive: true });
    child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-paid-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt: -130
    });
    payment = await Payment.create({
      child: child._id, amount: 150, paidAmount: 150,
      paymentDate: new Date('2026-06-10'), serviceMonth: '2026-06',
      remainingBefore: 150, remainingAfter: 0
    });
  });

  it('returns child.currentDebt in paid list response', async () => {
    const res = await request(app).get('/api/payments?type=paid');
    expect(res.status).toBe(200);
    const found = res.body.data.find((p) => p._id === payment._id.toString());
    expect(found).toBeTruthy();
    expect(found.child).toBeTruthy();
    expect(found.child.currentDebt).toBe(-130);
  });
});

describe('GET /api/payments/preview?type=paid — child.currentDebt populate', () => {
  let pkg, grp, child, payment;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Həftəlik', price: 150, days: 7, duration: 'Həftəlik tam gün', isActive: true });
    grp = await Group.create({ name: 'Q2', ageRange: '1-2', teachers: [], nannies: [], departments: [], isActive: true });
    child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-preview-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt: 350
    });
    payment = await Payment.create({
      child: child._id, amount: 150, paidAmount: 150,
      paymentDate: new Date('2026-06-10'), serviceMonth: '2026-06',
      remainingBefore: 150, remainingAfter: 0
    });
  });

  it('returns child.currentDebt in paid preview response', async () => {
    const res = await request(app).get('/api/payments/preview?type=paid&limit=10');
    expect(res.status).toBe(200);
    const found = res.body.data.find((p) => p._id === payment._id.toString());
    expect(found).toBeTruthy();
    expect(found.child).toBeTruthy();
    expect(found.child.currentDebt).toBe(350);
  });
});

describe('GET /api/payments/:id — child.currentDebt populate', () => {
  let pkg, grp, child, payment;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Aylıq', price: 500, days: 30, duration: 'Bir aylıq tam gün', isActive: true });
    grp = await Group.create({ name: 'Q3', ageRange: '1-2', teachers: [], nannies: [], departments: [], isActive: true });
    child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-single-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt: -130
    });
    payment = await Payment.create({
      child: child._id, amount: 500, paidAmount: 500,
      paymentDate: new Date('2026-06-10'), serviceMonth: '2026-06',
      remainingBefore: 500, remainingAfter: 0
    });
  });

  it('returns child.currentDebt in single payment response', async () => {
    const res = await request(app).get(`/api/payments/${payment._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeTruthy();
    expect(res.body.data.child).toBeTruthy();
    expect(res.body.data.child.currentDebt).toBe(-130);
  });
});

describe('GET /api/payments/export/csv?type=paid — child.currentDebt', () => {
  let pkg, grp, child, payment;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Həftəlik', price: 150, days: 7, duration: 'Həftəlik tam gün', isActive: true });
    grp = await Group.create({ name: 'Q4', ageRange: '1-2', teachers: [], nannies: [], departments: [], isActive: true });
    child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-csv-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt: -130
    });
    payment = await Payment.create({
      child: child._id, amount: 150, paidAmount: 150,
      paymentDate: new Date('2026-06-10'), serviceMonth: '2026-06',
      remainingBefore: 150, remainingAfter: 0
    });
  });

  it('CSV includes child currentDebt in Borc (₼) column for paid', async () => {
    const res = await request(app).get('/api/payments/export/csv?type=paid');
    expect(res.status).toBe(200);
    const csv = res.text;
    expect(csv).toContain('-130');
  });

  it('CSV Borc (₼) column header still present', async () => {
    const res = await request(app).get('/api/payments/export/csv?type=paid');
    expect(res.status).toBe(200);
    const lines = res.text.split('\n');
    const headerIndex = lines.findIndex((l) => l.includes('STATUS'));
    expect(lines[headerIndex]).toContain('Borc (₼)');
  });
});
