const mongoose = require('mongoose');
const Refund = require('../models/Refund');
const setup = require('./setup');

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
