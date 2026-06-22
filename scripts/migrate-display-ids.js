/**
 * Mövcud datalar üçün displayId generasiya edir.
 * - Hər model üçün createdAt ASC sırası ilə "001", "002", ... təyin edir
 * - Counter collection-ını da sinxron edir (max seq saxlanılır)
 * - Idempotentdir: əgər data artıq displayId-ə malikdirsa, skip edir
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MODELS = [
  { name: 'Child',     model: require('../models/Child') },
  { name: 'Nanny',     model: require('../models/Nanny') },
  { name: 'Teacher',   model: require('../models/Teacher') },
  { name: 'Group',     model: require('../models/Group') },
  { name: 'Event',     model: require('../models/Event') },
  { name: 'Food',      model: require('../models/Food') },
  { name: 'Lesson',    model: require('../models/Lesson') },
  { name: 'Service',   model: require('../models/Service') },
  { name: 'Package',   model: require('../models/Package') },
  { name: 'Payment',   model: require('../models/Payment') },
  { name: 'Refund',    model: require('../models/Refund') },
];

const Counter = require('../models/Counter');

async function migrateModel({ name, model }) {
  console.log(`\n=== ${name} ===`);

  // C1 fix: Find max existing displayId from DB (crash-recovery safety)
  const maxDocs = await model.aggregate([
    { $match: { displayId: { $type: 'string' } } },
    { $project: { num: { $toInt: '$displayId' } } },
    { $sort: { num: -1 } },
    { $limit: 1 },
  ]);
  const dbMax = maxDocs[0]?.num ?? 0;

  // Also check Counter (may be higher from concurrent traffic)
  const counterDoc = await Counter.findById(name);
  const counterMax = counterDoc?.seq ?? 0;

  // Start from max of all sources so re-runs never collide
  let seq = Math.max(dbMax, counterMax);

  const docs = await model
    .find({ displayId: { $exists: false } })
    .sort({ createdAt: 1 })
    .lean();

  if (docs.length === 0) {
    console.log(`  Skip: bütün dataların artıq displayId-si var (seq: ${seq}).`);
    return;
  }

  console.log(`  ${docs.length} data tapıldı, ID generasiya olunur (seq başlanğıcı: ${seq + 1})...`);

  for (const doc of docs) {
    seq += 1;
    const displayId = String(seq).padStart(3, '0');
    await model.updateOne({ _id: doc._id }, { $set: { displayId } });
    console.log(`    ${doc._id} → ${displayId}`);
  }

  // C2 fix: Use $max so Counter never decreases (concurrent-write safety)
  await Counter.findOneAndUpdate(
    { _id: name },
    { $max: { seq } },
    { upsert: true }
  );
  console.log(`  Counter sinxronlaşdırıldı: ${name} → seq: ${seq}`);
}

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB-ə qoşuldu');

    for (const m of MODELS) {
      await migrateModel(m);
    }

    console.log('\n✓ Migration tamamlandı');
    process.exit(0);
  } catch (err) {
    console.error('Migration xətası:', err);
    process.exit(1);
  }
})();
