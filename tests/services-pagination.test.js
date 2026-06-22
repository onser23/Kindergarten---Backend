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

describe('GET /api/services pagination', () => {
  beforeAll(async () => {
    await setup.connect();
  });

  afterAll(async () => {
    await setup.close();
  });

  beforeEach(async () => {
    await Service.deleteMany({});
  });

  async function makeService(idx) {
    return Service.create({
      name: `Service${idx}-${Date.now()}-${Math.random()}`,
      startTime: `${10 + (idx % 8)}:00`,
      days: ['Bazar ertəsi', 'Çərşənbə']
    });
  }

  test('25 services: default page=1 limit=20 returns 20 + total=25', async () => {
    for (let i = 0; i < 25; i++) await makeService(i);
    const res = await request(app).get('/api/services');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(20);
    expect(res.body.total).toBe(25);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(2);
  });

  test('page=2 returns 5 items', async () => {
    for (let i = 0; i < 25; i++) await makeService(i);
    const res = await request(app).get('/api/services?page=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.page).toBe(2);
  });

  test('search filter reduces total', async () => {
    for (let i = 0; i < 10; i++) await makeService(i);
    await makeService(99);
    const res = await request(app).get('/api/services?search=Service99');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data).toHaveLength(1);
  });

  test('empty result: search="zzz" returns data=[]', async () => {
    await makeService(1);
    const res = await request(app).get('/api/services?search=zzz');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.totalPages).toBe(0);
  });
});