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

const Teacher = require('../models/Teacher');
const teacherRoutes = require('../routes/teachers');

const app = express();
app.use(express.json());
app.use('/api/teachers', teacherRoutes);

describe('GET /api/teachers — status filter', () => {
  beforeAll(async () => {
    await setup.connect();
  });

  afterAll(async () => {
    await setup.close();
  });

  beforeEach(async () => {
    await Teacher.deleteMany({});
  });

  async function makeTeacher(idx, isActive = true) {
    return Teacher.create({
      firstName: `First${idx}`,
      lastName: `Last${idx}`,
      fatherName: `Father${idx}`,
      phone: `+99450${String(idx).padStart(7, '0')}`,
      birthDate: new Date('1990-01-01'),
      departments: ['Rus dili'],
      isActive,
    });
  }

  test('status=active returns only active teachers', async () => {
    await makeTeacher(1, true);
    await makeTeacher(2, false);
    await makeTeacher(3, true);
    const res = await request(app).get('/api/teachers?status=active');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((t) => t.isActive === true)).toBe(true);
  });

  test('status=passive returns only passive teachers', async () => {
    await makeTeacher(1, true);
    await makeTeacher(2, false);
    await makeTeacher(3, false);
    const res = await request(app).get('/api/teachers?status=passive');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.every((t) => t.isActive === false)).toBe(true);
  });

  test('status=all returns all teachers', async () => {
    await makeTeacher(1, true);
    await makeTeacher(2, false);
    const res = await request(app).get('/api/teachers?status=all');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  test('no status param defaults to all teachers', async () => {
    await makeTeacher(1, true);
    await makeTeacher(2, false);
    const res = await request(app).get('/api/teachers');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  test('status filter reflects in pagination totalPages', async () => {
    for (let i = 1; i <= 25; i++) await makeTeacher(i, true);
    for (let i = 26; i <= 35; i++) await makeTeacher(i, false);

    const activeRes = await request(app).get('/api/teachers?status=active&page=1&limit=20');
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.total).toBe(25);
    expect(activeRes.body.totalPages).toBe(2);

    const passiveRes = await request(app).get('/api/teachers?status=passive&page=1&limit=20');
    expect(passiveRes.status).toBe(200);
    expect(passiveRes.body.total).toBe(10);
    expect(passiveRes.body.totalPages).toBe(1);
  });

  test('status=passive + search filters both correctly', async () => {
    await makeTeacher(1, true);
    const t2 = await makeTeacher(2, false);
    t2.firstName = 'Different';
    await t2.save();
    await makeTeacher(3, false);
    await makeTeacher(4, false);
    await makeTeacher(5, true);
    const res = await request(app).get('/api/teachers?status=passive&search=First');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((t) => !t.isActive && t.firstName.includes('First'))).toBe(true);
  });
});
