const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/roleCheck");
const {
  submitApplication, listApplications, getApplication, approveApplication, declineApplication,
} = require("../controllers/application.controller");

const router = express.Router();

router.post("/", asyncHandler(submitApplication));

router.get("/", requireAuth, requireRole("ADMIN"), asyncHandler(listApplications));
router.get("/:id", requireAuth, requireRole("ADMIN"), asyncHandler(getApplication));
router.patch("/:id/approve", requireAuth, requireRole("ADMIN"), asyncHandler(approveApplication));
router.patch("/:id/decline", requireAuth, requireRole("ADMIN"), asyncHandler(declineApplication));

module.exports = router;