const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const prisma = require("../config/prisma");

const LIST_SELECT = {
  id: true, type: true, status: true, phone: true, ghanaCard: true,
  payoutMethod: true, payoutNumber: true, businessName: true, category: true,
  ownerName: true, address: true, fullName: true, vehicleType: true,
  vehicleReg: true, vehicleSource: true, isStudent: true,
  reviewedBy: true, reviewedAt: true, createdAt: true,
};

async function submitApplication(req, res) {
  const { type } = req.body;
  if (!["VENDOR", "RIDER"].includes(type)) {
    return res.status(400).json({ error: "type must be VENDOR or RIDER" });
  }

  const {
    phone, ghanaCard, payoutMethod, payoutNumber,
    businessName, category, ownerName, address,
    fullName, vehicleType, vehicleReg, vehicleSource,
    isStudent, selfiePhoto, ghanaCardPhoto, studentIdPhoto,
  } = req.body;

  if (!phone || !ghanaCard || !payoutNumber) {
    return res.status(400).json({ error: "phone, ghanaCard and payoutNumber are required" });
  }

  const application = await prisma.application.create({
    data: {
      type, phone, ghanaCard, payoutMethod, payoutNumber,
      businessName, category, ownerName, address,
      fullName, vehicleType, vehicleReg, vehicleSource,
      isStudent: !!isStudent, selfiePhoto, ghanaCardPhoto,
      studentIdPhoto: isStudent ? studentIdPhoto : null,
    },
  });

  res.status(201).json({ reference: application.id, status: application.status });
}

async function listApplications(req, res) {
  const { status = "PENDING", type } = req.query;
  const applications = await prisma.application.findMany({
    where: {
      status: status.toUpperCase(),
      ...(type ? { type: type.toUpperCase() } : {}),
    },
    select: LIST_SELECT,
    orderBy: { createdAt: "desc" },
  });
  res.json(applications);
}

async function getApplication(req, res) {
  const { id } = req.params;
  const application = await prisma.application.findUnique({ where: { id } });
  if (!application) return res.status(404).json({ error: "Application not found" });
  res.json(application);
}

async function approveApplication(req, res) {
  const { id } = req.params;
  const application = await prisma.application.findUnique({ where: { id } });
  if (!application) return res.status(404).json({ error: "Application not found" });
  if (application.status !== "PENDING") {
    return res.status(400).json({ error: `Application already ${application.status.toLowerCase()}` });
  }

  const existingUser = await prisma.user.findUnique({ where: { phone: application.phone } });
  if (existingUser) {
    return res.status(409).json({ error: "A user with this phone already exists" });
  }

  const tempPassword = crypto.randomBytes(4).toString("hex");
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        phone: application.phone,
        passwordHash,
        role: application.type,
      },
    });

    if (application.type === "VENDOR") {
      await tx.vendor.create({
        data: {
          userId: user.id,
          businessName: application.businessName,
          category: application.category,
          address: application.address,
          ghanaCard: application.ghanaCard,
          payoutMethod: application.payoutMethod,
          payoutNumber: application.payoutNumber,
        },
      });
    } else {
      await tx.rider.create({
        data: {
          userId: user.id,
          fullName: application.fullName,
          phone: application.phone,
          ghanaCard: application.ghanaCard,
          vehicleType: application.vehicleType,
          vehicleReg: application.vehicleReg,
          vehicleSource: application.vehicleSource,
          payoutNumber: application.payoutNumber,
        },
      });
    }

    await tx.application.update({
      where: { id },
      data: { status: "APPROVED", reviewedBy: req.user.id, reviewedAt: new Date() },
    });

    return user;
  });

  res.json({
    message: "Application approved",
    userId: result.id,
    phone: result.phone,
    tempPassword,
  });
}

async function declineApplication(req, res) {
  const { id } = req.params;
  const application = await prisma.application.findUnique({ where: { id } });
  if (!application) return res.status(404).json({ error: "Application not found" });

  await prisma.application.update({
    where: { id },
    data: { status: "DECLINED", reviewedBy: req.user.id, reviewedAt: new Date() },
  });

  res.json({ message: "Application declined" });
}

module.exports = {
  submitApplication, listApplications, getApplication, approveApplication, declineApplication,
};