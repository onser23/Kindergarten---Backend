const mongoose = require('mongoose');
const statusConfig = require('../config/statusConfig');
const Package = require('../models/Package');
const Service = require('../models/Service');
const Lesson = require('../models/Lesson');
const Food = require('../models/Food');
const Event = require('../models/Event');
const Group = require('../models/Group');
const Teacher = require('../models/Teacher');
const Nanny = require('../models/Nanny');
const Child = require('../models/Child');
const setup = require('./setup');

describe('Usage Check Functions (per entity)', () => {
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
    await Food.deleteMany({});
    await Event.deleteMany({});
  });

  test('package.usageCheck — counts only active children with this package', async () => {
    const pkg = await Package.create({ name: 'Test', services: [], lessons: [], duration: 'Bir aylıq tam gün', days: 30, price: 100 });
    const group = await Group.create({ name: 'G', departments: ['Rus dili'], teachers: [(await Teacher.create({ firstName: 'T', lastName: 'L', fatherName: 'F', departments: ['Rus dili'], phone: '+994501111111', birthDate: new Date('1990-01-01') }))._id], nannies: [(await Nanny.create({ firstName: 'N', lastName: 'L', fatherName: 'F', phone: '+994502222222', birthDate: new Date('1990-01-01') }))._id], ageRange: '3-4' });
    await Child.create({ firstName: 'A', lastName: 'B', username: 'a1@test.com', password: 'pass123', phone1: '+994501111111', birthDate: new Date('2020-01-01'), package: pkg._id, group: group._id, startDate: new Date(), currentDebt: 0 });
    await Child.create({ firstName: 'C', lastName: 'D', username: 'a2@test.com', password: 'pass123', phone1: '+994501111112', birthDate: new Date('2020-01-01'), package: pkg._id, group: group._id, startDate: new Date(), currentDebt: 0, isActive: false });

    const result = await statusConfig.package.usageCheck(pkg._id);
    expect(result.count).toBe(1);
    expect(result.locations).toEqual(['1 aktiv uşaq']);
  });

  test('service.usageCheck — counts only active packages containing this service', async () => {
    const svc = await Service.create({ name: 'S', days: ['Bazar ertəsi'], startTime: '09:00' });
    await Package.create({ name: 'P1', services: [svc._id], lessons: [], duration: 'Bir aylıq tam gün', days: 30, price: 100, isActive: true });
    await Package.create({ name: 'P2', services: [svc._id], lessons: [], duration: 'Bir aylıq tam gün', days: 30, price: 100, isActive: false });

    const result = await statusConfig.service.usageCheck(svc._id);
    expect(result.count).toBe(1);
    expect(result.locations).toEqual(['1 aktiv paket']);
  });

  test('lesson.usageCheck — counts only active packages containing this lesson', async () => {
    const les = await Lesson.create({ name: 'L', groups: [], days: ['Bazar ertəsi'], startTime: '10:00', duration: 60, teachers: [] });
    await Package.create({ name: 'P1', services: [], lessons: [les._id], duration: 'Bir aylıq tam gün', days: 30, price: 100, isActive: true });

    const result = await statusConfig.lesson.usageCheck(les._id);
    expect(result.count).toBe(1);
    expect(result.locations).toEqual(['1 aktiv paket']);
  });

  test('group.usageCheck — counts only active children in this group', async () => {
    const teacher = await Teacher.create({ firstName: 'T', lastName: 'L', fatherName: 'F', departments: ['Rus dili'], phone: '+994501111111', birthDate: new Date('1990-01-01') });
    const nanny = await Nanny.create({ firstName: 'N', lastName: 'L', fatherName: 'F', phone: '+994502222222', birthDate: new Date('1990-01-01') });
    const grp = await Group.create({ name: 'G', departments: ['Rus dili'], teachers: [teacher._id], nannies: [nanny._id], ageRange: '3-4' });
    const pkg = await Package.create({ name: 'P', services: [], lessons: [], duration: 'Bir aylıq tam gün', days: 30, price: 100 });
    await Child.create({ firstName: 'A', lastName: 'B', username: 'g1@test.com', password: 'pass123', phone1: '+994501111113', birthDate: new Date('2020-01-01'), package: pkg._id, group: grp._id, startDate: new Date(), currentDebt: 0 });

    const result = await statusConfig.group.usageCheck(grp._id);
    expect(result.count).toBe(1);
    expect(result.locations).toEqual(['1 aktiv uşaq']);
  });

  test('teacher.usageCheck — counts both active lessons and groups referencing teacher', async () => {
    const teacher = await Teacher.create({ firstName: 'T', lastName: 'L', fatherName: 'F', departments: ['Rus dili'], phone: '+994501111111', birthDate: new Date('1990-01-01') });
    const nanny = await Nanny.create({ firstName: 'N', lastName: 'L', fatherName: 'F', phone: '+994502222222', birthDate: new Date('1990-01-01') });
    await Group.create({ name: 'G', departments: ['Rus dili'], teachers: [teacher._id], nannies: [nanny._id], ageRange: '3-4', isActive: true });
    await Lesson.create({ name: 'L', groups: [], days: ['Bazar ertəsi'], startTime: '10:00', duration: 60, teachers: [teacher._id], isActive: true });

    const result = await statusConfig.teacher.usageCheck(teacher._id);
    expect(result.count).toBe(2);
    expect(result.locations).toContain('1 aktiv dərs');
    expect(result.locations).toContain('1 aktiv qrup');
  });

  test('nanny.usageCheck — counts only active groups referencing nanny', async () => {
    const teacher = await Teacher.create({ firstName: 'T', lastName: 'L', fatherName: 'F', departments: ['Rus dili'], phone: '+994501111111', birthDate: new Date('1990-01-01') });
    const nan = await Nanny.create({ firstName: 'N', lastName: 'L', fatherName: 'F', phone: '+994502222222', birthDate: new Date('1990-01-01') });
    await Group.create({ name: 'G', departments: ['Rus dili'], teachers: [teacher._id], nannies: [nan._id], ageRange: '3-4', isActive: true });

    const result = await statusConfig.nanny.usageCheck(nan._id);
    expect(result.count).toBe(1);
    expect(result.locations).toEqual(['1 aktiv qrup']);
  });

  test('food.usageCheck — always returns 0 (no usage)', async () => {
    const food = await Food.create({ dryFood: 'A', soup: 'B', salad: '', drink: 'C', dessert: 'D', fruit: 'E', days: ['Bazar ertəsi'], time: '12:00' });
    const result = await statusConfig.food.usageCheck(food._id);
    expect(result.count).toBe(0);
    expect(result.locations).toEqual([]);
  });

  test('event.usageCheck — always returns 0 (no usage)', async () => {
    const evt = await Event.create({ name: 'E', groups: [], startDate: new Date(), startTime: '09:00', endDate: new Date() });
    const result = await statusConfig.event.usageCheck(evt._id);
    expect(result.count).toBe(0);
    expect(result.locations).toEqual([]);
  });

  test('package.usageCheck — returns 0 when no children assigned', async () => {
    const pkg = await Package.create({ name: 'Empty', services: [], lessons: [], duration: 'Bir aylıq tam gün', days: 30, price: 100 });
    const result = await statusConfig.package.usageCheck(pkg._id);
    expect(result.count).toBe(0);
  });
});