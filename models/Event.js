const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Tədbir adı tələb olunur"],
    trim: true,
    maxlength: [200, "Tədbir adı 200 simvoldan çox ola bilməz"],
  },
  groups: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: [true, "Ən azı bir qrup seçilməlidir"],
    },
  ],
  startDate: {
    type: Date,
    required: [true, "Başlama tarixi tələb olunur"],
  },
  startTime: {
    type: String,
    required: [true, "Başlama saatı tələb olunur"],
    match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Düzgün saat formatı (HH:MM)"],
  },
  endDate: {
    type: Date,
    required: [true, "Bitmə tarixi tələb olunur"],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-save middleware to update updatedAt AAaa
eventSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Index for search
eventSchema.index({ name: "text" });

module.exports = mongoose.model("Event", eventSchema);
