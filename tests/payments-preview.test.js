const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Child = require('../models/Child');
const Package = require('../models/Package');
const Group = require('../models/Group');
const paymentsRouter = require('../routes/payments');

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
const setup = require('./setup');

describe('GET /api/payments/preview', () => {
  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => await setup.clear());

  async function seed({ debt = 0, days = 30 } = {}) {
    const pkg = await Package.create({ name: 'Standart', price: 360, days, isActive: true });
    const grp = await Group.create({ name: 'Q1', departments: [], teachers: [], nannies: [], ageRange: '1-2', isActive: true });
    const child = await Child.create({
      firstName: 'Eli', lastName: 'Eliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `ali-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-03-10'),
      currentDebt: debt
    });
    return { pkg, grp, child };
  }

  it('returns pending children limited to N', async () => {
    await seed({ debt: 100 });
    await seed({ debt: 0 });
    const res = await request(app).get('/api/payments/preview?type=pending&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);
  });

  it('returns paid records sorted by paymentDate desc, limited', async () => {
    const { child } = await seed({ debt: 0 });
    await Payment.create({
      child: child._id, amount: 360, paidAmount: 360,
      paymentDate: new Date('2026-03-01'), serviceMonth: '2026-03',
      remainingBefore: 360, remainingAfter: 0
    });
    await Payment.create({
      child: child._id, amount: 360, paidAmount: 360,
      paymentDate: new Date('2026-02-01'), serviceMonth: '2026-02',
      remainingBefore: 360, remainingAfter: 0
    });
    const res = await request(app).get('/api/payments/preview?type=paid&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.data[0].serviceMonth).toBe('2026-03');
  });

  it('returns 400 for missing type', async () => {
    const res = await request(app).get('/api/payments/preview');
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid type', async () => {
    const res = await request(app).get('/api/payments/preview?type=foo');
    expect(res.status).toBe(400);
  });
});
