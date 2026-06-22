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

const Event = require('../models/Event');
const Group = require('../models/Group');
const eventRoutes = require('../routes/events');

const app = express();
app.use(express.json());
app.use('/api/events', eventRoutes);

describe('GET /api/events pagination', () => {
  let group;

  beforeAll(async () => {
    await setup.connect();
  });

  afterAll(async () => {
    await setup.close();
  });

  beforeEach(async () => {
    await Event.deleteMany({});
    await Group.deleteMany({});
    group = await Group.create({
      name: `G-${Date.now()}`,
      ageRange: '3-4',
      departments: ['Rus dili'],
      teachers: [],
      nannies: []
    });
  });

  async function makeEvent(idx) {
    return Event.create({
      name: `Event${idx}`,
      groups: [group._id],
      startDate: new Date(2026, 0, idx + 1),
      startTime: '10:00',
      endDate: new Date(2026, 0, idx + 1)
    });
  }

  test('25 events: default page=1 limit=20 returns 20 + total=25', async () => {
    for (let i = 0; i < 25; i++) await makeEvent(i);
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(20);
    expect(res.body.total).toBe(25);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(2);
    expect(res.body.count).toBe(20);
  });

  test('page=2 returns 5 items', async () => {
    for (let i = 0; i < 25; i++) await makeEvent(i);
    const res = await request(app).get('/api/events?page=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.page).toBe(2);
  });

  test('search filter reduces total', async () => {
    for (let i = 0; i < 10; i++) await makeEvent(i);
    await makeEvent(99);
    const res = await request(app).get('/api/events?search=Event99');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data).toHaveLength(1);
  });

  test('empty result: search="zzz" returns data=[]', async () => {
    await makeEvent(1);
    const res = await request(app).get('/api/events?search=zzz');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.totalPages).toBe(0);
  });
});