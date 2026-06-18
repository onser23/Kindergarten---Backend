const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Child = require('../models/Child');
const Package = require('../models/Package');
const Group = require('../models/Group');
const childrenRouter = require('../routes/children');
const cronRouter = require('../routes/cron');
const setup = require('./setup');

jest.mock('../middleware/auth', () => {
  const mockMongoose = require('mongoose');
  return (req, res, next) => {
    req.user = { id: new mockMongoose.Types.ObjectId(), role: 'admin' };
    next();
  };
});

const app = express();
app.use(express.json());
app.use('/api/children', childrenRouter);

const cronApp = express();
cronApp.use(express.json());
cronApp.use('/api/cron', cronRouter);

describe('nextDueDate on child registration', () => {
  let pkg, grp, dailyPkg;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Aylıq', price: 500, days: 30, duration: 'Bir aylıq tam gün', isActive: true });
    dailyPkg = await Package.create({ name: 'Günlük', price: 50, days: 1, duration: 'Günlük', isActive: true });
    grp = await Group.create({ name: 'Q1', departments: [], teachers: [], nannies: [], ageRange: '1-2', isActive: true });
  });

  it('sets nextDueDate to startDate + package.days for periodic package', async () => {
    const startDate = '2026-06-10';
    const res = await request(app)
      .post('/api/children')
      .send({
        firstName: 'Veli', lastName: 'Veliyev', birthDate: '2020-01-01',
        phone1: '+994501234567',
        username: `veli-reg-${Date.now()}-${Math.random()}@test.com`,
        password: 'pass123',
        package: pkg._id, group: grp._id, startDate
      });

    expect(res.status).toBe(201);
    expect(res.body.data.nextDueDate).toBeTruthy();
    const expected = new Date(startDate);
    expected.setDate(expected.getDate() + 30);
    expect(new Date(res.body.data.nextDueDate).toISOString().slice(0, 10))
      .toBe(expected.toISOString().slice(0, 10));
  });

  it('sets nextDueDate to null for daily package', async () => {
    const res = await request(app)
      .post('/api/children')
      .send({
        firstName: 'Veli', lastName: 'Veliyev', birthDate: '2020-01-01',
        phone1: '+994501234567',
        username: `veli-daily-${Date.now()}-${Math.random()}@test.com`,
        password: 'pass123',
        package: dailyPkg._id, group: grp._id, startDate: '2026-06-10'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.nextDueDate).toBeNull();
  });
});

describe('GET /api/cron/sync-due-dates', () => {
  let pkg, grp, child;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    process.env.CRON_SECRET = 'test-secret';
    pkg = await Package.create({ name: 'Aylıq', price: 500, days: 30, duration: 'Bir aylıq tam gün', isActive: true });
    grp = await Group.create({ name: 'Q1', departments: [], teachers: [], nannies: [], ageRange: '1-2', isActive: true });
    child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-cron-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt: 0,
      nextDueDate: null
    });
  });

  it('returns 401 without x-cron-secret header', async () => {
    const res = await request(cronApp).get('/api/cron/sync-due-dates');
    expect(res.status).toBe(401);
  });

  it('backfills nextDueDate for legacy child with valid header', async () => {
    const res = await request(cronApp)
      .get('/api/cron/sync-due-dates')
      .set('x-cron-secret', 'test-secret');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.synced).toBeGreaterThan(0);

    const updated = await Child.findById(child._id);
    expect(updated.nextDueDate).toBeTruthy();
  });
});
