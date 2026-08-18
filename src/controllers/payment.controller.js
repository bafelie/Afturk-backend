const crypto = require("crypto");
const { markOrderPaid } = require("./order.controller");

// Paystack calls this URL after every transaction event.
// Always verify the signature — never trust the payload on its own.
async function handleWebhook(req, res) {
  const signature = req.headers["x-paystack-signature"];
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest("hex");

  if (hash !== signature) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = req.body;

  if (event.event === "charge.success") {
    const reference = event.data.reference;
    await markOrderPaid(reference);
  }

  // Acknowledge quickly — Paystack retries if it doesn't get a 200.
  res.sendStatus(200);
}

module.exports = { handleWebhook };
