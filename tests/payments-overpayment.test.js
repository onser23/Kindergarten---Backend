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

describe('Overpayment / Advance payment (2026-06-14)', () => {
  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => await setup.clear());

  async function seedChild({ price = 150, currentDebt = 150 } = {}) {
    const pkg = await Package.create({ name: 'Premium', price, days: 30, isActive: true });
    const grp = await Group.create({ name: 'Q-Overpay', departments: [], teachers: [], nannies: [], ageRange: '1-2', isActive: true });
    return Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt
    });
  }

  it('POST: allows overpayment (200 with 20 discount, 10 extra > 150 debt) and stores negative balance', async () => {
    const child = await seedChild({ price: 150, currentDebt: 150 });
    const res = await request(app).post('/api/payments').send({
      child: child._id.toString(),
      paidAmount: 200, paymentDate: '2026-06-10', serviceMonth: '2026-06',
      discount: 20, extraPrice: 10
    });
    expect(res.status).toBe(201);
    expect(res.body.data.remainingAfter).toBe(-60);
    expect(res.body.data.paidAmount).toBe(200);

    const updatedChild = await Child.findById(child._id);
    expect(updatedChild.currentDebt).toBe(-60);
  });

  it('POST: allows full 2-month prepayment (300 for 1-month 150 debt)', async () => {
    const child = await seedChild({ price: 150, currentDebt: 150 });
    const res = await request(app).post('/api/payments').send({
      child: child._id.toString(),
      paidAmount: 300, paymentDate: '2026-06-10', serviceMonth: '2026-06'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.remainingAfter).toBe(-150);

    const updatedChild = await Child.findById(child._id);
    expect(updatedChild.currentDebt).toBe(-150);
  });

  it('POST: returns avans message when overpayment occurs', async () => {
    const child = await seedChild({ price: 150, currentDebt: 150 });
    const res = await request(app).post('/api/payments').send({
      child: child._id.toString(),
      paidAmount: 200, paymentDate: '2026-06-10', serviceMonth: '2026-06'
    });
    expect(res.status).toBe(201);
    expect(res.body.message).toContain('avans');
    expect(res.body.message).toContain('50');
  });

  it('POST: still allows zero and partial payments (regression check)', async () => {
    const child = await seedChild({ price: 150, currentDebt: 150 });
    const res = await request(app).post('/api/payments').send({
      child: child._id.toString(),
      paidAmount: 100, paymentDate: '2026-06-10', serviceMonth: '2026-06'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.remainingAfter).toBe(50);

    const updatedChild = await Child.findById(child._id);
    expect(updatedChild.currentDebt).toBe(50);
  });

  it('PUT: allows editing to overpay (revert+apply cycle produces negative balance)', async () => {
    const pkg = await Package.create({ name: 'Premium', price: 150, days: 30, isActive: true });
    const grp = await Group.create({ name: 'Q-Overpay-Edit', departments: [], teachers: [], nannies: [], ageRange: '1-2', isActive: true });
    const child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt: 150
    });
    const payment = await Payment.create({
      child: child._id, amount: 150, paidAmount: 150,
      paymentDate: new Date('2026-06-10'), serviceMonth: '2026-06',
      remainingBefore: 150, remainingAfter: 0
    });
    child.currentDebt = 0;
    await child.save();

    const res = await request(app)
      .put(`/api/payments/${payment._id}`)
      .send({ paidAmount: 200, updatedReason: 'Avans' });

    expect(res.status).toBe(200);
    expect(res.body.data.remainingAfter).toBe(-50);
    expect(res.body.message).toContain('avans');

    const updatedChild = await Child.findById(child._id);
    expect(updatedChild.currentDebt).toBe(-50);
  });

  it('pending list: excludes child with negative currentDebt (credit balance)', async () => {
    const child = await seedChild({ price: 150, currentDebt: -100 });
    const res = await request(app).get('/api/payments?type=pending');
    expect(res.status).toBe(200);
    const ids = (res.body.data || []).map((c) => c._id);
    expect(ids).not.toContain(child._id.toString());
  });

  it('paid list: shows negative remainingAfter (credit) when overpayment', async () => {
    const child = await seedChild({ price: 150, currentDebt: 150 });
    const post = await request(app).post('/api/payments').send({
      child: child._id.toString(),
      paidAmount: 200, paymentDate: '2026-06-10', serviceMonth: '2026-06'
    });
    expect(post.status).toBe(201);

    const res = await request(app).get('/api/payments?type=paid');
    expect(res.status).toBe(200);
    const found = (res.body.data || []).find((p) => p._id === post.body.data._id);
    expect(found).toBeTruthy();
    expect(found.remainingAfter).toBe(-50);
  });
});
