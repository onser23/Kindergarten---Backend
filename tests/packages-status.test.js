const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const setup = require('./setup');

jest.mock('../middleware/auth', () => {
  const mockMongoose = require('mongoose');
  return (req, res, next) => {
    req.user = { id: new mockMongoose.Types.ObjectId(), role: 'admin' };
    next();
  };
});

const Package = require('../models/Package');
const packageRoutes = require('../routes/packages');

const app = express();
app.use(express.json());
app.use('/api/packages', packageRoutes);

describe('GET /api/packages — status filter', () => {
  beforeAll(async () => {
    await setup.connect();
  });

  afterAll(async () => {
    await setup.close();
  });

  beforeEach(async () => {
    await Package.deleteMany({});
  });

  async function makePackage(idx, isActive = true) {
    return Package.create({
      name: `Package${idx}`,
      duration: 'Bir aylıq tam gün',
      days: 30,
      price: 100,
      isActive,
    });
  }

  test('status=active returns only active packages', async () => {
    await makePackage(1, true);
    await makePackage(2, false);
    await makePackage(3, true);
    const res = await request(app).get('/api/packages?status=active');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((p) => p.isActive === true)).toBe(true);
  });

  test('status=passive returns only passive packages', async () => {
    await makePackage(1, true);
    await makePackage(2, false);
    await makePackage(3, false);
    const res = await request(app).get('/api/packages?status=passive');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.every((p) => p.isActive === false)).toBe(true);
  });

  test('status=all returns all packages', async () => {
    await makePackage(1, true);
    await makePackage(2, false);
    const res = await request(app).get('/api/packages?status=all');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  test('no status param defaults to all packages', async () => {
    await makePackage(1, true);
    await makePackage(2, false);
    const res = await request(app).get('/api/packages');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  test('status filter reflects in pagination totalPages', async () => {
    for (let i = 1; i <= 25; i++) await makePackage(i, true);
    for (let i = 26; i <= 35; i++) await makePackage(i, false);

    const activeRes = await request(app).get('/api/packages?status=active&page=1&limit=20');
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.total).toBe(25);
    expect(activeRes.body.totalPages).toBe(2);

    const passiveRes = await request(app).get('/api/packages?status=passive&page=1&limit=20');
    expect(passiveRes.status).toBe(200);
    expect(passiveRes.body.total).toBe(10);
    expect(passiveRes.body.totalPages).toBe(1);
  });

  test('status=passive + search filters both correctly', async () => {
    await makePackage(1, true);
    const p2 = await makePackage(2, false);
    p2.name = 'Different';
    await p2.save();
    await makePackage(3, false);
    await makePackage(4, false);
    await makePackage(5, true);
    const res = await request(app).get('/api/packages?status=passive&search=Package');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((p) => !p.isActive && p.name.includes('Package'))).toBe(true);
  });
});