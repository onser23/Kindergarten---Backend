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
const eventRoutes = require('../routes/events');

const app = express();
app.use(express.json());
app.use('/api/events', eventRoutes);

describe('GET /api/events — status filter', () => {
  beforeAll(async () => { await setup.connect(); });
  afterAll(async () => { await setup.close(); });
  beforeEach(async () => { await Event.deleteMany({}); });

  async function makeEvent(idx, isActive = true) {
    return Event.create({
      name: `Event${idx}`,
      groups: [new mongoose.Types.ObjectId()],
      startDate: new Date('2026-01-01'),
      startTime: '12:00',
      endDate: new Date('2026-01-02'),
      isActive,
    });
  }

  test('status=active returns only active events', async () => {
    await makeEvent(1, true);
    await makeEvent(2, false);
    await makeEvent(3, true);
    const res = await request(app).get('/api/events?status=active');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((e) => e.isActive === true)).toBe(true);
  });

  test('status=passive returns only passive events', async () => {
    await makeEvent(1, true);
    await makeEvent(2, false);
    await makeEvent(3, false);
    const res = await request(app).get('/api/events?status=passive');
    expect(res.body.total).toBe(2);
    expect(res.body.data.every((e) => e.isActive === false)).toBe(true);
  });

  test('status=all returns all events', async () => {
    await makeEvent(1, true);
    await makeEvent(2, false);
    const res = await request(app).get('/api/events?status=all');
    expect(res.body.total).toBe(2);
  });

  test('no status param defaults to all events', async () => {
    await makeEvent(1, true);
    await makeEvent(2, false);
    const res = await request(app).get('/api/events');
    expect(res.body.total).toBe(2);
  });

  test('status filter reflects in pagination totalPages', async () => {
    for (let i = 1; i <= 25; i++) await makeEvent(i, true);
    for (let i = 26; i <= 35; i++) await makeEvent(i, false);
    const activeRes = await request(app).get('/api/events?status=active&page=1&limit=20');
    expect(activeRes.body.total).toBe(25);
    expect(activeRes.body.totalPages).toBe(2);
    const passiveRes = await request(app).get('/api/events?status=passive&page=1&limit=20');
    expect(passiveRes.body.total).toBe(10);
    expect(passiveRes.body.totalPages).toBe(1);
  });

  test('status=passive + search filters both correctly', async () => {
    await makeEvent(1, true);
    const event2 = await makeEvent(2, false);
    event2.name = 'Different';
    await event2.save();
    await makeEvent(3, false);
    await makeEvent(4, false);
    await makeEvent(5, true);
    const res = await request(app).get('/api/events?status=passive&search=Event');
    expect(res.body.total).toBe(2);
    expect(res.body.data.every((e) => !e.isActive && e.name.includes('Event'))).toBe(true);
  });
});