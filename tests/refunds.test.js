const mongoose = require('mongoose');
const Refund = require('../models/Refund');
const setup = require('./setup');

jest.mock('../middleware/auth', () => {
  const mockMongoose = require('mongoose');
  return (req, res, next) => {
    req.user = { id: new mockMongoose.Types.ObjectId(), role: 'admin' };
    next();
  };
});

describe('Refund Model — Validations', () => {
  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => await setup.clear());

  it('creates refund with all required fields', async () => {
    const refund = await Refund.create({
      child: new mongoose.Types.ObjectId(),
      amount: 100,
      reason: 'Test səbəb',
      refundDate: new Date('2026-06-20'),
      createdBy: new mongoose.Types.ObjectId()
    });
    expect(refund._id).toBeDefined();
    expect(refund.amount).toBe(100);
    expect(refund.reason).toBe('Test səbəb');
    expect(refund.isActive).toBe(true);
    expect(refund.notes).toBe('');
  });

  it('rejects refund without child', async () => {
    await expect(Refund.create({
      amount: 100,
      reason: 'Test',
      refundDate: new Date(),
      createdBy: new mongoose.Types.ObjectId()
    })).rejects.toThrow(/Uşaq tələb olunur/);
  });

  it('rejects refund with amount = 0', async () => {
    await expect(Refund.create({
      child: new mongoose.Types.ObjectId(),
      amount: 0,
      reason: 'Test',
      refundDate: new Date(),
      createdBy: new mongoose.Types.ObjectId()
    })).rejects.toThrow(/ən az 0.01/);
  });

  it('rejects refund with reason shorter than 3 chars', async () => {
    await expect(Refund.create({
      child: new mongoose.Types.ObjectId(),
      amount: 100,
      reason: 'ab',
      refundDate: new Date(),
      createdBy: new mongoose.Types.ObjectId()
    })).rejects.toThrow(/ən azı 3 simvol/);
  });

  it('accepts refund without originalPayment (optional)', async () => {
    const refund = await Refund.create({
      child: new mongoose.Types.ObjectId(),
      amount: 100,
      reason: 'Test səbəb',
      refundDate: new Date(),
      createdBy: new mongoose.Types.ObjectId()
    });
    expect(refund.originalPayment).toBeUndefined();
  });
});

const request = require('supertest');
const express = require('express');
const Child = require('../models/Child');
const Package = require('../models/Package');
const Group = require('../models/Group');
const refundRoutes = require('../routes/refunds');

const app = express();
app.use(express.json());
app.use('/api/refunds', require('../middleware/auth'), refundRoutes);

describe('POST /api/refunds', () => {
  let pkg, grp, passiveChild;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Aylıq', price: 500, days: 30, duration: 'Bir aylıq tam gün', isActive: true });
    grp = await Group.create({ name: 'Q1', ageRange: '1-2', teachers: [], nannies: [], departments: [], isActive: true });
    passiveChild = await Child.create({
      firstName: 'Əli', lastName: 'Əliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `ali-passive-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'),
      isActive: false,
      passiveDate: new Date('2026-06-10'),
      passiveReason: 'Ailə köçdü'
    });
  });

  it('creates refund for passive child', async () => {
    const res = await request(app)
      .post('/api/refunds')
      .send({
        child: passiveChild._id.toString(),
        amount: 300,
        reason: '10 gün istifadə edib, 20 gün qaytarılır',
        refundDate: '2026-06-15T10:00:00.000Z',
        notes: 'Valideyn təsdiqlədi'
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toBeTruthy();
    expect(res.body.data.amount).toBe(300);
    expect(res.body.data.child.firstName).toBe('Əli');
  });

  it('rejects refund for active child with 403', async () => {
    const activeChild = await Child.create({
      firstName: 'Aktiv', lastName: 'Uşaq', birthDate: new Date('2020-01-01'),
      phone1: '+994501234568',
      username: `aktiv-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'),
      isActive: true
    });
    const res = await request(app)
      .post('/api/refunds')
      .send({
        child: activeChild._id.toString(),
        amount: 100,
        reason: 'Test',
        refundDate: '2026-06-15T10:00:00.000Z'
      });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/passiv/);
  });

  it('returns 404 for non-existent child', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post('/api/refunds')
      .send({
        child: fakeId.toString(),
        amount: 100,
        reason: 'Test',
        refundDate: '2026-06-15T10:00:00.000Z'
      });
    expect(res.status).toBe(404);
  });

  it('rejects refund with amount = 0', async () => {
    const res = await request(app)
      .post('/api/refunds')
      .send({
        child: passiveChild._id.toString(),
        amount: 0,
        reason: 'Test səbəb',
        refundDate: '2026-06-15T10:00:00.000Z'
      });
    expect(res.status).toBe(400);
  });

  it('rejects refund with negative amount', async () => {
    const res = await request(app)
      .post('/api/refunds')
      .send({
        child: passiveChild._id.toString(),
        amount: -50,
        reason: 'Test səbəb',
        refundDate: '2026-06-15T10:00:00.000Z'
      });
    expect(res.status).toBe(400);
  });

  it('rejects refund with reason shorter than 3 chars', async () => {
    const res = await request(app)
      .post('/api/refunds')
      .send({
        child: passiveChild._id.toString(),
        amount: 100,
        reason: 'ab',
        refundDate: '2026-06-15T10:00:00.000Z'
      });
    expect(res.status).toBe(400);
  });

  it('creates refund without originalPayment (optional)', async () => {
    const res = await request(app)
      .post('/api/refunds')
      .send({
        child: passiveChild._id.toString(),
        amount: 200,
        reason: 'Refund without original payment ref',
        refundDate: '2026-06-15T10:00:00.000Z'
      });
    expect(res.status).toBe(201);
    expect(res.body.data.originalPayment).toBeFalsy();
  });

  it('rejects refund with originalPayment from different child', async () => {
    const Payment = require('../models/Payment');
    const otherChild = await Child.create({
      firstName: 'O', lastName: 'Other', birthDate: new Date('2020-01-01'),
      phone1: '+994501234569',
      username: `other-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'),
      isActive: false
    });
    const otherPayment = await Payment.create({
      child: otherChild._id, amount: 100, paidAmount: 100,
      paymentDate: new Date('2026-06-01'), serviceMonth: '2026-06',
      remainingBefore: 100, remainingAfter: 0
    });
    const res = await request(app)
      .post('/api/refunds')
      .send({
        child: passiveChild._id.toString(),
        originalPayment: otherPayment._id.toString(),
        amount: 100,
        reason: 'Test',
        refundDate: '2026-06-15T10:00:00.000Z'
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/bu uşağa aid deyil/);
  });
});

describe('GET /api/refunds', () => {
  let pkg, grp, child1, child2, refund1, refund2;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Aylıq', price: 500, days: 30, duration: 'Bir aylıq tam gün', isActive: true });
    grp = await Group.create({ name: 'Q1', ageRange: '1-2', teachers: [], nannies: [], departments: [], isActive: true });
    child1 = await Child.create({
      firstName: 'Əli', lastName: 'Əliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `ali-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'),
      isActive: false
    });
    child2 = await Child.create({
      firstName: 'Vəli', lastName: 'Veliyev', birthDate: new Date('2020-02-01'),
      phone1: '+994501234568',
      username: `veli-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'),
      isActive: false
    });
    refund1 = await Refund.create({
      child: child1._id, amount: 300, reason: 'Əli refund',
      refundDate: new Date('2026-06-10'),
      createdBy: new mongoose.Types.ObjectId()
    });
    refund2 = await Refund.create({
      child: child2._id, amount: 500, reason: 'Vəli refund',
      refundDate: new Date('2026-06-15'),
      createdBy: new mongoose.Types.ObjectId()
    });
  });

  it('lists refunds with filter by childId', async () => {
    const res = await request(app).get(`/api/refunds?childId=${child1._id.toString()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].amount).toBe(300);
    expect(res.body.total).toBe(1);
  });

  it('lists refunds with date range filter', async () => {
    const res = await request(app).get('/api/refunds?dateFrom=2026-06-12&dateTo=2026-06-20');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].amount).toBe(500);
  });
});

describe('GET /api/refunds/:id and auxiliary endpoints', () => {
  let pkg, grp, child, refund;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Aylıq', price: 500, days: 30, duration: 'Bir aylıq tam gün', isActive: true });
    grp = await Group.create({ name: 'Q1', ageRange: '1-2', teachers: [], nannies: [], departments: [], isActive: true });
    child = await Child.create({
      firstName: 'Əli', lastName: 'Əliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `ali-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'),
      isActive: false
    });
    refund = await Refund.create({
      child: child._id, amount: 300, reason: 'Test refund',
      refundDate: new Date('2026-06-10'),
      createdBy: new mongoose.Types.ObjectId()
    });
  });

  it('GET /:id returns single refund with populated fields', async () => {
    const res = await request(app).get(`/api/refunds/${refund._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(300);
    expect(res.body.data.child.firstName).toBe('Əli');
  });

  it('GET /:id returns 404 for non-existent refund', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/refunds/${fakeId}`);
    expect(res.status).toBe(404);
  });

  it('GET /by-child/:childId returns child refund history with total', async () => {
    const res = await request(app).get(`/api/refunds/by-child/${child._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.totalAmount).toBe(300);
    expect(res.body.count).toBe(1);
  });

  it('GET /form-data returns only passive children', async () => {
    // Aktiv uşaq əlavə et (form-data-da görsənməməlidir)
    await Child.create({
      firstName: 'Aktiv', lastName: 'Uşaq', birthDate: new Date('2020-01-01'),
      phone1: '+994501234599',
      username: `aktiv-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'),
      isActive: true
    });
    const res = await request(app).get('/api/refunds/form-data');
    expect(res.status).toBe(200);
    expect(res.body.data.children.length).toBe(1);
    expect(res.body.data.children[0].firstName).toBe('Əli');
    expect(res.body.data.paymentsByChild[child._id.toString()]).toBeDefined();
  });
});

describe('PUT /api/refunds/:id', () => {
  let pkg, grp, child, refund;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Aylıq', price: 500, days: 30, duration: 'Bir aylıq tam gün', isActive: true });
    grp = await Group.create({ name: 'Q1', ageRange: '1-2', teachers: [], nannies: [], departments: [], isActive: true });
    child = await Child.create({
      firstName: 'Əli', lastName: 'Əliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `ali-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'),
      isActive: false
    });
    refund = await Refund.create({
      child: child._id, amount: 300, reason: 'Original reason',
      refundDate: new Date('2026-06-10'),
      createdBy: new mongoose.Types.ObjectId()
    });
  });

  it('updates refund amount and reason', async () => {
    const res = await request(app)
      .put(`/api/refunds/${refund._id}`)
      .send({ amount: 350, reason: 'Yenilənmiş səbəb' });
    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(350);
    expect(res.body.data.reason).toBe('Yenilənmiş səbəb');
  });

  it('does NOT change child field (immutable)', async () => {
    const res = await request(app)
      .put(`/api/refunds/${refund._id}`)
      .send({ amount: 400 });
    expect(res.status).toBe(200);
    expect(res.body.data.child._id.toString()).toBe(child._id.toString());
  });

  it('returns 404 for soft-deleted refund', async () => {
    refund.isActive = false;
    await refund.save();
    const res = await request(app)
      .put(`/api/refunds/${refund._id}`)
      .send({ amount: 400 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/refunds/:id', () => {
  let pkg, grp, child, refund;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Aylıq', price: 500, days: 30, duration: 'Bir aylıq tam gün', isActive: true });
    grp = await Group.create({ name: 'Q1', ageRange: '1-2', teachers: [], nannies: [], departments: [], isActive: true });
    child = await Child.create({
      firstName: 'Əli', lastName: 'Əliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `ali-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'),
      isActive: false
    });
    refund = await Refund.create({
      child: child._id, amount: 300, reason: 'Test',
      refundDate: new Date('2026-06-10'),
      createdBy: new mongoose.Types.ObjectId()
    });
  });

  it('soft deletes refund', async () => {
    const res = await request(app).delete(`/api/refunds/${refund._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('soft-deleted refund does not appear in GET list', async () => {
    await request(app).delete(`/api/refunds/${refund._id}`);
    const res = await request(app).get('/api/refunds');
    expect(res.body.data.length).toBe(0);
  });
});

describe('GET /api/refunds/export/csv', () => {
  let pkg, grp, child, refund;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Aylıq', price: 500, days: 30, duration: 'Bir aylıq tam gün', isActive: true });
    grp = await Group.create({ name: 'Q1', ageRange: '1-2', teachers: [], nannies: [], departments: [], isActive: true });
    child = await Child.create({
      firstName: 'Əli', lastName: 'Əliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `ali-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'),
      isActive: false
    });
    refund = await Refund.create({
      child: child._id, amount: 300, reason: 'Test səbəb, dırnaq "içində"',
      refundDate: new Date('2026-06-10'),
      createdBy: new mongoose.Types.ObjectId()
    });
  });

  it('exports refunds to CSV with UTF-8 BOM', async () => {
    const res = await request(app).get('/api/refunds/export/csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text.charCodeAt(0)).toBe(0xFEFF);
    expect(res.text).toMatch(/Əli/);
    expect(res.text).toMatch(/Qaytarılan/);
  });

  it('respects dateFrom filter in CSV export', async () => {
    const res = await request(app).get('/api/refunds/export/csv?dateFrom=2026-06-12');
    expect(res.status).toBe(200);
    expect(res.text.split('\n').filter(l => l.trim()).length).toBe(1);
  });
});

describe('CRITICAL: refund does NOT change child.currentDebt', () => {
  let pkg, grp;

  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => {
    await setup.clear();
    pkg = await Package.create({ name: 'Aylıq', price: 500, days: 30, duration: 'Bir aylıq tam gün', isActive: true });
    grp = await Group.create({ name: 'Q1', ageRange: '1-2', teachers: [], nannies: [], departments: [], isActive: true });
  });

  it('currentDebt stays 0 when refund created for child with debt=0', async () => {
    const child = await Child.create({
      firstName: 'Əli', lastName: 'Əliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234567',
      username: `ali-zero-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'),
      isActive: false,
      currentDebt: 0
    });

    const res = await request(app)
      .post('/api/refunds')
      .send({
        child: child._id.toString(),
        amount: 300,
        reason: 'Refund test',
        refundDate: '2026-06-15T10:00:00.000Z'
      });
    expect(res.status).toBe(201);

    // KRİTİK: currentDebt hələ də 0 olmalıdır
    const updatedChild = await Child.findById(child._id);
    expect(updatedChild.currentDebt).toBe(0);
  });

  it('currentDebt stays 250 when refund created for child with debt=250', async () => {
    const child = await Child.create({
      firstName: 'Vəli', lastName: 'Veliyev', birthDate: new Date('2020-01-01'),
      phone1: '+994501234568',
      username: `veli-debt-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'),
      isActive: false,
      currentDebt: 250
    });

    const res = await request(app)
      .post('/api/refunds')
      .send({
        child: child._id.toString(),
        amount: 500,
        reason: 'Böyük refund test',
        refundDate: '2026-06-15T10:00:00.000Z'
      });
    expect(res.status).toBe(201);

    // KRİTİK: currentDebt 250 qalmalıdır (500 refund etsək belə)
    const updatedChild = await Child.findById(child._id);
    expect(updatedChild.currentDebt).toBe(250);
  });

  it('currentDebt stays unchanged after multiple refunds for same child', async () => {
    const child = await Child.create({
      firstName: 'Test', lastName: 'Child', birthDate: new Date('2020-01-01'),
      phone1: '+994501234570',
      username: `test-multi-${Date.now()}-${Math.random()}@test.com`,
      password: 'pass123',
      package: pkg._id, group: grp._id, startDate: new Date('2026-06-01'),
      isActive: false,
      currentDebt: 100
    });

    await request(app).post('/api/refunds').send({
      child: child._id.toString(), amount: 100, reason: 'First refund',
      refundDate: '2026-06-15T10:00:00.000Z'
    });
    await request(app).post('/api/refunds').send({
      child: child._id.toString(), amount: 200, reason: 'Second refund',
      refundDate: '2026-06-16T10:00:00.000Z'
    });

    // KRİTİK: 2 refund-dan sonra da currentDebt hələ 100 qalmalıdır
    const updatedChild = await Child.findById(child._id);
    expect(updatedChild.currentDebt).toBe(100);
  });
});
