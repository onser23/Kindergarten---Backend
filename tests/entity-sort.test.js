const request = require('supertest');
const express = require('express');
const setup = require('./setup');

jest.mock('../middleware/auth', () => {
  const mockMongoose = require('mongoose');
  return (req, res, next) => {
    req.user = { id: new mockMongoose.Types.ObjectId(), role: 'admin' };
    next();
  };
});

const Child = require('../models/Child');
const Group = require('../models/Group');
const Nanny = require('../models/Nanny');
const Package = require('../models/Package');
const Teacher = require('../models/Teacher');
const Lesson = require('../models/Lesson');
const Event = require('../models/Event');
const Service = require('../models/Service');

const childrenRoutes = require('../routes/children');
const groupsRoutes = require('../routes/groups');
const nanniesRoutes = require('../routes/nannies');
const packagesRoutes = require('../routes/packages');
const teachersRoutes = require('../routes/teachers');
const lessonRoutes = require('../routes/lessons');
const eventsRoutes = require('../routes/events');
const servicesRoutes = require('../routes/services');

const app = express();
app.use(express.json());
app.use('/api/children', childrenRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/nannies', nanniesRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/activities', lessonRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/services', servicesRoutes);

beforeAll(async () => { await setup.connect(); });
afterAll(async () => { await setup.close(); });

beforeEach(async () => {
  await Promise.all([
    Child.deleteMany({}), Group.deleteMany({}), Nanny.deleteMany({}),
    Package.deleteMany({}), Teacher.deleteMany({}), Lesson.deleteMany({}),
    Event.deleteMany({}), Service.deleteMany({}),
  ]);
});

// ─── make helpers (per model) ─────────────────────────────────────────

async function makeChild(overrides = {}) {
  const { displayId, ...rest } = overrides;
  return Child.create({
    firstName: 'Test',
    lastName: 'Test',
    fatherName: 'Test',
    birthDate: new Date('2020-01-01'),
    phone1: '+994501234567',
    username: `child_${Date.now()}_${Math.random()}@test.com`,
    password: 'pass123',
    package: new (require('mongoose').Types.ObjectId)(),
    group: new (require('mongoose').Types.ObjectId)(),
    startDate: new Date('2024-01-01'),
    isActive: true,
    ...(displayId !== undefined && { displayId }),
    ...rest,
  });
}

async function makeGroup(overrides = {}) {
  const { displayId, ...rest } = overrides;
  return Group.create({
    name: 'Test Group',
    departments: ['Azərbaycan dili'],
    teachers: [new (require('mongoose').Types.ObjectId)()],
    nannies: [new (require('mongoose').Types.ObjectId)()],
    ageRange: '3-4',
    isActive: true,
    ...(displayId !== undefined && { displayId }),
    ...rest,
  });
}

async function makeNanny(overrides = {}) {
  const { displayId, ...rest } = overrides;
  return Nanny.create({
    firstName: 'Test',
    lastName: 'Test',
    fatherName: 'Test',
    phone: '+994501234567',
    birthDate: new Date('1990-01-01'),
    isActive: true,
    ...(displayId !== undefined && { displayId }),
    ...rest,
  });
}

async function makePackage(overrides = {}) {
  const { displayId, ...rest } = overrides;
  return Package.create({
    name: 'Test Package',
    duration: 'Bir aylıq tam gün',
    days: 30,
    price: 100,
    isActive: true,
    ...(displayId !== undefined && { displayId }),
    ...rest,
  });
}

async function makeTeacher(overrides = {}) {
  const { displayId, ...rest } = overrides;
  return Teacher.create({
    firstName: 'Test',
    lastName: 'Test',
    fatherName: 'Test',
    departments: ['Azərbaycan dili'],
    phone: '+994501234567',
    birthDate: new Date('1990-01-01'),
    isActive: true,
    ...(displayId !== undefined && { displayId }),
    ...rest,
  });
}

async function makeLesson(overrides = {}) {
  const { displayId, ...rest } = overrides;
  return Lesson.create({
    name: 'Test Lesson',
    groups: [new (require('mongoose').Types.ObjectId)()],
    days: ['Bazar ertəsi'],
    startTime: '10:00',
    duration: 45,
    teachers: [new (require('mongoose').Types.ObjectId)()],
    isActive: true,
    ...(displayId !== undefined && { displayId }),
    ...rest,
  });
}

async function makeEvent(overrides = {}) {
  const { displayId, ...rest } = overrides;
  return Event.create({
    name: 'Test Event',
    groups: [new (require('mongoose').Types.ObjectId)()],
    startDate: new Date('2024-06-01'),
    startTime: '10:00',
    endDate: new Date('2024-06-02'),
    isActive: true,
    ...(displayId !== undefined && { displayId }),
    ...rest,
  });
}

async function makeService(overrides = {}) {
  const { displayId, ...rest } = overrides;
  return Service.create({
    name: 'Test Service',
    days: ['Bazar ertəsi'],
    startTime: '10:00',
    isActive: true,
    ...(displayId !== undefined && { displayId }),
    ...rest,
  });
}

// ─── Children ──────────────────────────────────────────────────────────
describe('GET /api/children — sort by displayId desc', () => {
  test('sorts by displayId desc', async () => {
    await makeChild({ displayId: '001' });
    await makeChild({ displayId: '003' });
    await makeChild({ displayId: '002' });

    const res = await request(app).get('/api/children');
    expect(res.body.data.map(c => c.displayId)).toEqual(['003', '002', '001']);
  });

  test('records without displayId go to end', async () => {
    await makeChild({ displayId: '001' });
    await makeChild({});
    await makeChild({ displayId: '003' });
    await makeChild({});
    await makeChild({ displayId: '002' });

    const res = await request(app).get('/api/children');
    expect(res.body.data.slice(0, 3).map(c => c.displayId)).toEqual(['003', '002', '001']);
    expect(res.body.data.slice(3).every(c => c.displayId === null || c.displayId === undefined)).toBe(true);
  });
});

// ─── Groups ────────────────────────────────────────────────────────────
describe('GET /api/groups — sort by displayId desc', () => {
  test('sorts by displayId desc', async () => {
    await makeGroup({ displayId: '001' });
    await makeGroup({ displayId: '003' });
    await makeGroup({ displayId: '002' });

    const res = await request(app).get('/api/groups');
    expect(res.body.data.map(g => g.displayId)).toEqual(['003', '002', '001']);
  });

  test('records without displayId go to end', async () => {
    await makeGroup({ displayId: '001' });
    await makeGroup({});
    await makeGroup({ displayId: '003' });
    await makeGroup({});
    await makeGroup({ displayId: '002' });

    const res = await request(app).get('/api/groups');
    expect(res.body.data.slice(0, 3).map(g => g.displayId)).toEqual(['003', '002', '001']);
    expect(res.body.data.slice(3).every(g => g.displayId === null || g.displayId === undefined)).toBe(true);
  });
});

// ─── Nannies ───────────────────────────────────────────────────────────
describe('GET /api/nannies — sort by displayId desc', () => {
  test('sorts by displayId desc', async () => {
    await makeNanny({ displayId: '001' });
    await makeNanny({ displayId: '003' });
    await makeNanny({ displayId: '002' });

    const res = await request(app).get('/api/nannies');
    expect(res.body.data.map(n => n.displayId)).toEqual(['003', '002', '001']);
  });

  test('records without displayId go to end', async () => {
    await makeNanny({ displayId: '001' });
    await makeNanny({});
    await makeNanny({ displayId: '003' });
    await makeNanny({});
    await makeNanny({ displayId: '002' });

    const res = await request(app).get('/api/nannies');
    expect(res.body.data.slice(0, 3).map(n => n.displayId)).toEqual(['003', '002', '001']);
    expect(res.body.data.slice(3).every(n => n.displayId === null || n.displayId === undefined)).toBe(true);
  });
});

// ─── Packages ──────────────────────────────────────────────────────────
describe('GET /api/packages — sort by displayId desc', () => {
  test('sorts by displayId desc', async () => {
    await makePackage({ displayId: '001' });
    await makePackage({ displayId: '003' });
    await makePackage({ displayId: '002' });

    const res = await request(app).get('/api/packages');
    expect(res.body.data.map(p => p.displayId)).toEqual(['003', '002', '001']);
  });

  test('records without displayId go to end', async () => {
    await makePackage({ displayId: '001' });
    await makePackage({});
    await makePackage({ displayId: '003' });
    await makePackage({});
    await makePackage({ displayId: '002' });

    const res = await request(app).get('/api/packages');
    expect(res.body.data.slice(0, 3).map(p => p.displayId)).toEqual(['003', '002', '001']);
    expect(res.body.data.slice(3).every(p => p.displayId === null || p.displayId === undefined)).toBe(true);
  });
});

// ─── Teachers ──────────────────────────────────────────────────────────
describe('GET /api/teachers — sort by displayId desc', () => {
  test('sorts by displayId desc', async () => {
    await makeTeacher({ displayId: '001' });
    await makeTeacher({ displayId: '003' });
    await makeTeacher({ displayId: '002' });

    const res = await request(app).get('/api/teachers');
    expect(res.body.data.map(t => t.displayId)).toEqual(['003', '002', '001']);
  });

  test('records without displayId go to end', async () => {
    await makeTeacher({ displayId: '001' });
    await makeTeacher({});
    await makeTeacher({ displayId: '003' });
    await makeTeacher({});
    await makeTeacher({ displayId: '002' });

    const res = await request(app).get('/api/teachers');
    expect(res.body.data.slice(0, 3).map(t => t.displayId)).toEqual(['003', '002', '001']);
    expect(res.body.data.slice(3).every(t => t.displayId === null || t.displayId === undefined)).toBe(true);
  });
});

// ─── Activities (lessons.js) ───────────────────────────────────────────
describe('GET /api/activities — sort by displayId desc', () => {
  test('sorts by displayId desc', async () => {
    await makeLesson({ displayId: '001' });
    await makeLesson({ displayId: '003' });
    await makeLesson({ displayId: '002' });

    const res = await request(app).get('/api/activities');
    expect(res.body.data.map(l => l.displayId)).toEqual(['003', '002', '001']);
  });

  test('records without displayId go to end', async () => {
    await makeLesson({ displayId: '001' });
    await makeLesson({});
    await makeLesson({ displayId: '003' });
    await makeLesson({});
    await makeLesson({ displayId: '002' });

    const res = await request(app).get('/api/activities');
    expect(res.body.data.slice(0, 3).map(l => l.displayId)).toEqual(['003', '002', '001']);
    expect(res.body.data.slice(3).every(l => l.displayId === null || l.displayId === undefined)).toBe(true);
  });
});

// ─── Events ────────────────────────────────────────────────────────────
describe('GET /api/events — sort by displayId desc', () => {
  test('sorts by displayId desc', async () => {
    await makeEvent({ displayId: '001' });
    await makeEvent({ displayId: '003' });
    await makeEvent({ displayId: '002' });

    const res = await request(app).get('/api/events');
    expect(res.body.data.map(e => e.displayId)).toEqual(['003', '002', '001']);
  });

  test('records without displayId go to end', async () => {
    await makeEvent({ displayId: '001' });
    await makeEvent({});
    await makeEvent({ displayId: '003' });
    await makeEvent({});
    await makeEvent({ displayId: '002' });

    const res = await request(app).get('/api/events');
    expect(res.body.data.slice(0, 3).map(e => e.displayId)).toEqual(['003', '002', '001']);
    expect(res.body.data.slice(3).every(e => e.displayId === null || e.displayId === undefined)).toBe(true);
  });
});

// ─── Services ──────────────────────────────────────────────────────────
describe('GET /api/services — sort by displayId desc', () => {
  test('sorts by displayId desc', async () => {
    await makeService({ displayId: '001' });
    await makeService({ displayId: '003' });
    await makeService({ displayId: '002' });

    const res = await request(app).get('/api/services');
    expect(res.body.data.map(s => s.displayId)).toEqual(['003', '002', '001']);
  });

  test('records without displayId go to end', async () => {
    await makeService({ displayId: '001' });
    await makeService({});
    await makeService({ displayId: '003' });
    await makeService({});
    await makeService({ displayId: '002' });

    const res = await request(app).get('/api/services');
    expect(res.body.data.slice(0, 3).map(s => s.displayId)).toEqual(['003', '002', '001']);
    expect(res.body.data.slice(3).every(s => s.displayId === null || s.displayId === undefined)).toBe(true);
  });
});