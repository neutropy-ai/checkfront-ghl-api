// api/modify-booking.js
const { checkfront, safeBooking } = require("../lib/checkfront");
const { guard } = require("../lib/guard");
const { parseDate } = require("../lib/dateUtils");

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
      speech: "Sorry, something went wrong. Can you try that again?"
    });
  }

  try {
    const {
      booking_id,
      new_date,
      new_start_date,
      customer_name,
      customer_email,
      customer_phone,
      notes,
      quantity
    } = { ...req.query, ...req.body };

    if (!booking_id) {
      return res.status(400).json({
        ok: false,
        code: "MISSING_BOOKING_ID",
        speech: "I can help modify a booking. What's your confirmation number?",
        fields_needed: ["booking_id"]
      });
    }

    // Fetch the existing booking
    const bookingResult = await checkfront(`/booking/${encodeURIComponent(booking_id)}`);
    const booking = bookingResult?.booking;

    if (!booking) {
      return res.status(404).json({
        ok: false,
        code: "BOOKING_NOT_FOUND",
        speech: "I couldn't find a booking with that number. Could you double-check it for me?"
      });
    }

    const itemName = booking.items?.[0]?.name || "your booking";
    const updates = {};
    const changes = [];

    // Handle date change
    const dateToChange = new_date || new_start_date;
    if (dateToChange) {
      const parsedDate = parseDate(dateToChange, process.env.TIMEZONE);
      if (parsedDate.error) {
        return res.status(400).json({
          ok: false,
          code: "INVALID_DATE",
          speech: "I didn't catch that date. Could you say it again?"
        });
      }
      updates.start_date = parsedDate.dateStr;
      updates.end_date = parsedDate.dateStr;
      changes.push(`date to ${parsedDate.formatted}`);
    }

    // Handle customer info changes
    if (customer_name) {
      updates.customer_name = customer_name;
      changes.push(`name to ${customer_name}`);
    }

    if (customer_email) {
      updates.customer_email = customer_email;
      changes.push("email");
    }

    if (customer_phone) {
      updates.customer_phone = customer_phone;
      changes.push("phone number");
    }

    if (quantity) {
      updates.qty = quantity;
      changes.push(`quantity to ${quantity}`);
    }

    // Check if there's anything to update
    if (Object.keys(updates).length === 0 && !notes) {
      return res.status(400).json({
        ok: false,
        code: "NO_CHANGES",
        speech: "What would you like to change about this booking? I can update the date, name, or contact information."
      });
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      await checkfront(`/booking/${encodeURIComponent(booking_id)}`, {
        method: "POST",
        form: updates
      });
    }

    // Add note if provided
    if (notes) {
      await checkfront(`/booking/${encodeURIComponent(booking_id)}/note`, {
        method: "POST",
        form: {
          body: `Modified via phone: ${notes}`
        }
      });
    }

    // Fetch updated booking
    const updatedResult = await checkfront(`/booking/${encodeURIComponent(booking_id)}`);
    const updatedBooking = updatedResult?.booking || booking;

    const changesSummary = changes.length > 0
      ? `I've updated the ${changes.join(" and ")}`
      : "I've updated the booking";

    return res.status(200).json({
      ok: true,
      booking_id,
      modified: true,
      changes,
      booking: safeBooking(updatedBooking),
      speech: `${changesSummary} for ${itemName}. Is there anything else you'd like to change?`
    });

  } catch (err) {
    console.error("modify-booking failed:", err.message, err.payload || "");

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
      speech: "I had trouble updating that booking. Would you like to try again?"
    });
  }
};
