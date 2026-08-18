const prisma = require("../config/prisma");

// Returns the currently active commission rule, creating a sensible default
// row the first time this is called on a fresh database.
async function getActiveCommissionRule() {
  let rule = await prisma.commissionRule.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!rule) {
    rule = await prisma.commissionRule.create({
      data: {
        vendorCommissionRate: parseFloat(process.env.DEFAULT_VENDOR_COMMISSION_RATE || 0.2),
        riderCommissionRate: parseFloat(process.env.DEFAULT_RIDER_COMMISSION_RATE || 0.15),
        serviceFeeType: "flat",
        serviceFeeValue: parseFloat(process.env.DEFAULT_SERVICE_FEE_FLAT || 5),
      },
    });
  }
  return rule;
}

// Computes the full order price breakdown + the vendor/rider/platform split.
// subtotal = sum of menu item prices, deliveryFee is distance/vendor-based, tip is customer-entered.
function computeOrderTotals({ subtotal, deliveryFee, tip, rule }) {
  const serviceFee =
    rule.serviceFeeType === "percentage"
      ? +(subtotal * rule.serviceFeeValue).toFixed(2)
      : rule.serviceFeeValue;

  const total = +(subtotal + deliveryFee + serviceFee + tip).toFixed(2);

  const vendorCommission = +(subtotal * rule.vendorCommissionRate).toFixed(2);
  const vendorNet = +(subtotal - vendorCommission).toFixed(2);

  const riderCommission = +(deliveryFee * rule.riderCommissionRate).toFixed(2);
  const riderNet = +(deliveryFee - riderCommission + tip).toFixed(2);

  const platformRevenue = +(serviceFee + vendorCommission + riderCommission).toFixed(2);

  return {
    subtotal,
    deliveryFee,
    serviceFee,
    tip,
    total,
    vendorCommissionRate: rule.vendorCommissionRate,
    riderCommissionRate: rule.riderCommissionRate,
    vendorCommission,
    vendorNet,
    riderCommission,
    riderNet,
    platformRevenue,
  };
}

module.exports = { getActiveCommissionRule, computeOrderTotals };
