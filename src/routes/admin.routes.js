const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const requireAuth = require("../middleware/auth");
const requireRole = require("../middleware/roleCheck");
const {
  getCommissionRule, updateCommissionRule,
  triggerVendorPayout, triggerRiderPayout, manualRiderPayout,
  listVendors, listRiders,
} = require("../controllers/admin.controller");

const router = express.Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/commission-rules", asyncHandler(getCommissionRule));
router.post("/commission-rules", asyncHandler(updateCommissionRule));

router.post("/payouts/vendors/run", asyncHandler(triggerVendorPayout));
router.post("/payouts/riders/run", asyncHandler(triggerRiderPayout));
router.post("/payouts/riders/manual", asyncHandler(manualRiderPayout));

router.get("/vendors", asyncHandler(listVendors));
router.get("/riders", asyncHandler(listRiders));

module.exports = router;
