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

describe('PUT /api/payments/:id', () => {
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
      currentDebt: 0
    });
    const payment = await Payment.create({
      child: child._id, amount: 360, paidAmount: 360,
      paymentDate: new Date('2026-03-15'), serviceMonth: '2026-03',
      remainingBefore: 360, remainingAfter: 0
    });
    return { child, payment };
  }

  it('updates payment with valid updatedReason', async () => {
    const { payment } = await seed();
    const res = await request(app)
      .put(`/api/payments/${payment._id}`)
      .send({ paidAmount: 200, updatedReason: 'Valideyn duzelis istedi' });
    expect(res.status).toBe(200);
    expect(res.body.data.updatedReason).toBe('Valideyn duzelis istedi');
  });

  it('rejects update without updatedReason', async () => {
    const { payment } = await seed();
    const res = await request(app)
      .put(`/api/payments/${payment._id}`)
      .send({ paidAmount: 200 });
    expect(res.status).toBe(400);
  });

  it('rejects update with whitespace-only updatedReason', async () => {
    const { payment } = await seed();
    const res = await request(app)
      .put(`/api/payments/${payment._id}`)
      .send({ paidAmount: 200, updatedReason: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects updatedReason over 500 chars', async () => {
    const { payment } = await seed();
    const res = await request(app)
      .put(`/api/payments/${payment._id}`)
      .send({ paidAmount: 200, updatedReason: 'a'.repeat(501) });
    expect(res.status).toBe(400);
  });
});
