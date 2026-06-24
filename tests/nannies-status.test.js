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

describe('GET /api/nannies — status filter', () => {
  beforeAll(async () => {
    await setup.connect();
  });

  afterAll(async () => {
    await setup.close();
  });

  beforeEach(async () => {
    await Nanny.deleteMany({});
  });

  async function makeNanny(idx, isActive = true) {
    return Nanny.create({
      firstName: `First${idx}`,
      lastName: `Last${idx}`,
      fatherName: `Father${idx}`,
      phone: `+99450${String(idx).padStart(7, '0')}`,
      birthDate: new Date('1990-01-01'),
      isActive,
    });
  }

  test('status=active returns only active nannies', async () => {
    await makeNanny(1, true);
    await makeNanny(2, false);
    await makeNanny(3, true);
    const res = await request(app).get('/api/nannies?status=active');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((n) => n.isActive === true)).toBe(true);
  });

  test('status=passive returns only passive nannies', async () => {
    await makeNanny(1, true);
    await makeNanny(2, false);
    await makeNanny(3, false);
    const res = await request(app).get('/api/nannies?status=passive');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.every((n) => n.isActive === false)).toBe(true);
  });

  test('status=all returns all nannies', async () => {
    await makeNanny(1, true);
    await makeNanny(2, false);
    const res = await request(app).get('/api/nannies?status=all');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  test('no status param defaults to all nannies', async () => {
    await makeNanny(1, true);
    await makeNanny(2, false);
    const res = await request(app).get('/api/nannies');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  test('status filter reflects in pagination totalPages', async () => {
    for (let i = 1; i <= 25; i++) await makeNanny(i, true);
    for (let i = 26; i <= 35; i++) await makeNanny(i, false);

    const activeRes = await request(app).get('/api/nannies?status=active&page=1&limit=20');
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.total).toBe(25);
    expect(activeRes.body.totalPages).toBe(2);

    const passiveRes = await request(app).get('/api/nannies?status=passive&page=1&limit=20');
    expect(passiveRes.status).toBe(200);
    expect(passiveRes.body.total).toBe(10);
    expect(passiveRes.body.totalPages).toBe(1);
  });

  test('status=passive + search filters both correctly', async () => {
    await makeNanny(1, true);
    const n2 = await makeNanny(2, false);
    n2.firstName = 'Different';
    await n2.save();
    await makeNanny(3, false);
    await makeNanny(4, false);
    await makeNanny(5, true);
    const res = await request(app).get('/api/nannies?status=passive&search=First');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((n) => !n.isActive && n.firstName.includes('First'))).toBe(true);
  });
});
