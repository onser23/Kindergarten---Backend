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
app.use('/api/activities', lessonRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/nannies', nannyRoutes);

describe('Legacy DELETE endpoints removed (replaced by PATCH /:id/status)', () => {
  let entities = {};

  beforeAll(async () => {
    await setup.connect();

    const teacher = await Teacher.create({
      firstName: 'T', lastName: 'L', fatherName: 'F',
      departments: ['Rus dili'],
      phone: '+994501111111',
      birthDate: new Date('1990-01-01')
    });
    const nanny = await Nanny.create({
      firstName: 'N', lastName: 'L', fatherName: 'F',
      phone: '+994502222222',
      birthDate: new Date('1990-01-01')
    });

    entities.package = await Package.create({
      name: 'Test Package',
      services: [],
      lessons: [],
      duration: 'Bir aylıq tam gün',
      days: 30,
      price: 100
    });
    entities.service = await Service.create({
      name: 'Test Service',
      days: ['Bazar ertəsi'],
      startTime: '09:00'
    });
    entities.lesson = await Lesson.create({
      name: 'Test Lesson',
      groups: [],
      days: ['Bazar ertəsi'],
      startTime: '10:00',
      duration: 60,
      teachers: []
    });
    entities.food = await Food.create({
      dryFood: 'A', soup: 'B', drink: 'C', dessert: 'D', fruit: 'E',
      days: ['Bazar ertəsi'],
      time: '12:00'
    });
    entities.event = await Event.create({
      name: 'Test Event',
      groups: [],
      startDate: new Date(),
      startTime: '09:00',
      endDate: new Date()
    });
    entities.group = await Group.create({
      name: 'Test Group',
      departments: ['Rus dili'],
      teachers: [teacher._id],
      nannies: [nanny._id],
      ageRange: '3-4'
    });
    entities.teacher = teacher;
    entities.nanny = nanny;
  });

  afterAll(async () => {
    await setup.close();
  });

  test('DELETE /api/packages/:id returns 404', async () => {
    const res = await request(app).delete(`/api/packages/${entities.package._id}`);
    expect(res.status).toBe(404);
  });

  test('DELETE /api/services/:id returns 404', async () => {
    const res = await request(app).delete(`/api/services/${entities.service._id}`);
    expect(res.status).toBe(404);
  });

  test('DELETE /api/activities/:id returns 404', async () => {
    const res = await request(app).delete(`/api/activities/${entities.lesson._id}`);
    expect(res.status).toBe(404);
  });

  test('DELETE /api/foods/:id returns 404', async () => {
    const res = await request(app).delete(`/api/foods/${entities.food._id}`);
    expect(res.status).toBe(404);
  });

  test('DELETE /api/events/:id returns 404', async () => {
    const res = await request(app).delete(`/api/events/${entities.event._id}`);
    expect(res.status).toBe(404);
  });

  test('DELETE /api/groups/:id returns 404', async () => {
    const res = await request(app).delete(`/api/groups/${entities.group._id}`);
    expect(res.status).toBe(404);
  });

  test('DELETE /api/teachers/:id returns 404', async () => {
    const res = await request(app).delete(`/api/teachers/${entities.teacher._id}`);
    expect(res.status).toBe(404);
  });

  test('DELETE /api/nannies/:id returns 404', async () => {
    const res = await request(app).delete(`/api/nannies/${entities.nanny._id}`);
    expect(res.status).toBe(404);
  });
});