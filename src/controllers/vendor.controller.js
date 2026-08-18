const prisma = require("../config/prisma");

async function getMyVendor(req) {
  return prisma.vendor.findUnique({ where: { userId: req.user.id } });
}

async function listMenu(req, res) {
  const vendor = await getMyVendor(req);
  const items = await prisma.menuItem.findMany({ where: { vendorId: vendor.id } });
  res.json(items);
}

async function addMenuItem(req, res) {
  const vendor = await getMyVendor(req);
  const { name, price, category } = req.body;
  const item = await prisma.menuItem.create({
    data: { vendorId: vendor.id, name, price, category },
  });
  res.status(201).json(item);
}

async function updateMenuItem(req, res) {
  const { id } = req.params;
  const { name, price, category, isAvailable } = req.body;
  const item = await prisma.menuItem.update({
    where: { id },
    data: { name, price, category, isAvailable },
  });
  res.json(item);
}

async function deleteMenuItem(req, res) {
  const { id } = req.params;
  await prisma.menuItem.delete({ where: { id } });
  res.status(204).send();
}

// Public — customer app browses a vendor's live menu.
async function listPublicVendors(req, res) {
  const vendors = await prisma.vendor.findMany({
    where: { isActive: true },
    select: { id: true, businessName: true, category: true, address: true },
  });
  res.json(vendors);
}

async function listPublicMenu(req, res) {
  const { vendorId } = req.params;
  const items = await prisma.menuItem.findMany({ where: { vendorId, isAvailable: true } });
  res.json(items);
}

module.exports = {
  listMenu, addMenuItem, updateMenuItem, deleteMenuItem,
  listPublicVendors, listPublicMenu,
};
