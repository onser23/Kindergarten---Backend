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

const Group = require('../models/Group');
const groupRoutes = require('../routes/groups');

const app = express();
app.use(express.json());
app.use('/api/groups', groupRoutes);

describe('GET /api/groups — status filter', () => {
  beforeAll(async () => { await setup.connect(); });
  afterAll(async () => { await setup.close(); });
  beforeEach(async () => { await Group.deleteMany({}); });

  async function makeGroup(idx, isActive = true) {
    return Group.create({
      name: `Group${idx}`,
      departments: ['Azərbaycan dili'],
      teachers: [new mongoose.Types.ObjectId()],
      nannies: [new mongoose.Types.ObjectId()],
      ageRange: '3-4',
      isActive,
    });
  }

  test('status=active returns only active groups', async () => {
    await makeGroup(1, true);
    await makeGroup(2, false);
    await makeGroup(3, true);
    const res = await request(app).get('/api/groups?status=active');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((g) => g.isActive === true)).toBe(true);
  });

  test('status=passive returns only passive groups', async () => {
    await makeGroup(1, true);
    await makeGroup(2, false);
    await makeGroup(3, false);
    const res = await request(app).get('/api/groups?status=passive');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.every((g) => g.isActive === false)).toBe(true);
  });

  test('status=all returns all groups', async () => {
    await makeGroup(1, true);
    await makeGroup(2, false);
    const res = await request(app).get('/api/groups?status=all');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  test('no status param defaults to all groups', async () => {
    await makeGroup(1, true);
    await makeGroup(2, false);
    const res = await request(app).get('/api/groups');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  test('status filter reflects in pagination totalPages', async () => {
    for (let i = 1; i <= 25; i++) await makeGroup(i, true);
    for (let i = 26; i <= 35; i++) await makeGroup(i, false);

    const activeRes = await request(app).get('/api/groups?status=active&page=1&limit=20');
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.total).toBe(25);
    expect(activeRes.body.totalPages).toBe(2);

    const passiveRes = await request(app).get('/api/groups?status=passive&page=1&limit=20');
    expect(passiveRes.status).toBe(200);
    expect(passiveRes.body.total).toBe(10);
    expect(passiveRes.body.totalPages).toBe(1);
  });

  test('status=passive + search filters both correctly', async () => {
    await makeGroup(1, true);
    const g2 = await makeGroup(2, false);
    g2.name = 'Different';
    await g2.save();
    await makeGroup(3, false);
    await makeGroup(4, false);
    await makeGroup(5, true);
    const res = await request(app).get('/api/groups?status=passive&search=Group');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((g) => !g.isActive && g.name.includes('Group'))).toBe(true);
  });
});