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

describe('PUT /api/payments/:id — revert bug fix (2026-06-14)', () => {
  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => await setup.clear());

  async function seed({ price = 150, paidAmount, discount = 0, extraPrice = 0, currentDebt = 0 } = {}) {
    const pkg = await Package.create({
      name: 'Premium', price, days: 30, isActive: true
    });
    const grp = await Group.create({ name: 'Q-Revert', departments: [], teachers: [], nannies: [], ageRange: '1-2', isActive: true });
    const child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt
    });
    const realPayment = paidAmount + discount - extraPrice;
    const remainingBefore = currentDebt;
    const remainingAfter = remainingBefore - realPayment;
    const payment = await Payment.create({
      child: child._id,
      amount: price + extraPrice - discount,
      paidAmount, discount, extraPrice,
      paymentDate: new Date('2026-06-10'),
      serviceMonth: '2026-06',
      remainingBefore, remainingAfter
    });
    // Uşağın borcunu ödənişə uyğunlaşdır (test pre-state)
    child.currentDebt = remainingAfter;
    await child.save();
    return { pkg, child, payment };
  }

  it('reverts with full real payment (paidAmount + discount - extraPrice)', async () => {
    const { child, payment } = await seed({
      price: 150, paidAmount: 140, discount: 20, extraPrice: 10, currentDebt: 150
    });
    expect((await Child.findById(child._id)).currentDebt).toBe(0);

    const res = await request(app)
      .put(`/api/payments/${payment._id}`)
      .send({ discount: 20, extraPrice: 10, paidAmount: 100, updatedReason: 'Test revert' });

    expect(res.status).toBe(200);
    expect(res.body.data.remainingAfter).toBe(40);

    const updatedChild = await Child.findById(child._id);
    expect(updatedChild.currentDebt).toBe(40);
  });

  it('reverts correctly when old payment has no discount or extraPrice (backward compat)', async () => {
    const { child, payment } = await seed({
      price: 200, paidAmount: 200, discount: 0, extraPrice: 0, currentDebt: 200
    });
    expect((await Child.findById(child._id)).currentDebt).toBe(0);

    const res = await request(app)
      .put(`/api/payments/${payment._id}`)
      .send({ paidAmount: 150, updatedReason: 'Sadə redaktə' });

    expect(res.status).toBe(200);
    expect(res.body.data.remainingAfter).toBe(50);

    const updatedChild = await Child.findById(child._id);
    expect(updatedChild.currentDebt).toBe(50);
  });

  it('reverts correctly when old payment had discount and edit removes it', async () => {
    const { child, payment } = await seed({
      price: 100, paidAmount: 80, discount: 20, extraPrice: 0, currentDebt: 100
    });
    expect((await Child.findById(child._id)).currentDebt).toBe(0);

    const res = await request(app)
      .put(`/api/payments/${payment._id}`)
      .send({ paidAmount: 100, discount: 0, extraPrice: 0, updatedReason: 'Endirim silindi' });

    expect(res.status).toBe(200);
    expect(res.body.data.remainingAfter).toBe(0);

    const updatedChild = await Child.findById(child._id);
    expect(updatedChild.currentDebt).toBe(0);
  });

  it('reverts correctly when old payment had extraPrice and edit removes it', async () => {
    const { child, payment } = await seed({
      price: 100, paidAmount: 110, discount: 0, extraPrice: 10, currentDebt: 100
    });
    expect((await Child.findById(child._id)).currentDebt).toBe(0);

    const res = await request(app)
      .put(`/api/payments/${payment._id}`)
      .send({ paidAmount: 50, discount: 0, extraPrice: 0, updatedReason: 'Əlavə silindi' });

    expect(res.status).toBe(200);
    expect(res.body.data.remainingAfter).toBe(50);

    const updatedChild = await Child.findById(child._id);
    expect(updatedChild.currentDebt).toBe(50);
  });
});
