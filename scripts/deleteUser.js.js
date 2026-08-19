// One-time helper to delete a user by phone number (for fixing mistakes during setup).
// Run: node scripts/deleteUser.js "0244000000"

const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const prisma = new PrismaClient();

async function main() {
  const [, , phone] = process.argv;
  if (!phone) {
    console.log("Usage: node scripts/deleteUser.js <phone>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    console.log(`No user found with phone ${phone}`);
    process.exit(1);
  }

  await prisma.user.delete({ where: { phone } });
  console.log(`Deleted user with phone ${phone} (was role: ${user.role})`);
}

main()
  .catch((e) => console.error("Error:", e.message))
  .finally(() => prisma.$disconnect());