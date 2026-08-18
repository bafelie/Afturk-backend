const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/roleCheck");
const {
  listMenu, addMenuItem, updateMenuItem, deleteMenuItem,
  listPublicVendors, listPublicMenu,
} = require("../controllers/vendor.controller");

const router = express.Router();

// Public browsing — no auth needed
router.get("/", asyncHandler(listPublicVendors));
router.get("/:vendorId/menu", asyncHandler(listPublicMenu));

// Vendor-only menu management
router.get("/me/menu", requireAuth, requireRole("VENDOR"), asyncHandler(listMenu));
router.post("/me/menu", requireAuth, requireRole("VENDOR"), asyncHandler(addMenuItem));
router.patch("/me/menu/:id", requireAuth, requireRole("VENDOR"), asyncHandler(updateMenuItem));
router.delete("/me/menu/:id", requireAuth, requireRole("VENDOR"), asyncHandler(deleteMenuItem));

module.exports = router;
