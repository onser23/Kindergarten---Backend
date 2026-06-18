const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Child = require('../models/Child');
const Package = require('../models/Package');
const Group = require('../models/Group');
const childrenRouter = require('../routes/children');
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
