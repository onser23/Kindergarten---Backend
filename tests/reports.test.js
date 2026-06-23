const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Package = require('../models/Package');
const Child = require('../models/Child');
const Group = require('../models/Group');
const reportsRouter = require('../routes/reports');

jest.mock('../middleware/auth', () => {
  const mockMongoose = require('mongoose');
  return (req, res, next) => {
    req.user = { id: new mockMongoose.Types.ObjectId(), role: 'admin' };
    next();
  };
});

const app = express();
app.use(express.json());
app.use('/api/reports', reportsRouter);
const setup = require('./setup');

describe('GET /api/reports/revenue', () => {
  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => await setup.clear());

  describe('monthly mode', () => {
    it('returns empty data and totalRevenue=0 for empty DB', async () => {
      const res = await request(app).get('/api/reports/revenue?mode=monthly');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.totalRevenue).toBe(0);
      expect(res.body.totalRows).toBe(0);
      expect(res.body.mode).toBe('monthly');
    });
  });
});