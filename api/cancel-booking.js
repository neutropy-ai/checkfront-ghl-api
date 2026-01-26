require("../instrument.js");
const Sentry = require("@sentry/node");
// api/cancel-booking.js
const { checkfront, safeBooking } = require("../lib/checkfront");
const { guard } = require("../lib/guard");

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-internal-token");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  // Auth check
  if (!guard(req, res)) return;

  // Method check
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      speech: "Sorry, something went wrong on my end. Can you try that again?"
    });
  }

  try {
    const { booking_id, reason } = { ...req.query, ...req.body };

    if (!booking_id) {
      return res.status(400).json({
        ok: false,
        code: "MISSING_BOOKING_ID",
        speech: "Sure, I can help cancel a booking. What's your confirmation number?",
        fields_needed: ["booking_id"]
      });
    }

    // Validate booking_id format - reject obviously invalid IDs (like concatenated strings)
    // Checkfront booking IDs are typically short codes like "FTNK-123456" or numeric IDs
    const cleanBookingId = String(booking_id).trim();
    if (cleanBookingId.length > 30 || cleanBookingId.includes(" ") || cleanBookingId.split("-").length > 3) {
      console.log("[cancel-booking] Invalid booking_id format:", cleanBookingId);
      return res.status(400).json({
        ok: false,
        code: "INVALID_BOOKING_ID",
        speech: "That doesn't look like a valid booking reference. It should be something like FTNK-123456. Do you have your confirmation number or email?"
      });
    }

    console.log("[cancel-booking] Looking up booking:", cleanBookingId);

    // 1) Fetch the booking to verify it exists
    const bookingResult = await checkfront(`/booking/${encodeURIComponent(cleanBookingId)}`);
    const booking = bookingResult?.booking;

    console.log("[cancel-booking] Booking lookup result:", booking ? "found" : "not found");

    if (!booking) {
      return res.status(404).json({
        ok: false,
        code: "BOOKING_NOT_FOUND",
        speech: "I couldn't find a booking with that number. Could you double-check the confirmation code for me?"
      });
    }

    // 2) Update status to cancelled
    const cancelStatus = process.env.CHECKFRONT_CANCEL_STATUS_ID || "VOID";
    console.log("[cancel-booking] Setting status to:", cancelStatus);

    const cancelResult = await checkfront(`/booking/${encodeURIComponent(cleanBookingId)}`, {
      method: "POST",
      form: {
        status_id: cancelStatus
      }
    });
    console.log("[cancel-booking] Cancel result:", JSON.stringify(cancelResult).slice(0, 300));

    // 3) Add a note about the cancellation
    console.log("[cancel-booking] Adding cancellation note");
    await checkfront(`/booking/${encodeURIComponent(cleanBookingId)}/note`, {
      method: "POST",
      form: {
        body: reason ? `Cancelled via phone: ${reason}` : "Cancelled via phone"
      }
    });
    console.log("[cancel-booking] Success - booking cancelled");

    const itemName = booking.items?.[0]?.name || "your booking";

    return res.status(200).json({
      ok: true,
      booking_id: cleanBookingId,
      cancelled: true,
      booking: safeBooking(booking),
      speech: `Done — I've cancelled ${itemName}. You should receive a confirmation email shortly. Is there anything else I can help with?`
    });

  } catch (err) {
    console.error("cancel-booking failed:", err.message, err.payload || "");
    Sentry.captureException(err);

    // Handle specific Checkfront errors
    if (err.status === 404) {
      return res.status(404).json({
        ok: false,
        code: "BOOKING_NOT_FOUND",
        speech: "I couldn't find that booking. Could you double-check the confirmation number?"
      });
    }

    return res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      speech: "I ran into an issue cancelling that booking. Would you like to try again?"
    });
  }
};
