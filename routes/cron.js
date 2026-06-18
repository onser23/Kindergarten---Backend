const express = require("express");
const router = express.Router();
const Child = require("../models/Child");
const Payment = require("../models/Payment");
const Package = require("../models/Package");

// @route   GET /api/cron/sync-due-dates
// @desc    Hər gün bütün aktiv uşaqların nextDueDate-ini recalculate edir (idempotent)
// @access  CRON_SECRET header ilə qorunur
router.get("/sync-due-dates", async (req, res) => {
  const secret = req.headers["x-cron-secret"];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  try {
    const children = await Child.find({ isActive: true }).populate(
      "package",
      "name price days duration"
    );

    let synced = 0;
    for (const child of children) {
      const pkg = child.package;
      if (!pkg) continue;

      if (pkg.duration === "Günlük") {
        if (child.nextDueDate !== null) {
          await Child.findByIdAndUpdate(child._id, { nextDueDate: null });
          synced++;
        }
        continue;
      }

      // Periodic paket: recalculate (son ödəniş + days, yoxsa startDate + days)
      const lastP = await Payment.findOne({
        child: child._id,
        isActive: true,
      }).sort({ paymentDate: -1 });
      const last = lastP ? lastP.paymentDate : child.startDate;
      const calculated = new Date(last);
      calculated.setDate(calculated.getDate() + (pkg.days || 30));

      if (
        !child.nextDueDate ||
        child.nextDueDate.getTime() !== calculated.getTime()
      ) {
        await Child.findByIdAndUpdate(child._id, {
          nextDueDate: calculated,
        });
        synced++;
      }
    }

    res.json({ success: true, synced, total: children.length });
  } catch (error) {
    console.error("Cron sync xətası:", error);
    res.status(500).json({
      success: false,
      message: "Server xətası",
      error: error.message,
    });
  }
});

module.exports = router;
