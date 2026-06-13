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

describe('GET /api/payments (list with type, pagination, filters)', () => {
  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => await setup.clear());

  async function seedChild(debt = 0) {
    const pkg = await Package.create({ name: 'Standart', price: 360, days: 30, isActive: true });
    const grp = await Group.create({ name: 'Q1', isActive: true });
    return Child.create({
      firstName: 'Eli', lastName: 'Eliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `ali-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-03-10'),
      currentDebt: debt
    });
  }

  it('returns 400 when type is missing', async () => {
    const res = await request(app).get('/api/payments');
    expect(res.status).toBe(400);
  });

  it('returns pending children paginated', async () => {
    for (let i = 0; i < 20; i++) await seedChild(50);
    const res = await request(app).get('/api/payments?type=pending&page=1&limit=15');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(15);
    expect(res.body.total).toBe(20);
    expect(res.body.totalPages).toBe(2);
    expect(res.body.page).toBe(1);
  });

  it('returns paid records paginated', async () => {
    const child = await seedChild(0);
    for (let i = 0; i < 20; i++) {
      await Payment.create({
        child: child._id, amount: 360, paidAmount: 360,
        paymentDate: new Date(2026, 2, i + 1), serviceMonth: '2026-03',
        remainingBefore: 360, remainingAfter: 0
      });
    }
    const res = await request(app).get('/api/payments?type=paid&page=2&limit=15');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(5);
    expect(res.body.page).toBe(2);
  });

  it('filters pending by debt range', async () => {
    await seedChild(50);
    await seedChild(500);
    await seedChild(1000);
    const res = await request(app).get('/api/payments?type=pending&debtMin=100&debtMax=600');
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].currentDebt).toBe(500);
  });

  it('filters paid by serviceMonth', async () => {
    const child = await seedChild(0);
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
    const res = await request(app).get('/api/payments?type=paid&serviceMonth=2026-03');
    expect(res.body.total).toBe(1);
  });

  it('filters paid by preset=today', async () => {
    const child = await seedChild(0);
    const today = new Date();
    await Payment.create({
      child: child._id, amount: 360, paidAmount: 360,
      paymentDate: today, serviceMonth: '2026-03',
      remainingBefore: 360, remainingAfter: 0
    });
    await Payment.create({
      child: child._id, amount: 360, paidAmount: 360,
      paymentDate: new Date('2026-01-01'), serviceMonth: '2026-01',
      remainingBefore: 360, remainingAfter: 0
    });
    const res = await request(app).get('/api/payments?type=paid&preset=today');
    expect(res.body.total).toBe(1);
  });
});
