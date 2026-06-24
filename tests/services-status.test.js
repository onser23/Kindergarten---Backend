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

const Service = require('../models/Service');
const serviceRoutes = require('../routes/services');

const app = express();
app.use(express.json());
app.use('/api/services', serviceRoutes);

describe('GET /api/services — status filter', () => {
  beforeAll(async () => {
    await setup.connect();
  });

  afterAll(async () => {
    await setup.close();
  });

  beforeEach(async () => {
    await Service.deleteMany({});
  });

  async function makeService(idx, isActive = true) {
    return Service.create({
      name: `Service${idx}`,
      days: ['Bazar ertəsi'],
      startTime: '09:00',
      isActive,
    });
  }

  test('status=active returns only active services', async () => {
    await makeService(1, true);
    await makeService(2, false);
    await makeService(3, true);
    const res = await request(app).get('/api/services?status=active');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((s) => s.isActive === true)).toBe(true);
  });

  test('status=passive returns only passive services', async () => {
    await makeService(1, true);
    await makeService(2, false);
    await makeService(3, false);
    const res = await request(app).get('/api/services?status=passive');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.every((s) => s.isActive === false)).toBe(true);
  });

  test('status=all returns all services', async () => {
    await makeService(1, true);
    await makeService(2, false);
    const res = await request(app).get('/api/services?status=all');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  test('no status param defaults to all services', async () => {
    await makeService(1, true);
    await makeService(2, false);
    const res = await request(app).get('/api/services');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  test('status filter reflects in pagination totalPages', async () => {
    for (let i = 1; i <= 25; i++) await makeService(i, true);
    for (let i = 26; i <= 35; i++) await makeService(i, false);

    const activeRes = await request(app).get('/api/services?status=active&page=1&limit=20');
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.total).toBe(25);
    expect(activeRes.body.totalPages).toBe(2);

    const passiveRes = await request(app).get('/api/services?status=passive&page=1&limit=20');
    expect(passiveRes.status).toBe(200);
    expect(passiveRes.body.total).toBe(10);
    expect(passiveRes.body.totalPages).toBe(1);
  });

  test('status=passive + search filters both correctly', async () => {
    await makeService(1, true);
    const s2 = await makeService(2, false);
    s2.name = 'Different';
    await s2.save();
    await makeService(3, false);
    await makeService(4, false);
    await makeService(5, true);
    const res = await request(app).get('/api/services?status=passive&search=Service');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((s) => !s.isActive && s.name.includes('Service'))).toBe(true);
  });
});
