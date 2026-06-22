const { getNextDisplayId } = require('../utils/idGenerator');
const Counter = require('../models/Counter');
const setup = require('./setup');

beforeAll(async () => {
  await setup.connect();
});

afterAll(async () => {
  await setup.close();
});

beforeEach(async () => {
  await Counter.deleteMany({ _id: { $in: ['TestModel1', 'TestModel2', 'TestModel3', 'TestModel4'] } });
});

describe('getNextDisplayId', () => {
  it('ilk ID "001" qaytarır', async () => {
    const id = await getNextDisplayId('TestModel1');
    expect(id).toBe('001');
  });

  it('ardıcıl çağırışlarda artır', async () => {
    const a = await getNextDisplayId('TestModel2');
    const b = await getNextDisplayId('TestModel2');
    const c = await getNextDisplayId('TestModel2');
    expect([a, b, c]).toEqual(['001', '002', '003']);
  });

  it('paralel çağırışlarda duplicate olmur', async () => {
    const promises = Array.from({ length: 10 }, () =>
      getNextDisplayId('TestModel3')
    );
    const results = await Promise.all(promises);
    expect(new Set(results).size).toBe(10);
  });

  it('999-dan sonra "1000" qaytarır', async () => {
    await Counter.findOneAndUpdate(
      { _id: 'TestModel4' },
      { seq: 998 },
      { upsert: true }
    );
    const a = await getNextDisplayId('TestModel4');
    const b = await getNextDisplayId('TestModel4');
    expect([a, b]).toEqual(['999', '1000']);
  });
});
