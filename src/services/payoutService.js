const prisma = require("../config/prisma");
const { initiateTransfer } = require("./paystackService");

// Vendor earnings become AVAILABLE the same day, after a short same-day
// dispute window (see markVendorEarningsAvailable). This is what makes
// daily vendor payout safe: money isn't released until the hold clears.
const VENDOR_HOLD_HOURS = 4;
// Rider earnings clear after a short window too, but riders are paid weekly by default.
const RIDER_HOLD_HOURS = 1;

// Call this once an order's payment is confirmed (from the Paystack webhook).
// Creates the PENDING earning rows with an availableAt timestamp.
async function createEarningsForOrder(order) {
  const vendorAvailableAt = new Date(Date.now() + VENDOR_HOLD_HOURS * 60 * 60 * 1000);
  const riderAvailableAt = new Date(Date.now() + RIDER_HOLD_HOURS * 60 * 60 * 1000);

  await prisma.vendorEarning.create({
    data: {
      vendorId: order.vendorId,
      orderId: order.id,
      grossAmount: order.subtotal,
      commissionAmount: +(order.subtotal * order.vendorCommissionRate).toFixed(2),
      netAmount: +(order.subtotal * (1 - order.vendorCommissionRate)).toFixed(2),
      status: "PENDING",
      availableAt: vendorAvailableAt,
    },
  });

  if (order.riderId) {
    const riderCommission = +(order.deliveryFee * order.riderCommissionRate).toFixed(2);
    await prisma.riderEarning.create({
      data: {
        riderId: order.riderId,
        orderId: order.id,
        deliveryFee: order.deliveryFee,
        tip: order.tip,
        commissionAmount: riderCommission,
        netAmount: +(order.deliveryFee - riderCommission + order.tip).toFixed(2),
        status: "PENDING",
        payoutType: "BATCH",
        availableAt: riderAvailableAt,
      },
    });
  }
}

// Flips PENDING -> AVAILABLE for any earning whose hold window has passed
// and whose order wasn't disputed/held in the meantime. Run this before each batch job.
async function releaseMaturedEarnings() {
  const now = new Date();

  await prisma.vendorEarning.updateMany({
    where: { status: "PENDING", availableAt: { lte: now } },
    data: { status: "AVAILABLE" },
  });

  await prisma.riderEarning.updateMany({
    where: { status: "PENDING", availableAt: { lte: now } },
    data: { status: "AVAILABLE" },
  });
}

// Runs nightly (e.g. via node-cron at midnight). Pays every vendor with an
// AVAILABLE balance in one Paystack transfer per vendor, then marks those
// earning rows PAID under a single PayoutBatch record for auditing.
async function runVendorDailyPayout() {
  await releaseMaturedEarnings();

  const available = await prisma.vendorEarning.findMany({
    where: { status: "AVAILABLE" },
    include: { vendor: true },
  });

  const byVendor = groupBy(available, (e) => e.vendorId);
  const batch = await prisma.payoutBatch.create({
    data: { type: "VENDOR_DAILY", totalAmount: 0, recipientCount: 0 },
  });

  let totalAmount = 0;
  let recipientCount = 0;

  for (const [vendorId, earnings] of Object.entries(byVendor)) {
    const amount = +earnings.reduce((s, e) => s + e.netAmount, 0).toFixed(2);
    const vendor = earnings[0].vendor;

    // NOTE: requires vendor.paystackRecipientCode to have been set up during onboarding.
    // await initiateTransfer({ recipientCode: vendor.paystackRecipientCode, amountInCedis: amount, reason: "Daily payout" });

    await prisma.vendorEarning.updateMany({
      where: { id: { in: earnings.map((e) => e.id) } },
      data: { status: "PAID", payoutBatchId: batch.id },
    });

    totalAmount += amount;
    recipientCount += 1;
  }

  await prisma.payoutBatch.update({
    where: { id: batch.id },
    data: { totalAmount, recipientCount },
  });

  return { batchId: batch.id, totalAmount, recipientCount };
}

// Runs weekly (e.g. every Monday via node-cron). Same pattern as vendor payout, for riders.
async function runRiderWeeklyPayout() {
  await releaseMaturedEarnings();

  const available = await prisma.riderEarning.findMany({
    where: { status: "AVAILABLE" },
    include: { rider: true },
  });

  const byRider = groupBy(available, (e) => e.riderId);
  const batch = await prisma.payoutBatch.create({
    data: { type: "RIDER_WEEKLY", totalAmount: 0, recipientCount: 0 },
  });

  let totalAmount = 0;
  let recipientCount = 0;

  for (const [riderId, earnings] of Object.entries(byRider)) {
    const amount = +earnings.reduce((s, e) => s + e.netAmount, 0).toFixed(2);
    const rider = earnings[0].rider;

    // await initiateTransfer({ recipientCode: rider.paystackRecipientCode, amountInCedis: amount, reason: "Weekly payout" });

    await prisma.riderEarning.updateMany({
      where: { id: { in: earnings.map((e) => e.id) } },
      data: { status: "PAID", payoutBatchId: batch.id },
    });

    totalAmount += amount;
    recipientCount += 1;
  }

  await prisma.payoutBatch.update({
    where: { id: batch.id },
    data: { totalAmount, recipientCount },
  });

  return { batchId: batch.id, totalAmount, recipientCount };
}

// Admin-triggered emergency payout for a single rider, outside the weekly batch.
async function runManualRiderPayout({ riderId, adminId, amount, reason }) {
  const rider = await prisma.rider.findUnique({ where: { id: riderId } });
  if (!rider) throw Object.assign(new Error("Rider not found"), { status: 404 });

  const available = await prisma.riderEarning.findMany({
    where: { riderId, status: "AVAILABLE" },
    orderBy: { createdAt: "asc" },
  });
  const availableBalance = available.reduce((s, e) => s + e.netAmount, 0);

  if (amount > availableBalance) {
    throw Object.assign(new Error("Amount exceeds rider's available balance"), { status: 400 });
  }

  // await initiateTransfer({ recipientCode: rider.paystackRecipientCode, amountInCedis: amount, reason: reason || "Emergency payout" });

  // Mark earnings PAID up to the requested amount (oldest first).
  let remaining = amount;
  for (const earning of available) {
    if (remaining <= 0) break;
    if (earning.netAmount <= remaining) {
      await prisma.riderEarning.update({
        where: { id: earning.id },
        data: { status: "PAID", payoutType: "MANUAL_EMERGENCY" },
      });
      remaining -= earning.netAmount;
    }
    // Note: partial earning splits aren't modeled here for simplicity — for MVP,
    // pick a rider with enough whole earning rows, or extend this to split rows.
  }

  return prisma.manualPayout.create({
    data: { riderId, adminId, amount, reason },
  });
}

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});
}

module.exports = {
  createEarningsForOrder,
  releaseMaturedEarnings,
  runVendorDailyPayout,
  runRiderWeeklyPayout,
  runManualRiderPayout,
};
