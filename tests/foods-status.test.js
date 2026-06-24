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

const Food = require('../models/Food');
const foodRoutes = require('../routes/foods');

const app = express();
app.use(express.json());
app.use('/api/foods', foodRoutes);

describe('GET /api/foods — status filter', () => {
  beforeAll(async () => {
    await setup.connect();
  });

  afterAll(async () => {
    await setup.close();
  });

  beforeEach(async () => {
    await Food.deleteMany({});
  });

  async function makeFood(idx, isActive = true) {
    return Food.create({
      dryFood: `Dry${idx}`,
      soup: `Soup${idx}`,
      salad: '',
      drink: `Drink${idx}`,
      dessert: `Dessert${idx}`,
      fruit: `Fruit${idx}`,
      time: '12:00',
      days: ['Bazar ertəsi'],
      isActive,
    });
  }

  test('status=active returns only active foods', async () => {
    await makeFood(1, true);
    await makeFood(2, false);
    await makeFood(3, true);
    const res = await request(app).get('/api/foods?status=active');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((f) => f.isActive === true)).toBe(true);
  });

  test('status=passive returns only passive foods', async () => {
    await makeFood(1, true);
    await makeFood(2, false);
    await makeFood(3, false);
    const res = await request(app).get('/api/foods?status=passive');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.every((f) => f.isActive === false)).toBe(true);
  });

  test('status=all returns all foods', async () => {
    await makeFood(1, true);
    await makeFood(2, false);
    const res = await request(app).get('/api/foods?status=all');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  test('no status param defaults to all foods', async () => {
    await makeFood(1, true);
    await makeFood(2, false);
    const res = await request(app).get('/api/foods');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  test('status filter reflects in pagination totalPages', async () => {
    // 25 active + 10 passive
    for (let i = 1; i <= 25; i++) await makeFood(i, true);
    for (let i = 26; i <= 35; i++) await makeFood(i, false);

    const activeRes = await request(app).get('/api/foods?status=active&page=1&limit=20');
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.total).toBe(25);
    expect(activeRes.body.totalPages).toBe(2);

    const passiveRes = await request(app).get('/api/foods?status=passive&page=1&limit=20');
    expect(passiveRes.status).toBe(200);
    expect(passiveRes.body.total).toBe(10);
    expect(passiveRes.body.totalPages).toBe(1);
  });
});