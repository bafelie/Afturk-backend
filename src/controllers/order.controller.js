const crypto = require("crypto");
const prisma = require("../config/prisma");
const { getActiveCommissionRule, computeOrderTotals } = require("../services/commissionService");
const { initializeTransaction, verifyTransaction } = require("../services/paystackService");
const { createEarningsForOrder } = require("../services/payoutService");

const NEXT_STATUS = {
  PLACED: "ACCEPTED",
  ACCEPTED: "PREPARING",
  PREPARING: "PICKED_UP",
  PICKED_UP: "DELIVERED",
};

// Customer places an order. Expects: vendorId, items: [{menuItemId, quantity}], deliveryFee, tip
async function placeOrder(req, res) {
  const customerId = req.user.id;
  const { vendorId, items, deliveryFee = 0, tip = 0 } = req.body;

  if (!vendorId || !items?.length) {
    return res.status(400).json({ error: "vendorId and at least one item are required" });
  }

  const menuItemIds = items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({ where: { id: { in: menuItemIds }, vendorId } });
  if (menuItems.length !== items.length) {
    return res.status(400).json({ error: "One or more items are invalid for this vendor" });
  }

  const subtotal = items.reduce((sum, i) => {
    const menuItem = menuItems.find((m) => m.id === i.menuItemId);
    return sum + menuItem.price * i.quantity;
  }, 0);

  const rule = await getActiveCommissionRule();
  const totals = computeOrderTotals({ subtotal, deliveryFee, tip, rule });

  const reference = `AF-${crypto.randomBytes(6).toString("hex")}`;

  const order = await prisma.order.create({
    data: {
      customerId,
      vendorId,
      status: "PLACED",
      paymentStatus: "PENDING",
      subtotal: totals.subtotal,
      deliveryFee: totals.deliveryFee,
      serviceFee: totals.serviceFee,
      tip: totals.tip,
      total: totals.total,
      vendorCommissionRate: totals.vendorCommissionRate,
      riderCommissionRate: totals.riderCommissionRate,
      paystackReference: reference,
      items: {
        create: items.map((i) => {
          const menuItem = menuItems.find((m) => m.id === i.menuItemId);
          return { menuItemId: menuItem.id, name: menuItem.name, price: menuItem.price, quantity: i.quantity };
        }),
      },
    },
    include: { items: true },
  });

  const customer = await prisma.user.findUnique({ where: { id: customerId } });
  const payment = await initializeTransaction({
    email: customer.email || `${customer.phone}@afturk.app`,
    amountInCedis: totals.total,
    reference,
    metadata: { orderId: order.id },
  });

  res.status(201).json({ order, checkoutUrl: payment.authorization_url });
}

// Called by the Paystack webhook once payment is confirmed (see payment.controller.js).
async function markOrderPaid(reference) {
  const order = await prisma.order.update({
    where: { paystackReference: reference },
    data: { paymentStatus: "PAID" },
  });
  await createEarningsForOrder(order);
  return order;
}

// Vendor accepts / marks preparing; rider marks picked up / delivered.
// Enforces the fixed order lifecycle instead of allowing arbitrary status jumps.
async function advanceOrderStatus(req, res) {
  const { id } = req.params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return res.status(404).json({ error: "Order not found" });

  const next = NEXT_STATUS[order.status];
  if (!next) {
    return res.status(400).json({ error: `Order in status ${order.status} cannot be advanced` });
  }

  const data = { status: next };
  // First rider to pick up an unassigned order gets attached to it.
  if (next === "PICKED_UP" && !order.riderId && req.user.role === "RIDER") {
    const rider = await prisma.rider.findUnique({ where: { userId: req.user.id } });
    data.riderId = rider.id;
  }

  const updated = await prisma.order.update({ where: { id }, data });
  res.json(updated);
}

async function cancelOrder(req, res) {
  const { id } = req.params;
  const order = await prisma.order.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  // Refund handling: trigger Paystack refund here if paymentStatus was PAID.
  res.json(order);
}

async function getOrder(req, res) {
  const { id } = req.params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, vendor: true, rider: true, disputes: true },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
}

async function listOrders(req, res) {
  const { status } = req.query;
  const where = status ? { status: status.toUpperCase() } : {};

  // Scope results by role: customers see their own, vendors see theirs, riders see assigned.
  if (req.user.role === "CUSTOMER") where.customerId = req.user.id;
  if (req.user.role === "VENDOR") {
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
    where.vendorId = vendor.id;
  }
  if (req.user.role === "RIDER") {
    const rider = await prisma.rider.findUnique({ where: { userId: req.user.id } });
    where.riderId = rider.id;
  }

  const orders = await prisma.order.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(orders);
}

module.exports = { placeOrder, markOrderPaid, advanceOrderStatus, cancelOrder, getOrder, listOrders };
