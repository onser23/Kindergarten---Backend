const request = require('supertest');
const express = require('express');
const setup = require('./setup');

jest.mock('../middleware/auth', () => {
  const mockMongoose = require('mongoose');
  return (req, res, next) => {
    req.user = { id: new mockMongoose.Types.ObjectId(), role: 'admin' };
    next();
  };
});

const Payment = require('../models/Payment');
const Refund = require('../models/Refund');
const Child = require('../models/Child');
const paymentsRoutes = require('../routes/payments');
const refundsRoutes = require('../routes/refunds');

const app = express();
app.use(express.json());
app.use('/api/payments', paymentsRoutes);
app.use('/api/refunds', refundsRoutes);

beforeAll(async () => { await setup.connect(); });
afterAll(async () => { await setup.close(); });

beforeEach(async () => {
  await Promise.all([
    Payment.deleteMany({}),
    Refund.deleteMany({}),
    Child.deleteMany({}),
  ]);
});

// ─── make helpers ─────────────────────────────────────────

async function makeChild(overrides = {}) {
  const { displayId, ...rest } = overrides;
  return Child.create({
    firstName: 'Test',
    lastName: 'Test',
    fatherName: 'Test',
    birthDate: new Date('2020-01-01'),
    phone1: '+994501234567',
    username: `child_${Date.now()}_${Math.random()}@test.com`,
    password: 'pass123',
    package: new (require('mongoose').Types.ObjectId)(),
    group: new (require('mongoose').Types.ObjectId)(),
    startDate: new Date('2024-01-01'),
    isActive: true,
    ...(displayId !== undefined && { displayId }),
    ...rest,
  });
}

async function makePaidPayment(overrides = {}) {
  const { displayId, ...rest } = overrides;
  const child = await makeChild();
  return Payment.create({
    child: child._id,
    amount: 100,
    paidAmount: 100,
    paymentDate: new Date('2024-06-01'),
    serviceMonth: '2024-06',
    remainingBefore: 0,
    remainingAfter: 0,
    isActive: true,
    ...(displayId !== undefined && { displayId }),
    ...rest,
  });
}

async function makeRefund(overrides = {}) {
  const { displayId, ...rest } = overrides;
  const child = await makeChild();
  const admin = new (require('mongoose').Types.ObjectId)();
  return Refund.create({
    child: child._id,
    amount: 50,
    reason: 'Test refund',
    refundDate: new Date('2024-06-01'),
    createdBy: admin,
    isActive: true,
    ...(displayId !== undefined && { displayId }),
    ...rest,
  });
}

// ─── Paid list ──────────────────────────────────────────────
describe('GET /api/payments?type=paid — sort by displayId desc', () => {
  test('sorts by displayId desc (default)', async () => {
    await makePaidPayment({ displayId: '001' });
    await makePaidPayment({ displayId: '003' });
    await makePaidPayment({ displayId: '002' });

    const res = await request(app).get('/api/payments?type=paid');
    expect(res.body.data.map(p => p.displayId)).toEqual(['003', '002', '001']);
  });

  test('records without displayId go to end', async () => {
    await makePaidPayment({ displayId: '001' });
    await makePaidPayment({});
    await makePaidPayment({ displayId: '003' });
    await makePaidPayment({});
    await makePaidPayment({ displayId: '002' });

    const res = await request(app).get('/api/payments?type=paid');
    expect(res.body.data.slice(0, 3).map(p => p.displayId)).toEqual(['003', '002', '001']);
    expect(res.body.data.slice(3).every(p => p.displayId === null || p.displayId === undefined)).toBe(true);
  });
});

// ─── Pending list ───────────────────────────────────────────
describe('GET /api/payments?type=pending — sort by displayId desc', () => {
  test('sorts by displayId desc (default)', async () => {
    await makeChild({ displayId: '001', currentDebt: 100 });
    await makeChild({ displayId: '003', currentDebt: 100 });
    await makeChild({ displayId: '002', currentDebt: 100 });

    const res = await request(app).get('/api/payments?type=pending');
    expect(res.body.data.map(c => c.displayId)).toEqual(['003', '002', '001']);
  });

  test('records without displayId go to end', async () => {
    await makeChild({ displayId: '001', currentDebt: 100 });
    await makeChild({ currentDebt: 100 });
    await makeChild({ displayId: '003', currentDebt: 100 });
    await makeChild({ currentDebt: 100 });
    await makeChild({ displayId: '002', currentDebt: 100 });

    const res = await request(app).get('/api/payments?type=pending');
    expect(res.body.data.slice(0, 3).map(c => c.displayId)).toEqual(['003', '002', '001']);
    expect(res.body.data.slice(3).every(c => c.displayId === null || c.displayId === undefined)).toBe(true);
  });
});

// ─── Refunds list ───────────────────────────────────────────
describe('GET /api/refunds — sort by displayId desc', () => {
  test('sorts by displayId desc (default)', async () => {
    await makeRefund({ displayId: '001' });
    await makeRefund({ displayId: '003' });
    await makeRefund({ displayId: '002' });

    const res = await request(app).get('/api/refunds');
    expect(res.body.data.map(r => r.displayId)).toEqual(['003', '002', '001']);
  });

  test('records without displayId go to end', async () => {
    await makeRefund({ displayId: '001' });
    await makeRefund({});
    await makeRefund({ displayId: '003' });
    await makeRefund({});
    await makeRefund({ displayId: '002' });

    const res = await request(app).get('/api/refunds');
    expect(res.body.data.slice(0, 3).map(r => r.displayId)).toEqual(['003', '002', '001']);
    expect(res.body.data.slice(3).every(r => r.displayId === null || r.displayId === undefined)).toBe(true);
  });
});