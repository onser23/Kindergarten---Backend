const mongoose = require('mongoose');
const setup = require('./setup');

describe('Test Infrastructure', () => {
  let SmokeDoc;

  beforeAll(async () => {
    await setup.connect();
    SmokeDoc = mongoose.model('SmokeDoc', new mongoose.Schema({ x: Number }));
  });
  afterAll(async () => {
    await setup.close();
  });

  it('connects to in-memory MongoDB and supports CRUD', async () => {
    expect(mongoose.connection.readyState).toBe(1);
    await SmokeDoc.create({ x: 1 });
    const found = await SmokeDoc.findOne({ x: 1 });
    expect(found).not.toBeNull();
    expect(found.x).toBe(1);
  });

  it('clears collections between tests', async () => {
    await setup.clear();
    await SmokeDoc.create({ x: 1 });
    await SmokeDoc.create({ x: 2 });
    expect(await SmokeDoc.countDocuments()).toBe(2);
    await setup.clear();
    expect(await SmokeDoc.countDocuments()).toBe(0);
  });
});
