const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/roleCheck");
const {
  submitApplication, listApplications, approveApplication, declineApplication,
} = require("../controllers/application.controller");

const router = express.Router();

// Public — hit by the vendor/rider sign-up forms
router.post("/", asyncHandler(submitApplication));

// Admin-only
router.get("/", requireAuth, requireRole("ADMIN"), asyncHandler(listApplications));
router.patch("/:id/approve", requireAuth, requireRole("ADMIN"), asyncHandler(approveApplication));
router.patch("/:id/decline", requireAuth, requireRole("ADMIN"), asyncHandler(declineApplication));

module.exports = router;
