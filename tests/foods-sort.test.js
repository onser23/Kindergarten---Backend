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

const Food = require('../models/Food');
const foodRoutes = require('../routes/foods');

const app = express();
app.use(express.json());
app.use('/api/foods', foodRoutes);

describe('GET /api/foods — sort by displayId desc', () => {
  beforeAll(async () => {
    await setup.connect();
  });

  afterAll(async () => {
    await setup.close();
  });

  beforeEach(async () => {
    await Food.deleteMany({});
  });

  async function makeFood(overrides = {}) {
    const { displayId, ...rest } = overrides;
    const data = {
      dryFood: 'Default Dry',
      soup: 'Default Soup',
      salad: '',
      drink: 'Default Drink',
      dessert: 'Default Dessert',
      fruit: 'Default Fruit',
      time: '12:00',
      days: ['Bazar ertəsi'],
      isActive: true,
      ...rest,
    };
    if (displayId !== undefined) {
      data.displayId = displayId;
    }
    return Food.create(data);
  }

  test('sorts foods by displayId descending (highest first)', async () => {
    // Insert in REVERSE displayId order so createdAt desc != displayId desc
    await makeFood({ displayId: '003' });
    await makeFood({ displayId: '002' });
    await makeFood({ displayId: '001' });

    const res = await request(app).get('/api/foods');

    expect(res.status).toBe(200);
    expect(res.body.data.map(f => f.displayId)).toEqual(['003', '002', '001']);
  });

  test('uses lexicographic order for displayId (string sort, not numeric)', async () => {
    await makeFood({ displayId: '002' });
    await makeFood({ displayId: '100' });
    await makeFood({ displayId: '010' });

    const res = await request(app).get('/api/foods');

    // Lexicographic: "100" > "010" > "002"
    expect(res.body.data.map(f => f.displayId)).toEqual(['100', '010', '002']);
  });

  test('pagination preserves displayId sort across pages', async () => {
    // 25 foods with displayId 001-025, inserted in REVERSE order so
    // createdAt desc gives ascending displayId (wrong direction).
    for (let i = 25; i >= 1; i--) {
      const id = String(i).padStart(3, '0');
      await makeFood({ displayId: id });
    }

    const page1 = await request(app).get('/api/foods?page=1&limit=20');
    expect(page1.body.data.map(f => f.displayId)).toEqual(
      ['025', '024', '023', '022', '021', '020', '019', '018', '017', '016',
       '015', '014', '013', '012', '011', '010', '009', '008', '007', '006']
    );

    const page2 = await request(app).get('/api/foods?page=2&limit=20');
    expect(page2.body.data.map(f => f.displayId)).toEqual(
      ['005', '004', '003', '002', '001']
    );
  });

  test('records without displayId go to end in descending sort', async () => {
    // Insert scrambled: active records mixed with missing-displayId records,
    // so createdAt desc order does not match expected displayId desc.
    await makeFood({ displayId: '003' });
    await makeFood(); // no displayId (omit field to satisfy sparse+unique index)
    await makeFood({ displayId: '001' });
    await makeFood(); // no displayId
    await makeFood({ displayId: '002' });

    const res = await request(app).get('/api/foods');

    expect(res.body.data).toHaveLength(5);
    // First 3 have displayId, sorted desc: 003, 002, 001
    expect(res.body.data.slice(0, 3).map(f => f.displayId)).toEqual(['003', '002', '001']);
    // Last 2 have no displayId (undefined in JSON)
    expect(res.body.data.slice(3).every(f => f.displayId === null || f.displayId === undefined)).toBe(true);
  });

  test('sort + status filter combine correctly (active foods sorted by displayId desc)', async () => {
    // Insert active foods in non-displayId-desc order so createdAt desc != displayId desc
    await makeFood({ displayId: '003', isActive: true });
    await makeFood({ displayId: '005', isActive: true });
    await makeFood({ displayId: '001', isActive: true });
    await makeFood({ displayId: '002', isActive: false });
    await makeFood({ displayId: '004', isActive: false });

    const res = await request(app).get('/api/foods?status=active');

    expect(res.body.total).toBe(3);
    expect(res.body.data.map(f => f.displayId)).toEqual(['005', '003', '001']);
    expect(res.body.data.every(f => f.isActive === true)).toBe(true);
  });
});