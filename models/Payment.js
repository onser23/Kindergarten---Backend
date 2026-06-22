const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  child: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Child',
    required: [true, 'Uşaq tələb olunur']
  },
  amount: {
    type: Number,
    required: [true, 'Məbləğ tələb olunur'],
    min: [0, 'Məbləğ 0-dan kiçik ola bilməz']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Endirim 0-dan kiçik ola bilməz']
  },
  extraPrice: {
    type: Number,
    default: 0,
    min: [0, 'Əlavə qiymət 0-dan kiçik ola bilməz']
  },
  paidAmount: {
    type: Number,
    required: [true, 'Ödənilən məbləğ tələb olunur'],
    min: [0, 'Ödənilən məbləğ 0-dan kiçik ola bilməz']
  },
  paymentDate: {
    type: Date,
    required: [true, 'Ödəniş tarixi tələb olunur']
  },
  serviceMonth: {
    type: String,
    required: [true, 'Xidmət ayı tələb olunur'],
    match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Düzgün format: YYYY-MM (məs: 2026-03)']
  },
  packageSnapshot: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },
    name: { type: String },
    price: { type: Number }
  },
  note: {
    type: String,
    trim: true,
    maxlength: [500, 'Qeyd 500 simvoldan çox ola bilməz'],
    default: ''
  },
  remainingBefore: { type: Number, required: true },
  remainingAfter: { type: Number, required: true },
  updatedReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Redaktə səbəbi 500 simvoldan çox ola bilməz'],
    default: ''
  },
  displayId: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
    trim: true
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

paymentSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

paymentSchema.index({ child: 1, serviceMonth: 1 });
paymentSchema.index({ child: 1, paymentDate: -1 });
paymentSchema.index({ serviceMonth: 1 });
paymentSchema.index({ paymentDate: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
