// One-time script to create the first Admin account.
// Run locally with: node scripts/createAdmin.js "0244000000" "yourpassword"

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const prisma = new PrismaClient();

async function main() {
  const [, , phone, password] = process.argv;

  if (!phone || !password) {
    console.log("Usage: node scripts/createAdmin.js <phone> <password>");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    console.log(`A user with phone ${phone} already exists (role: ${existing.role}).`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.user.create({
    data: { phone, passwordHash, role: "ADMIN" },
  });

  console.log("Admin account created successfully:");
  console.log(`  Phone: ${admin.phone}`);
  console.log(`  Role: ${admin.role}`);
}

main()
  .catch((e) => {
    console.error("Error creating admin:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());