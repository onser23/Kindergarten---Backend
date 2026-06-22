const Counter = require('../models/Counter');

/**
 * Verilmiş model üçün növbəti display ID qaytarır.
 * Format: "001", "002", ... 999-dan sonra avtomatik "1000", "1001"...
 * Race-condition yoxdur (atomic findOneAndUpdate).
 */
async function getNextDisplayId(modelName) {
  const counter = await Counter.findOneAndUpdate(
    { _id: modelName },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return String(counter.seq).padStart(3, '0');
}

module.exports = { getNextDisplayId };
