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
app.use('/api/lessons', lessonRoutes);

describe('GET /api/lessons — status filter', () => {
  beforeAll(async () => { await setup.connect(); });
  afterAll(async () => { await setup.close(); });
  beforeEach(async () => { await Lesson.deleteMany({}); });

  async function makeLesson(idx, isActive = true) {
    return Lesson.create({
      name: `Lesson${idx}`,
      groups: [new mongoose.Types.ObjectId()],
      days: ['Bazar ertəsi'],
      startTime: '12:00',
      duration: 60,
      teachers: [new mongoose.Types.ObjectId()],
      isActive,
    });
  }

  test('status=active returns only active lessons', async () => {
    await makeLesson(1, true);
    await makeLesson(2, false);
    await makeLesson(3, true);
    const res = await request(app).get('/api/lessons?status=active');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((l) => l.isActive === true)).toBe(true);
  });

  test('status=passive returns only passive lessons', async () => {
    await makeLesson(1, true);
    await makeLesson(2, false);
    await makeLesson(3, false);
    const res = await request(app).get('/api/lessons?status=passive');
    expect(res.body.total).toBe(2);
    expect(res.body.data.every((l) => l.isActive === false)).toBe(true);
  });

  test('status=all returns all lessons', async () => {
    await makeLesson(1, true);
    await makeLesson(2, false);
    const res = await request(app).get('/api/lessons?status=all');
    expect(res.body.total).toBe(2);
  });

  test('no status param defaults to all lessons', async () => {
    await makeLesson(1, true);
    await makeLesson(2, false);
    const res = await request(app).get('/api/lessons');
    expect(res.body.total).toBe(2);
  });

  test('status filter reflects in pagination totalPages', async () => {
    for (let i = 1; i <= 25; i++) await makeLesson(i, true);
    for (let i = 26; i <= 35; i++) await makeLesson(i, false);
    const activeRes = await request(app).get('/api/lessons?status=active&page=1&limit=20');
    expect(activeRes.body.total).toBe(25);
    expect(activeRes.body.totalPages).toBe(2);
    const passiveRes = await request(app).get('/api/lessons?status=passive&page=1&limit=20');
    expect(passiveRes.body.total).toBe(10);
    expect(passiveRes.body.totalPages).toBe(1);
  });

  test('status=passive + search filters both correctly', async () => {
    await makeLesson(1, true);
    const lesson2 = await makeLesson(2, false);
    lesson2.name = 'Different';
    await lesson2.save();
    await makeLesson(3, false);
    await makeLesson(4, false);
    await makeLesson(5, true);
    const res = await request(app).get('/api/lessons?status=passive&search=Lesson');
    expect(res.body.total).toBe(2);
    expect(res.body.data.every((l) => !l.isActive && l.name.includes('Lesson'))).toBe(true);
  });
});
