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

const Lesson = require('../models/Lesson');
const lessonRoutes = require('../routes/lessons');

const app = express();
app.use(express.json());
app.use('/api/activities', lessonRoutes);

describe('GET /api/activities — group & teacher filter', () => {
  beforeAll(async () => { await setup.connect(); });
  afterAll(async () => { await setup.close(); });
  beforeEach(async () => { await Lesson.deleteMany({}); });

  async function makeLesson(overrides = {}) {
    return Lesson.create({
      name: 'Test Lesson',
      groups: [new mongoose.Types.ObjectId()],
      days: ['Bazar ertəsi'],
      startTime: '10:00',
      duration: 45,
      teachers: [new mongoose.Types.ObjectId()],
      isActive: true,
      ...overrides,
    });
  }

  test('filter by single group returns only lessons in that group', async () => {
    const groupA = new mongoose.Types.ObjectId();
    const groupB = new mongoose.Types.ObjectId();
    await makeLesson({ name: 'L1', groups: [groupA] });
    await makeLesson({ name: 'L2', groups: [groupB] });
    await makeLesson({ name: 'L3', groups: [groupA] });

    const res = await request(app).get(`/api/activities?groups=${groupA}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.map(l => l.name).sort()).toEqual(['L1', 'L3']);
  });

  test('filter by multiple groups returns lessons in any of those groups (OR)', async () => {
    const groupA = new mongoose.Types.ObjectId();
    const groupB = new mongoose.Types.ObjectId();
    const groupC = new mongoose.Types.ObjectId();
    await makeLesson({ name: 'L1', groups: [groupA] });
    await makeLesson({ name: 'L2', groups: [groupB] });
    await makeLesson({ name: 'L3', groups: [groupC] });
    await makeLesson({ name: 'L4', groups: [groupA, groupB] });

    const res = await request(app).get(`/api/activities?groups=${groupA}&groups=${groupB}`);

    expect(res.body.total).toBe(3);
    expect(res.body.data.map(l => l.name).sort()).toEqual(['L1', 'L2', 'L4']);
  });

  test('filter by single teacher returns only lessons taught by that teacher', async () => {
    const teacherA = new mongoose.Types.ObjectId();
    const teacherB = new mongoose.Types.ObjectId();
    await makeLesson({ name: 'L1', teachers: [teacherA] });
    await makeLesson({ name: 'L2', teachers: [teacherB] });
    await makeLesson({ name: 'L3', teachers: [teacherA] });

    const res = await request(app).get(`/api/activities?teachers=${teacherA}`);

    expect(res.body.total).toBe(2);
    expect(res.body.data.map(l => l.name).sort()).toEqual(['L1', 'L3']);
  });

  test('filter by multiple teachers returns lessons taught by any of those teachers (OR)', async () => {
    const teacherA = new mongoose.Types.ObjectId();
    const teacherB = new mongoose.Types.ObjectId();
    const teacherC = new mongoose.Types.ObjectId();
    await makeLesson({ name: 'L1', teachers: [teacherA] });
    await makeLesson({ name: 'L2', teachers: [teacherB] });
    await makeLesson({ name: 'L3', teachers: [teacherC] });
    await makeLesson({ name: 'L4', teachers: [teacherA, teacherB] });

    const res = await request(app).get(`/api/activities?teachers=${teacherA}&teachers=${teacherB}`);

    expect(res.body.total).toBe(3);
    expect(res.body.data.map(l => l.name).sort()).toEqual(['L1', 'L2', 'L4']);
  });

  test('combined groups + teachers returns lessons matching both (AND)', async () => {
    const groupA = new mongoose.Types.ObjectId();
    const groupB = new mongoose.Types.ObjectId();
    const teacherX = new mongoose.Types.ObjectId();
    const teacherY = new mongoose.Types.ObjectId();
    await makeLesson({ name: 'L1', groups: [groupA], teachers: [teacherX] });
    await makeLesson({ name: 'L2', groups: [groupA], teachers: [teacherY] });
    await makeLesson({ name: 'L3', groups: [groupB], teachers: [teacherX] });
    await makeLesson({ name: 'L4', groups: [groupA], teachers: [teacherX] });

    const res = await request(app).get(`/api/activities?groups=${groupA}&teachers=${teacherX}`);

    expect(res.body.total).toBe(2);
    expect(res.body.data.map(l => l.name).sort()).toEqual(['L1', 'L4']);
  });

  test('group filter combines correctly with status, search and pagination', async () => {
    const groupA = new mongoose.Types.ObjectId();
    for (let i = 1; i <= 25; i++) {
      await makeLesson({
        name: `Riyaziyyat${i}`,
        groups: [groupA],
        isActive: i % 2 === 0,
      });
    }
    await makeLesson({ name: 'RiyaziyyatSpecial', groups: [groupA], isActive: true });
    await makeLesson({ name: 'Fizika1', groups: [groupA], isActive: true });

    const res = await request(app).get(
      `/api/activities?groups=${groupA}&status=active&search=Riyaziyyat&page=2&limit=5`
    );

    // Aktiv Riyaziyyat: 25/2 = 12 (cüt) + 1 Special = 13
    expect(res.body.total).toBe(13);
    expect(res.body.totalPages).toBe(3);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.data.every(l => l.isActive && l.name.includes('Riyaziyyat'))).toBe(true);
  });

  test('no group/teacher filter returns all lessons (regression)', async () => {
    await makeLesson({ name: 'L1' });
    await makeLesson({ name: 'L2' });
    await makeLesson({ name: 'L3' });

    const res = await request(app).get('/api/activities');

    expect(res.body.total).toBe(3);
    expect(res.body.data).toHaveLength(3);
  });
});
