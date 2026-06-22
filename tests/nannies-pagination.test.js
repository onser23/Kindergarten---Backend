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

const Nanny = require('../models/Nanny');
const nannyRoutes = require('../routes/nannies');

const app = express();
app.use(express.json());
app.use('/api/nannies', nannyRoutes);

describe('GET /api/nannies pagination', () => {
  beforeAll(async () => {
    await setup.connect();
  });

  afterAll(async () => {
    await setup.close();
  });

  beforeEach(async () => {
    await Nanny.deleteMany({});
  });

  async function makeNanny(idx) {
    return Nanny.create({
      firstName: `Ad${idx}`,
      lastName: `Soyad${idx}`,
      fatherName: `Ata${idx}`,
      phone: `+99450${String(1000000 + idx).slice(-7)}`,
      birthDate: new Date('1990-01-01'),
      password: 'pass123',
      salary: 500
    });
  }

  test('25 nannies: default page=1 limit=20 returns 20 + total=25', async () => {
    for (let i = 0; i < 25; i++) await makeNanny(i);
    const res = await request(app).get('/api/nannies');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(20);
    expect(res.body.total).toBe(25);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(2);
  });

  test('page=2 returns 5 items', async () => {
    for (let i = 0; i < 25; i++) await makeNanny(i);
    const res = await request(app).get('/api/nannies?page=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.page).toBe(2);
  });

  test('search filter reduces total', async () => {
    for (let i = 0; i < 10; i++) await makeNanny(i);
    await makeNanny(99);
    const res = await request(app).get('/api/nannies?search=Ad99');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data).toHaveLength(1);
  });

  test('empty result: search="zzz" returns data=[]', async () => {
    await makeNanny(1);
    const res = await request(app).get('/api/nannies?search=zzz');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.totalPages).toBe(0);
  });
});