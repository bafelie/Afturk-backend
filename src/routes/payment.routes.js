const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { handleWebhook } = require("../controllers/payment.controller");

const router = express.Router();

router.post("/webhook", asyncHandler(handleWebhook));

module.exports = router;
