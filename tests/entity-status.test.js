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

const Package = require('../models/Package');
const Service = require('../models/Service');
const Lesson = require('../models/Lesson');
const Food = require('../models/Food');
const Event = require('../models/Event');
const Group = require('../models/Group');
const Teacher = require('../models/Teacher');
const Nanny = require('../models/Nanny');
const Child = require('../models/Child');

const packageRoutes = require('../routes/packages');
const serviceRoutes = require('../routes/services');
const lessonRoutes = require('../routes/lessons');
const foodRoutes = require('../routes/foods');
const eventRoutes = require('../routes/events');
const groupRoutes = require('../routes/groups');
const teacherRoutes = require('../routes/teachers');
const nannyRoutes = require('../routes/nannies');

const app = express();
app.use(express.json());
app.use('/api/packages', packageRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/nannies', nannyRoutes);

describe('PATCH /api/{entity}/:id/status — Universal Status Controller', () => {
  beforeAll(async () => {
    await setup.connect();
  });

  afterAll(async () => {
    await setup.close();
  });

  beforeEach(async () => {
    await Child.deleteMany({});
    await Package.deleteMany({});
    await Service.deleteMany({});
    await Lesson.deleteMany({});
    await Group.deleteMany({});
    await Teacher.deleteMany({});
    await Nanny.deleteMany({});
  });

  async function makeTeacher() {
    return Teacher.create({
      firstName: 'T', lastName: 'L', fatherName: 'F',
      departments: ['Rus dili'],
      phone: `+99450${Math.floor(1000000 + Math.random() * 9000000)}`,
      birthDate: new Date('1990-01-01')
    });
  }

  async function makeNanny() {
    return Nanny.create({
      firstName: 'N', lastName: 'L', fatherName: 'F',
      phone: `+99451${Math.floor(1000000 + Math.random() * 9000000)}`,
      birthDate: new Date('1990-01-01')
    });
  }

  async function makeGroup(teachers = [], nannies = []) {
    return Group.create({
      name: `G-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      departments: ['Rus dili'],
      teachers,
      nannies,
      ageRange: '3-4'
    });
  }

  describe('Package', () => {
    let pkg, group;

    beforeEach(async () => {
      group = await makeGroup([(await makeTeacher())._id], [(await makeNanny())._id]);
      pkg = await Package.create({
        name: 'P',
        services: [],
        lessons: [],
        duration: 'Bir aylıq tam gün',
        days: 30,
        price: 100
      });
    });

    test('Aktif paketi passiv et → 200, isActive=false', async () => {
      const res = await request(app).patch(`/api/packages/${pkg._id}/status`).send({ isActive: false });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(false);
      expect(res.body.message).toContain('passivləşdirildi');
    });

    test('Passiv paketi aktiv et → 200, isActive=true', async () => {
      await Package.findByIdAndUpdate(pkg._id, { isActive: false });
      const res = await request(app).patch(`/api/packages/${pkg._id}/status`).send({ isActive: true });
      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(true);
    });

    test('Passiv paketi passiv et (idempotent) → 200', async () => {
      await Package.findByIdAndUpdate(pkg._id, { isActive: false });
      const res = await request(app).patch(`/api/packages/${pkg._id}/status`).send({ isActive: false });
      expect(res.status).toBe(200);
    });

    test('Aktiv paketi aktiv et (idempotent) → 200', async () => {
      const res = await request(app).patch(`/api/packages/${pkg._id}/status`).send({ isActive: true });
      expect(res.status).toBe(200);
    });

    test('Uşağa təyin edilmiş paketi passiv et → 400 + usageCount', async () => {
      await Child.create({
        firstName: 'A', lastName: 'B',
        username: `u-${Date.now()}-${Math.random()}@test.com`,
        password: 'pass123', phone1: '+994501111111', birthDate: new Date('2020-01-01'),
        package: pkg._id, group: group._id, startDate: new Date(), currentDebt: 0
      });
      const res = await request(app).patch(`/api/packages/${pkg._id}/status`).send({ isActive: false });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.usageCount).toBe(1);
      expect(res.body.usageLocations).toEqual(['1 aktiv uşaq']);
      expect(res.body.message).toContain('1 aktiv uşaq');
    });

    test('Passiv uşağa təyin edilmiş paket → bloklanmır (passiv uşaqlar sayılmır)', async () => {
      await Child.create({
        firstName: 'A', lastName: 'B',
        username: `p-${Date.now()}-${Math.random()}@test.com`,
        password: 'pass123', phone1: '+994501111112', birthDate: new Date('2020-01-01'),
        package: pkg._id, group: group._id, startDate: new Date(), currentDebt: 0, isActive: false
      });
      const res = await request(app).patch(`/api/packages/${pkg._id}/status`).send({ isActive: false });
      expect(res.status).toBe(200);
    });

    test('Yanlış ObjectId → 400', async () => {
      const res = await request(app).patch('/api/packages/not-an-id/status').send({ isActive: false });
      expect(res.status).toBe(400);
    });

    test('Mövcud olmayan paket → 404', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).patch(`/api/packages/${fakeId}/status`).send({ isActive: false });
      expect(res.status).toBe(404);
    });

    test('isActive boolean deyil → 400', async () => {
      const res = await request(app).patch(`/api/packages/${pkg._id}/status`).send({ isActive: 'yes' });
      expect(res.status).toBe(400);
    });
  });

  describe('Service', () => {
    test('Aktiv xidməti passiv et → 200', async () => {
      const emptySvc = await Service.create({ name: 'EmptySvc', days: ['Bazar ertəsi'], startTime: '09:00' });
      const res = await request(app).patch(`/api/services/${emptySvc._id}/status`).send({ isActive: false });
      expect(res.status).toBe(200);
    });

    test('Aktiv paketə daxil olan xidməti passiv et → 400 + usageCount', async () => {
      const svc = await Service.create({ name: 'S', days: ['Bazar ertəsi'], startTime: '09:00' });
      await Package.create({
        name: 'P', services: [svc._id], lessons: [],
        duration: 'Bir aylıq tam gün', days: 30, price: 100
      });
      const res = await request(app).patch(`/api/services/${svc._id}/status`).send({ isActive: false });
      expect(res.status).toBe(400);
      expect(res.body.usageCount).toBe(1);
      expect(res.body.usageLocations).toEqual(['1 aktiv paket']);
    });
  });

  describe('Lesson', () => {
    let les, pkg;

    beforeEach(async () => {
      les = await Lesson.create({ name: 'L', groups: [], days: ['Bazar ertəsi'], startTime: '10:00', duration: 60, teachers: [] });
      pkg = await Package.create({
        name: 'P', services: [], lessons: [les._id],
        duration: 'Bir aylıq tam gün', days: 30, price: 100
      });
    });

    test('Aktiv paketə daxil olan dərsi passiv et → 400 + usageCount', async () => {
      const res = await request(app).patch(`/api/lessons/${les._id}/status`).send({ isActive: false });
      expect(res.status).toBe(400);
      expect(res.body.usageCount).toBe(1);
    });

    test('Boş dərsi passiv et → 200', async () => {
      const emptyLes = await Lesson.create({ name: 'Empty', groups: [], days: ['Bazar ertəsi'], startTime: '11:00', duration: 60, teachers: [] });
      const res = await request(app).patch(`/api/lessons/${emptyLes._id}/status`).send({ isActive: false });
      expect(res.status).toBe(200);
    });
  });

  describe('Group', () => {
    let grp, pkg;

    beforeEach(async () => {
      pkg = await Package.create({
        name: 'P', services: [], lessons: [],
        duration: 'Bir aylıq tam gün', days: 30, price: 100
      });
      grp = await makeGroup([(await makeTeacher())._id], [(await makeNanny())._id]);
    });

    test('Uşağa təyin edilmiş qrupu passiv et → 400', async () => {
      await Child.create({
        firstName: 'A', lastName: 'B',
        username: `g-${Date.now()}-${Math.random()}@test.com`,
        password: 'pass123', phone1: '+994501111113', birthDate: new Date('2020-01-01'),
        package: pkg._id, group: grp._id, startDate: new Date(), currentDebt: 0
      });
      const res = await request(app).patch(`/api/groups/${grp._id}/status`).send({ isActive: false });
      expect(res.status).toBe(400);
      expect(res.body.usageCount).toBe(1);
    });

    test('Boş qrupu passiv et → 200', async () => {
      const emptyGrp = await makeGroup([(await makeTeacher())._id], [(await makeNanny())._id]);
      emptyGrp.name = 'Empty';
      await emptyGrp.save();
      const res = await request(app).patch(`/api/groups/${emptyGrp._id}/status`).send({ isActive: false });
      expect(res.status).toBe(200);
    });
  });

  describe('Teacher', () => {
    let teacher;

    beforeEach(async () => {
      teacher = await makeTeacher();
    });

    test('Dərsə təyin edilmiş müəllimi passiv et → 400', async () => {
      await Lesson.create({ name: 'L', groups: [], days: ['Bazar ertəsi'], startTime: '10:00', duration: 60, teachers: [teacher._id] });
      const res = await request(app).patch(`/api/teachers/${teacher._id}/status`).send({ isActive: false });
      expect(res.status).toBe(400);
      expect(res.body.usageLocations).toContain('1 aktiv dərs');
    });

    test('Qrupa təyin edilmiş müəllimi passiv et → 400', async () => {
      await makeGroup([teacher._id], [(await makeNanny())._id]);
      const res = await request(app).patch(`/api/teachers/${teacher._id}/status`).send({ isActive: false });
      expect(res.status).toBe(400);
      expect(res.body.usageLocations).toContain('1 aktiv qrup');
    });

    test('Həm dərsə, həm qrupa təyin edilmiş müəllim → 2 istifadə', async () => {
      await makeGroup([teacher._id], [(await makeNanny())._id]);
      await Lesson.create({ name: 'L', groups: [], days: ['Bazar ertəsi'], startTime: '10:00', duration: 60, teachers: [teacher._id] });
      const res = await request(app).patch(`/api/teachers/${teacher._id}/status`).send({ isActive: false });
      expect(res.status).toBe(400);
      expect(res.body.usageCount).toBe(2);
    });
  });

  describe('Nanny', () => {
    let nanny;

    beforeEach(async () => {
      nanny = await makeNanny();
    });

    test('Qrupa təyin edilmiş baxıcını passiv et → 400', async () => {
      await makeGroup([(await makeTeacher())._id], [nanny._id]);
      const res = await request(app).patch(`/api/nannies/${nanny._id}/status`).send({ isActive: false });
      expect(res.status).toBe(400);
      expect(res.body.usageCount).toBe(1);
    });

    test('Boş baxıcını passiv et → 200', async () => {
      const res = await request(app).patch(`/api/nannies/${nanny._id}/status`).send({ isActive: false });
      expect(res.status).toBe(200);
    });
  });

  describe('Food', () => {
    test('Aktiv qidanı passiv et → 200 (usage yox)', async () => {
      const food = await Food.create({ dryFood: 'A', soup: 'B', salad: '', drink: 'C', dessert: 'D', fruit: 'E', days: ['Bazar ertəsi'], time: '12:00' });
      const res = await request(app).patch(`/api/foods/${food._id}/status`).send({ isActive: false });
      expect(res.status).toBe(200);
    });
  });

  describe('Event', () => {
    test('Aktiv tədbiri passiv et → 200 (usage yox)', async () => {
      const evt = await Event.create({ name: 'E', groups: [], startDate: new Date(), startTime: '09:00', endDate: new Date() });
      const res = await request(app).patch(`/api/events/${evt._id}/status`).send({ isActive: false });
      expect(res.status).toBe(200);
    });
  });
});