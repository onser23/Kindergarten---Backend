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

const Child = require('../models/Child');
const Package = require('../models/Package');
const Group = require('../models/Group');
const childRoutes = require('../routes/children');

const app = express();
app.use(express.json());
app.use('/api/children', childRoutes);

describe('GET /api/children pagination', () => {
  let pkg, group;

  beforeAll(async () => {
    await setup.connect();
  });

  afterAll(async () => {
    await setup.close();
  });

  beforeEach(async () => {
    await Child.deleteMany({});
    await Package.deleteMany({});
    await Group.deleteMany({});
    pkg = await Package.create({
      name: 'P', services: [], lessons: [],
      duration: 'Bir aylıq tam gün', days: 30, price: 100
    });
    group = await Group.create({
      name: `G-${Date.now()}`, departments: ['Rus dili'],
      teachers: [], nannies: [], ageRange: '3-4'
    });
  });

  async function makeChild(idx) {
    return Child.create({
      firstName: `Ad${idx}`,
      lastName: `Soyad${idx}`,
      username: `u${idx}-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      phone1: `+99450${String(1000000 + idx).slice(-7)}`,
      birthDate: new Date('2020-01-01'),
      package: pkg._id, group: group._id,
      startDate: new Date(), currentDebt: 0
    });
  }

  test('25 children: default page=1 limit=20 returns 20 + total=25', async () => {
    for (let i = 0; i < 25; i++) await makeChild(i);
    const res = await request(app).get('/api/children');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(20);
    expect(res.body.total).toBe(25);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(2);
    expect(res.body.count).toBe(20);
  });

  test('page=2 returns 5 items', async () => {
    for (let i = 0; i < 25; i++) await makeChild(i);
    const res = await request(app).get('/api/children?page=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.page).toBe(2);
  });

  test('limit=10 returns 10 items', async () => {
    for (let i = 0; i < 25; i++) await makeChild(i);
    const res = await request(app).get('/api/children?limit=10');
    expect(res.body.data).toHaveLength(10);
    expect(res.body.totalPages).toBe(3);
  });

  test('empty result: total=0, totalPages=0', async () => {
    const res = await request(app).get('/api/children');
    expect(res.body.data).toHaveLength(0);
    expect(res.body.total).toBe(0);
    expect(res.body.totalPages).toBe(0);
  });
});