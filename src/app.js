const express = require("express");
const cors = require("cors");
const errorHandler = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth.routes");
const applicationRoutes = require("./routes/application.routes");
const vendorRoutes = require("./routes/vendor.routes");
const orderRoutes = require("./routes/order.routes");
const adminRoutes = require("./routes/admin.routes");
const paymentRoutes = require("./routes/payment.routes");

const app = express();

app.use(cors());

// Paystack webhook needs the raw body to verify its signature, so it must be
// mounted BEFORE the global json() body parser strips that away.
app.use(
  "/payments/webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    req.rawBody = req.body;
    req.body = JSON.parse(req.body.toString("utf8"));
    next();
  }
);

app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/auth", authRoutes);
app.use("/applications", applicationRoutes);
app.use("/vendors", vendorRoutes);
app.use("/orders", orderRoutes);
app.use("/admin", adminRoutes);
app.use("/payments", paymentRoutes);

app.use(errorHandler);

module.exports = app;
