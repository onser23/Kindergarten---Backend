const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const setup = require('./setup');

describe('Payment Model', () => {
  beforeAll(async () => await setup.connect());
  afterAll(async () => await setup.close());
  beforeEach(async () => await setup.clear());

  const validChildId = new mongoose.Types.ObjectId();
  const validData = {
    child: validChildId,
    amount: 360,
    paidAmount: 360,
    paymentDate: new Date('2026-03-15'),
    serviceMonth: '2026-03',
    remainingBefore: 360,
    remainingAfter: 0
  };

  it('creates a payment with valid serviceMonth', async () => {
    const p = await Payment.create(validData);
    expect(p.serviceMonth).toBe('2026-03');
    expect(p.updatedReason).toBe('');
  });

  it('rejects payment without serviceMonth', async () => {
    const { serviceMonth, ...bad } = validData;
    await expect(Payment.create(bad)).rejects.toThrow(/Xidmət ayı/);
  });

  it('rejects invalid serviceMonth formats', async () => {
    await expect(Payment.create({ ...validData, serviceMonth: '2026-3' }))
      .rejects.toThrow();
    await expect(Payment.create({ ...validData, serviceMonth: 'mart 2026' }))
      .rejects.toThrow();
    await expect(Payment.create({ ...validData, serviceMonth: '2026-13' }))
      .rejects.toThrow();
  });

  it('accepts valid serviceMonth formats', async () => {
    for (const m of ['2026-01', '2026-06', '2026-12']) {
      const p = await Payment.create({ ...validData, serviceMonth: m });
      expect(p.serviceMonth).toBe(m);
      await Payment.deleteMany({});
    }
  });

  it('enforces updatedReason maxlength 500', async () => {
    const long = 'a'.repeat(501);
    await expect(Payment.create({ ...validData, updatedReason: long }))
      .rejects.toThrow(/Redaktə səbəbi/);
  });
});
