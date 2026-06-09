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
  note: {
    type: String,
    trim: true,
    maxlength: [500, 'Qeyd 500 simvoldan çox ola bilməz'],
    default: ''
  },
  remainingBefore: {
    type: Number,
    required: true
  },
  remainingAfter: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

paymentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

paymentSchema.index({ child: 1, paymentDate: -1 });
paymentSchema.index({ paymentDate: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
