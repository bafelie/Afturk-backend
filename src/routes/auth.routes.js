const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { registerCustomer, login } = require("../controllers/auth.controller");

const router = express.Router();

router.post("/register", asyncHandler(registerCustomer));
router.post("/login", asyncHandler(login));

module.exports = router;
