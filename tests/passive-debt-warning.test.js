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

describe('PATCH /api/children/:id/status — passive debt warning', () => {
  let pkg, grp;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Premium', price: 500, days: 30, isActive: true });
    grp = await Group.create({
      name: 'Q1', departments: [], teachers: [], nannies: [], ageRange: '1-2', isActive: true
    });
  });

  it('returns 400 when currentDebt > 0 and no passiveReason', async () => {
    const child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-1-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt: 100
    });

    const res = await request(app)
      .patch(`/api/children/${child._id}/status`)
      .send({ isActive: false });

    expect(res.status).toBe(400);
    expect(res.body.requiresReason).toBe(true);
    expect(res.body.currentDebt).toBe(100);
  });

  it('returns 400 when currentDebt > 0 and passiveReason is too short', async () => {
    const child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-2-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt: 100
    });

    const res = await request(app)
      .patch(`/api/children/${child._id}/status`)
      .send({ isActive: false, passiveReason: 'ab' });

    expect(res.status).toBe(400);
    expect(res.body.requiresReason).toBe(true);
  });

  it('saves reason when currentDebt > 0 and valid reason (5+ chars)', async () => {
    const child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-3-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt: 250
    });

    const res = await request(app)
      .patch(`/api/children/${child._id}/status`)
      .send({ isActive: false, passiveReason: 'Ailə köçdü' });

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.passiveReason).toBe('Ailə köçdü');
    expect(res.body.data.passiveDebt).toBe(250);
    expect(res.body.data.passiveDate).toBeTruthy();
  });

  it('succeeds without reason when currentDebt <= 0', async () => {
    const child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-4-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt: 0
    });

    const res = await request(app)
      .patch(`/api/children/${child._id}/status`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.passiveReason).toBe('');
  });

  it('preserves passiveReason when reactivating child', async () => {
    const child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-5-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt: 100,
      isActive: false,
      passiveReason: 'Köhnə səbəb',
      passiveDate: new Date('2026-05-01'),
      passiveDebt: 100
    });

    const res = await request(app)
      .patch(`/api/children/${child._id}/status`)
      .send({ isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.passiveReason).toBe('Köhnə səbəb');
    expect(res.body.data.passiveDebt).toBe(100);
  });
});
