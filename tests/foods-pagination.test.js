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

describe('GET /api/foods pagination', () => {
  beforeAll(async () => {
    await setup.connect();
  });

  afterAll(async () => {
    await setup.close();
  });

  beforeEach(async () => {
    await Food.deleteMany({});
  });

  async function makeFood(idx) {
    return Food.create({
      dryFood: `Dry${idx}`,
      soup: `Soup${idx}`,
      drink: `Drink${idx}`,
      dessert: `Dessert${idx}`,
      fruit: `Fruit${idx}`,
      time: '12:00',
      days: ['Bazar ertəsi', 'Çərşənbə']
    });
  }

  test('25 foods: default page=1 limit=20 returns 20 + total=25', async () => {
    for (let i = 0; i < 25; i++) await makeFood(i);
    const res = await request(app).get('/api/foods');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(20);
    expect(res.body.total).toBe(25);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(2);
  });

  test('page=2 returns 5 items', async () => {
    for (let i = 0; i < 25; i++) await makeFood(i);
    const res = await request(app).get('/api/foods?page=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.page).toBe(2);
  });

  test('search filter reduces total', async () => {
    for (let i = 0; i < 10; i++) await makeFood(i);
    const res = await request(app).get('/api/foods?search=Soup5');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data).toHaveLength(1);
  });

  test('empty result: search="zzz" returns data=[]', async () => {
    await makeFood(1);
    const res = await request(app).get('/api/foods?search=zzz');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.totalPages).toBe(0);
  });
});