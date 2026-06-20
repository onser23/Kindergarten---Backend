const mongoose = require('mongoose');
const Refund = require('../models/Refund');
const setup = require('./setup');

jest.mock('../middleware/auth', () => {
  const mockMongoose = require('mongoose');
  return (req, res, next) => {
    req.user = { id: new mockMongoose.Types.ObjectId(), role: 'admin' };
    next();
  };
});

describe('Refund Model — Validations', () => {
  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => await setup.clear());

  it('creates refund with all required fields', async () => {
    const refund = await Refund.create({
      child: new mongoose.Types.ObjectId(),
      amount: 100,
      reason: 'Test səbəb',
      refundDate: new Date('2026-06-20'),
      createdBy: new mongoose.Types.ObjectId()
    });
    expect(refund._id).toBeDefined();
    expect(refund.amount).toBe(100);
    expect(refund.reason).toBe('Test səbəb');
    expect(refund.isActive).toBe(true);
    expect(refund.notes).toBe('');
  });

  it('rejects refund without child', async () => {
    await expect(Refund.create({
      amount: 100,
      reason: 'Test',
      refundDate: new Date(),
      createdBy: new mongoose.Types.ObjectId()
    })).rejects.toThrow(/Uşaq tələb olunur/);
  });

  it('rejects refund with amount = 0', async () => {
    await expect(Refund.create({
      child: new mongoose.Types.ObjectId(),
      amount: 0,
      reason: 'Test',
      refundDate: new Date(),
      createdBy: new mongoose.Types.ObjectId()
    })).rejects.toThrow(/ən az 0.01/);
  });

  it('rejects refund with reason shorter than 3 chars', async () => {
    await expect(Refund.create({
      child: new mongoose.Types.ObjectId(),
      amount: 100,
      reason: 'ab',
      refundDate: new Date(),
      createdBy: new mongoose.Types.ObjectId()
    })).rejects.toThrow(/ən azı 3 simvol/);
  });

  it('accepts refund without originalPayment (optional)', async () => {
    const refund = await Refund.create({
      child: new mongoose.Types.ObjectId(),
      amount: 100,
      reason: 'Test səbəb',
      refundDate: new Date(),
      createdBy: new mongoose.Types.ObjectId()
    });
    expect(refund.originalPayment).toBeUndefined();
  });
});

const request = require('supertest');
const express = require('express');
const Child = require('../models/Child');
const Package = require('../models/Package');
const Group = require('../models/Group');
const refundRoutes = require('../routes/refunds');

const app = express();
app.use(express.json());
app.use('/api/refunds', require('../middleware/auth'), refundRoutes);

describe('POST /api/refunds', () => {
  let pkg, grp, passiveChild;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Aylıq', price: 500, days: 30, duration: 'Bir aylıq tam gün', isActive: true });
    grp = await Group.create({ name: 'Q1', ageRange: '1-2', teachers: [], nannies: [], departments: [], isActive: true });
    passiveChild = await Child.create({
      firstName: 'Əli', lastName: 'Əliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `ali-passive-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'),
      isActive: false,
      passiveDate: new Date('2026-06-10'),
      passiveReason: 'Ailə köçdü'
    });
  });

  it('creates refund for passive child', async () => {
    const res = await request(app)
      .post('/api/refunds')
      .send({
        child: passiveChild._id.toString(),
        amount: 300,
        reason: '10 gün istifadə edib, 20 gün qaytarılır',
        refundDate: '2026-06-15T10:00:00.000Z',
        notes: 'Valideyn təsdiqlədi'
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toBeTruthy();
    expect(res.body.data.amount).toBe(300);
    expect(res.body.data.child.firstName).toBe('Əli');
  });

  it('rejects refund for active child with 403', async () => {
    const activeChild = await Child.create({
      firstName: 'Aktiv', lastName: 'Uşaq', birthDate: new Date('2020-01-01'),
      phone1: '+994501234568',
      username: `aktiv-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'),
      isActive: true
    });
    const res = await request(app)
      .post('/api/refunds')
      .send({
        child: activeChild._id.toString(),
        amount: 100,
        reason: 'Test',
        refundDate: '2026-06-15T10:00:00.000Z'
      });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/passiv/);
  });

  it('returns 404 for non-existent child', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post('/api/refunds')
      .send({
        child: fakeId.toString(),
        amount: 100,
        reason: 'Test',
        refundDate: '2026-06-15T10:00:00.000Z'
      });
    expect(res.status).toBe(404);
  });

  it('rejects refund with amount = 0', async () => {
    const res = await request(app)
      .post('/api/refunds')
      .send({
        child: passiveChild._id.toString(),
        amount: 0,
        reason: 'Test səbəb',
        refundDate: '2026-06-15T10:00:00.000Z'
      });
    expect(res.status).toBe(400);
  });

  it('rejects refund with negative amount', async () => {
    const res = await request(app)
      .post('/api/refunds')
      .send({
        child: passiveChild._id.toString(),
        amount: -50,
        reason: 'Test səbəb',
        refundDate: '2026-06-15T10:00:00.000Z'
      });
    expect(res.status).toBe(400);
  });

  it('rejects refund with reason shorter than 3 chars', async () => {
    const res = await request(app)
      .post('/api/refunds')
      .send({
        child: passiveChild._id.toString(),
        amount: 100,
        reason: 'ab',
        refundDate: '2026-06-15T10:00:00.000Z'
      });
    expect(res.status).toBe(400);
  });

  it('creates refund without originalPayment (optional)', async () => {
    const res = await request(app)
      .post('/api/refunds')
      .send({
        child: passiveChild._id.toString(),
        amount: 200,
        reason: 'Refund without original payment ref',
        refundDate: '2026-06-15T10:00:00.000Z'
      });
    expect(res.status).toBe(201);
    expect(res.body.data.originalPayment).toBeFalsy();
  });

  it('rejects refund with originalPayment from different child', async () => {
    const Payment = require('../models/Payment');
    const otherChild = await Child.create({
      firstName: 'O', lastName: 'Other', birthDate: new Date('2020-01-01'),
      phone1: '+994501234569',
      username: `other-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'),
      isActive: false
    });
    const otherPayment = await Payment.create({
      child: otherChild._id, amount: 100, paidAmount: 100,
      paymentDate: new Date('2026-06-01'), serviceMonth: '2026-06',
      remainingBefore: 100, remainingAfter: 0
    });
    const res = await request(app)
      .post('/api/refunds')
      .send({
        child: passiveChild._id.toString(),
        originalPayment: otherPayment._id.toString(),
        amount: 100,
        reason: 'Test',
        refundDate: '2026-06-15T10:00:00.000Z'
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/bu uşağa aid deyil/);
  });
});
