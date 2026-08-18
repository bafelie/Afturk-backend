const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/roleCheck");
const {
  placeOrder, advanceOrderStatus, cancelOrder, getOrder, listOrders,
} = require("../controllers/order.controller");

const router = express.Router();

router.use(requireAuth);

router.post("/", requireRole("CUSTOMER"), asyncHandler(placeOrder));
router.get("/", asyncHandler(listOrders));
router.get("/:id", asyncHandler(getOrder));
router.patch("/:id/advance", requireRole("VENDOR", "RIDER"), asyncHandler(advanceOrderStatus));
router.patch("/:id/cancel", requireRole("ADMIN", "VENDOR"), asyncHandler(cancelOrder));

module.exports = router;
