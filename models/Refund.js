const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
  child: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Child',
    required: [true, 'Uşaq tələb olunur']
  },
  originalPayment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  amount: {
    type: Number,
    required: [true, 'Məbləğ tələb olunur'],
    min: [0.01, 'Məbləğ ən az 0.01 olmalıdır']
  },
  reason: {
    type: String,
    required: [true, 'Səbəb tələb olunur'],
    trim: true,
    minlength: [3, 'Səbəb ən azı 3 simvol olmalıdır'],
    maxlength: [500, 'Səbəb 500 simvoldan çox ola bilməz']
  },
  refundDate: {
    type: Date,
    required: [true, 'Qaytarma tarixi tələb olunur']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: [true, 'Yaradan admin tələb olunur']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Qeyd 500 simvoldan çox ola bilməz'],
    default: ''
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

refundSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

refundSchema.index({ child: 1, refundDate: -1 });
refundSchema.index({ refundDate: -1 });
refundSchema.index({ originalPayment: 1 });
refundSchema.index({ isActive: 1 });

module.exports = mongoose.model('Refund', refundSchema);
