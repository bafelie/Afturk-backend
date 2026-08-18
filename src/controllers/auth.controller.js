const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { signToken } = require("../utils/jwt");

// Public self-registration — customers only. Vendors/riders are created
// automatically when their Application is approved (see application.controller.js).
async function registerCustomer(req, res) {
  const { phone, email, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: "phone and password are required" });
  }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) return res.status(409).json({ error: "An account with this phone already exists" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { phone, email, passwordHash, role: "CUSTOMER" },
  });

  const token = signToken({ id: user.id, role: user.role });
  res.status(201).json({ token, user: { id: user.id, phone: user.phone, role: user.role } });
}

// Shared login for all roles (customer, vendor, rider, admin).
async function login(req, res) {
  const { phone, password } = req.body;
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) return res.status(401).json({ error: "Invalid phone or password" });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ error: "Invalid phone or password" });

  const token = signToken({ id: user.id, role: user.role });
  res.json({ token, user: { id: user.id, phone: user.phone, role: user.role } });
}

module.exports = { registerCustomer, login };
