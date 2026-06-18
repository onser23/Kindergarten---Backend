const mongoose = require('mongoose');
const request = require('supertest');
const express = require('express');
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

describe('BUG: paket azaldıqda currentDebt mənfi olmalıdır (ssenari: 500 → ödəniş 500 → paket 150)', () => {
  let pkgAylig, pkgHeftelik, grp, child;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkgAylig = await Package.create({ name: 'Aylıq', price: 500, days: 30, duration: 'Bir aylıq tam gün', isActive: true });
    pkgHeftelik = await Package.create({ name: 'Həftəlik', price: 150, days: 7, duration: 'Həftəlik tam gün', isActive: true });
    grp = await Group.create({ name: 'Q1', ageRange: '1-2', teachers: [], nannies: [], departments: [], isActive: true });
    child = await Child.create({
      firstName: 'Veli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `veli-bug2-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkgAylig._id, group: grp._id, startDate: new Date('2026-06-10'),
      currentDebt: 0  // Ödənişdən sonra currentDebt = 0
    });
  });

  it('PUT paket dəyişdikdə (Aylıq 500 → Həftəlik 150) currentDebt -350 olmalıdır', async () => {
    const res = await request(app)
      .put(`/api/children/${child._id}`)
      .send({ package: pkgHeftelik._id.toString() });
    expect(res.status).toBe(200);
    expect(res.body.data.currentDebt).toBe(-350);
  });

  it('DB-də child.currentDebt -350 olmalıdır', async () => {
    await request(app)
      .put(`/api/children/${child._id}`)
      .send({ package: pkgHeftelik._id.toString() });
    const updated = await Child.findById(child._id);
    expect(updated.currentDebt).toBe(-350);
  });
});
