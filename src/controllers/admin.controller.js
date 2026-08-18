const prisma = require("../config/prisma");
const {
  runVendorDailyPayout, runRiderWeeklyPayout, runManualRiderPayout,
} = require("../services/payoutService");

async function getCommissionRule(req, res) {
  const rule = await prisma.commissionRule.findFirst({ orderBy: { updatedAt: "desc" } });
  res.json(rule);
}

// Admin edits commission/service-fee config from the dashboard. Past orders
// keep their snapshotted rates, so this only affects orders placed after the change.
async function updateCommissionRule(req, res) {
  const { vendorCommissionRate, riderCommissionRate, serviceFeeType, serviceFeeValue } = req.body;
  const rule = await prisma.commissionRule.create({
    data: { vendorCommissionRate, riderCommissionRate, serviceFeeType, serviceFeeValue },
  });
  res.json(rule);
}

// Triggers the daily vendor payout job on demand (also runnable via cron — see server.js).
async function triggerVendorPayout(req, res) {
  const result = await runVendorDailyPayout();
  res.json(result);
}

async function triggerRiderPayout(req, res) {
  const result = await runRiderWeeklyPayout();
  res.json(result);
}

// The "emergency payout" button from the admin dashboard rider view.
async function manualRiderPayout(req, res) {
  const { riderId, amount, reason } = req.body;
  const payout = await runManualRiderPayout({ riderId, adminId: req.user.id, amount, reason });
  res.json(payout);
}

async function listVendors(req, res) {
  const vendors = await prisma.vendor.findMany({
    include: { _count: { select: { orders: true, menuItems: true } } },
  });
  res.json(vendors);
}

async function listRiders(req, res) {
  const riders = await prisma.rider.findMany({
    include: { _count: { select: { orders: true } } },
  });
  res.json(riders);
}

module.exports = {
  getCommissionRule, updateCommissionRule,
  triggerVendorPayout, triggerRiderPayout, manualRiderPayout,
  listVendors, listRiders,
};
