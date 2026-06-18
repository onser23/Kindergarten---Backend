const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Child = require('../models/Child');
const Package = require('../models/Package');
const Group = require('../models/Group');
const childrenRouter = require('../routes/children');

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
const setup = require('./setup');

describe('PATCH /api/children/:id/status — toggle status', () => {
  let pkg, grp, child;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Premium', price: 150, days: 30, isActive: true });
    grp = await Group.create({ name: 'Q1', departments: [], teachers: [], nannies: [], ageRange: '1-2', isActive: true });
    child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      isActive: true
    });
  });

  it('deactivates active child', async () => {
    const res = await request(app)
      .patch(`/api/children/${child._id}/status`)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.message).toContain('passiv');
  });

  it('reactivates passive child', async () => {
    child.isActive = false;
    await child.save();
    const res = await request(app)
      .patch(`/api/children/${child._id}/status`)
      .send({ isActive: true });
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.message).toContain('aktiv');
  });

  it('rejects non-boolean isActive', async () => {
    const res = await request(app)
      .patch(`/api/children/${child._id}/status`)
      .send({ isActive: 'yes' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent child', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .patch(`/api/children/${fakeId}/status`)
      .send({ isActive: false });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/children/:id — endpoint removed', () => {
  let pkg, grp, child;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Premium', price: 150, days: 30, isActive: true });
    grp = await Group.create({ name: 'Q2', departments: [], teachers: [], nannies: [], ageRange: '1-2', isActive: true });
    child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      isActive: true
    });
  });

  it('DELETE endpoint no longer exists (returns 404)', async () => {
    const res = await request(app).delete(`/api/children/${child._id}`);
    expect(res.status).toBe(404);
    const found = await Child.findById(child._id);
    expect(found.isActive).toBe(true);
  });
});

describe('GET /api/children — status filter', () => {
  let pkg, grp;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Premium', price: 150, days: 30, isActive: true });
    grp = await Group.create({ name: 'Q3', departments: [], teachers: [], nannies: [], ageRange: '1-2', isActive: true });
  });

  async function createChild(isActive, idx) {
    return Child.create({
      firstName: isActive ? 'Active' : 'Passive',
      lastName: `Test${idx}`,
      birthDate: new Date('2020-01-01'),
      phone1: `+9945012345${String(idx).padStart(2, '0')}`,
      username: `${isActive ? 'active' : 'passive'}${idx}-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-10'),
      isActive
    });
  }

  it('default returns only active children', async () => {
    await createChild(true, 0);
    await createChild(false, 1);
    const res = await request(app).get('/api/children');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].firstName).toBe('Active');
  });

  it('status=passive returns only passive children', async () => {
    await createChild(true, 0);
    await createChild(false, 1);
    const res = await request(app).get('/api/children?status=passive');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].firstName).toBe('Passive');
  });

  it('status=all returns all children', async () => {
    await createChild(true, 0);
    await createChild(false, 1);
    const res = await request(app).get('/api/children?status=all');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});
