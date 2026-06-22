const Counter = require('../models/Counter');

/**
 * Verilmiş model üçün növbəti display ID qaytarır.
 * Format: "001", "002", ... 999-dan sonra avtomatik "1000", "1001"...
 * Race-condition yoxdur (atomic findOneAndUpdate).
 *
 * @param {string} modelName - Model adı (Counter doc _id ilə eyni)
 * @param {ClientSession|null} [session=null] - Optional Mongoose session (transaction dəstəyi)
 * @returns {Promise<string>} - "001" formatında ID
 */
async function getNextDisplayId(modelName, session = null) {
  const counter = await Counter.findOneAndUpdate(
    { _id: modelName },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true, session }
  );
  return String(counter.seq).padStart(3, '0');
}

module.exports = { getNextDisplayId };
