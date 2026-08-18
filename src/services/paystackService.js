const axios = require("axios");

const paystack = axios.create({
  baseURL: "https://api.paystack.co",
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
});

// Starts a checkout transaction for a customer paying for an order.
// amount must be in kobo/pesewas (smallest currency unit) per Paystack's API.
async function initializeTransaction({ email, amountInCedis, reference, metadata }) {
  const res = await paystack.post("/transaction/initialize", {
    email,
    amount: Math.round(amountInCedis * 100),
    reference,
    metadata,
  });
  return res.data.data; // { authorization_url, access_code, reference }
}

// Confirms a transaction server-side (used as a fallback to the webhook,
// or to double check before crediting earnings).
async function verifyTransaction(reference) {
  const res = await paystack.get(`/transaction/verify/${reference}`);
  return res.data.data;
}

// Sends money out to a vendor/rider's MoMo or bank account.
// recipientCode must be created once via createTransferRecipient and stored on the Vendor/Rider record.
async function createTransferRecipient({ type, name, accountNumber, bankCode }) {
  // type: "mobile_money" or "nuban" (bank). bankCode is the MoMo network or bank code from Paystack's bank list.
  const res = await paystack.post("/transferrecipient", {
    type,
    name,
    account_number: accountNumber,
    bank_code: bankCode,
    currency: "GHS",
  });
  return res.data.data; // includes recipient_code
}

async function initiateTransfer({ recipientCode, amountInCedis, reason }) {
  const res = await paystack.post("/transfer", {
    source: "balance",
    amount: Math.round(amountInCedis * 100),
    recipient: recipientCode,
    reason,
  });
  return res.data.data;
}

module.exports = {
  initializeTransaction,
  verifyTransaction,
  createTransferRecipient,
  initiateTransfer,
};
