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

describe('GET /api/payments/export/csv', () => {
  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => await setup.clear());

  async function seed() {
    const pkg = await Package.create({ name: 'Standart', price: 360, days: 30, isActive: true });
    const grp = await Group.create({ name: 'Q1', isActive: true });
    const child = await Child.create({
      firstName: 'Eli', lastName: 'Eliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `ali-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-03-10'),
      currentDebt: 100
    });
    await Payment.create({
      child: child._id, amount: 360, paidAmount: 260,
      paymentDate: new Date('2026-03-15'), serviceMonth: '2026-03',
      remainingBefore: 360, remainingAfter: 100
    });
    return child;
  }

  it('returns 400 when type is missing', async () => {
    const res = await request(app).get('/api/payments/export/csv');
    expect(res.status).toBe(400);
  });

  it('exports paid CSV with UTF-8 BOM', async () => {
    await seed();
    const res = await request(app).get('/api/payments/export/csv?type=paid');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text.charCodeAt(0)).toBe(0xFEFF);
    expect(res.text).toMatch(/STATUS/);
  });

  it('exports pending CSV', async () => {
    await seed();
    const res = await request(app).get('/api/payments/export/csv?type=pending');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Borc/);
  });

  it('exports all CSV with both statuses', async () => {
    await seed();
    const res = await request(app).get('/api/payments/export/csv?type=all');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/STATUS/);
  });
});
