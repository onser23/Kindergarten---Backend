const request = require('supertest');
const express = require('express');
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

describe('GET /api/payments?type=paid — child.isActive sync', () => {
  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => await setup.clear());

  async function seedChild(isActive) {
    const pkg = await Package.create({ name: 'Standart', price: 360, days: 30, isActive: true });
    const grp = await Group.create({ name: 'Q1', departments: [], teachers: [], nannies: [], ageRange: '1-2', isActive: true });
    const child = await Child.create({
      firstName: 'Eli', lastName: 'Eliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `ali-${Date.now()}-${Math.random()}-${isActive ? 'a' : 'p'}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-03-10'),
      currentDebt: 100,
      isActive
    });
    await Payment.create({
      child: child._id, amount: 360, paidAmount: 260,
      paymentDate: new Date('2026-03-15'), serviceMonth: '2026-03',
      remainingBefore: 360, remainingAfter: 100
    });
    return child;
  }

  it('returns child.isActive = true for active children', async () => {
    await seedChild(true);
    const res = await request(app).get('/api/payments?type=paid');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].child.isActive).toBe(true);
  });

  it('returns child.isActive = false for passive children', async () => {
    await seedChild(false);
    const res = await request(app).get('/api/payments?type=paid');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].child.isActive).toBe(false);
  });
});