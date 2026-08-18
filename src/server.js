require("dotenv").config();
const cron = require("node-cron");
const app = require("./app");
const { runVendorDailyPayout, runRiderWeeklyPayout } = require("./services/payoutService");

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Afturk backend running on port ${PORT}`);
});

// Vendor payout — every day at midnight
cron.schedule("0 0 * * *", async () => {
  console.log("Running daily vendor payout...");
  try {
    const result = await runVendorDailyPayout();
    console.log("Vendor payout complete:", result);
  } catch (err) {
    console.error("Vendor payout failed:", err);
  }
});

// Rider payout — every Monday at midnight
cron.schedule("0 0 * * 1", async () => {
  console.log("Running weekly rider payout...");
  try {
    const result = await runRiderWeeklyPayout();
    console.log("Rider payout complete:", result);
  } catch (err) {
    console.error("Rider payout failed:", err);
  }
});
