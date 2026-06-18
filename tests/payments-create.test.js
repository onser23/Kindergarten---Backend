const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
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

describe('POST /api/payments', () => {
  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => await setup.clear());

  async function seedChild() {
    const pkg = await Package.create({ name: 'Standart', price: 360, days: 30, isActive: true });
    const grp = await Group.create({ name: 'Q1', departments: [], teachers: [], nannies: [], ageRange: '1-2', isActive: true });
    return Child.create({
      firstName: 'Eli', lastName: 'Eliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `ali-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-03-10'),
      currentDebt: 360
    });
  }

  it('creates payment with valid serviceMonth', async () => {
    const child = await seedChild();
    const res = await request(app).post('/api/payments').send({
      child: child._id.toString(),
      paidAmount: 360, paymentDate: '2026-03-15', serviceMonth: '2026-03'
    });
    expect(res.status).toBe(201);
    expect(res.body.data.serviceMonth).toBe('2026-03');
  });

  it('rejects payment without serviceMonth', async () => {
    const child = await seedChild();
    const res = await request(app).post('/api/payments').send({
      child: child._id.toString(), paidAmount: 360, paymentDate: '2026-03-15'
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid serviceMonth', async () => {
    const child = await seedChild();
    const res = await request(app).post('/api/payments').send({
      child: child._id.toString(), paidAmount: 360,
      paymentDate: '2026-03-15', serviceMonth: 'mart 2026'
    });
    expect(res.status).toBe(400);
  });
});
