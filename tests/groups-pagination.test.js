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
const Teacher = require('../models/Teacher');
const Nanny = require('../models/Nanny');
const groupRoutes = require('../routes/groups');

const app = express();
app.use(express.json());
app.use('/api/groups', groupRoutes);

describe('GET /api/groups pagination', () => {
  let teacher, nanny;

  beforeAll(async () => {
    await setup.connect();
  });

  afterAll(async () => {
    await setup.close();
  });

  beforeEach(async () => {
    await Group.deleteMany({});
    await Teacher.deleteMany({});
    await Nanny.deleteMany({});
    teacher = await Teacher.create({
      firstName: 'T',
      lastName: 'Tsoyad',
      fatherName: 'TAta',
      phone: '+994501234567',
      birthDate: new Date('1990-01-01'),
      password: 'pass123',
      salary: 800
    });
    nanny = await Nanny.create({
      firstName: 'B',
      lastName: 'Bsoyad',
      fatherName: 'BAta',
      phone: '+994507654321',
      birthDate: new Date('1990-01-01'),
      password: 'pass123',
      salary: 500
    });
  });

  async function makeGroup(idx) {
    return Group.create({
      name: `Group${idx}-${Date.now()}-${Math.random()}`,
      ageRange: '3-4',
      departments: ['Rus dili'],
      teachers: [teacher._id],
      nannies: [nanny._id]
    });
  }

  test('25 groups: default page=1 limit=20 returns 20 + total=25', async () => {
    for (let i = 0; i < 25; i++) await makeGroup(i);
    const res = await request(app).get('/api/groups');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(20);
    expect(res.body.total).toBe(25);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(2);
  });

  test('page=2 returns 5 items', async () => {
    for (let i = 0; i < 25; i++) await makeGroup(i);
    const res = await request(app).get('/api/groups?page=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.page).toBe(2);
  });

  test('search filter reduces total', async () => {
    for (let i = 0; i < 10; i++) await makeGroup(i);
    await makeGroup(99);
    const res = await request(app).get('/api/groups?search=Group99');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data).toHaveLength(1);
  });

  test('empty result: search="zzz" returns data=[]', async () => {
    await makeGroup(1);
    const res = await request(app).get('/api/groups?search=zzz');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.totalPages).toBe(0);
  });
});