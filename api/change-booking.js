require("../instrument.js");
const Sentry = require("@sentry/node");
// api/change-booking.js - Cancel existing booking and create new one in single call
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

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      speech: "Sorry, something went wrong. Can you try that again?"
    });
  }

  try {
    const {
      // To find existing booking (need at least one)
      booking_id,
      customer_phone,
      customer_email,
      // New booking details
      new_item_name,
      new_date,
      new_time,
      new_quantity
    } = { ...req.query, ...req.body };

    // Step 1: Find the existing booking
    let existingBooking = null;
    let existingBookingId = booking_id;

    if (booking_id) {
      // Direct lookup by ID
      console.log("[change-booking] Looking up by booking_id:", booking_id);
      try {
        const result = await checkfront(`/booking/${encodeURIComponent(booking_id)}`);
        existingBooking = result?.booking;
        existingBookingId = booking_id;
      } catch (err) {
        console.log("[change-booking] Booking not found by ID");
      }
    }

    // Try phone lookup if no booking found yet
    if (!existingBooking && customer_phone) {
      console.log("[change-booking] Searching by phone:", customer_phone);
      const searchResult = await checkfront("/booking", {
        query: { customer_phone, limit: 5 }
      });

      const bookings = searchResult?.bookings || {};
      const bookingsList = Object.values(bookings).filter(b =>
        b.status_id !== "VOID" && b.status_id !== "CANC"
      );

      if (bookingsList.length === 1) {
        existingBooking = bookingsList[0];
        existingBookingId = existingBooking.booking_id || existingBooking.code;
        console.log("[change-booking] Found booking by phone:", existingBookingId);
      } else if (bookingsList.length > 1) {
        return res.status(200).json({
          ok: true,
          code: "MULTIPLE_BOOKINGS",
          needs_clarification: true,
          bookings: bookingsList.map(b => ({
            id: b.booking_id || b.code,
            item: b.items?.[0]?.name,
            date: b.start_date
          })),
          speech: "I found a few bookings under that number. Which one would you like to change?"
        });
      }
    }

    // Try email lookup if still no booking
    if (!existingBooking && customer_email) {
      console.log("[change-booking] Searching by email:", customer_email);
      const searchResult = await checkfront("/booking", {
        query: { customer_email, limit: 5 }
      });

      const bookings = searchResult?.bookings || {};
      const bookingsList = Object.values(bookings).filter(b =>
        b.status_id !== "VOID" && b.status_id !== "CANC"
      );

      if (bookingsList.length === 1) {
        existingBooking = bookingsList[0];
        existingBookingId = existingBooking.booking_id || existingBooking.code;
      }
    }

    if (!existingBooking) {
      return res.status(404).json({
        ok: false,
        code: "BOOKING_NOT_FOUND",
        speech: "I couldn't find an existing booking to change. Do you have your booking reference number?"
      });
    }

    // Step 2: Check we have new booking details
    if (!new_item_name && !new_date && !new_time) {
      return res.status(400).json({
        ok: false,
        code: "MISSING_NEW_DETAILS",
        speech: "What would you like to change it to? The activity, date, or time?",
        current_booking: safeBooking(existingBooking)
      });
    }

    // Step 3: Cancel the existing booking
    console.log("[change-booking] Cancelling existing booking:", existingBookingId);
    const cancelStatus = process.env.CHECKFRONT_CANCEL_STATUS_ID || "VOID";

    await checkfront(`/booking/${encodeURIComponent(existingBookingId)}`, {
      method: "POST",
      form: { status_id: cancelStatus }
    });

    await checkfront(`/booking/${encodeURIComponent(existingBookingId)}/note`, {
      method: "POST",
      form: { body: "Cancelled for rebooking via phone" }
    });

    console.log("[change-booking] Existing booking cancelled");

    // Step 4: Prepare new booking details (use existing values as fallback)
    const oldItem = existingBooking.items?.[0];
    const newDetails = {
      item_name: new_item_name || oldItem?.name,
      date: new_date || existingBooking.start_date,
      time: new_time,
      quantity: new_quantity || oldItem?.qty || 1,
      customer_name: existingBooking.customer_name,
      customer_email: existingBooking.customer_email,
      customer_phone: existingBooking.customer_phone
    };

    const oldItemName = oldItem?.name || "your booking";
    const newItemName = new_item_name || oldItemName;

    // Return success with next steps for the AI
    return res.status(200).json({
      ok: true,
      code: "READY_TO_REBOOK",
      cancelled_booking_id: existingBookingId,
      new_booking_details: newDetails,
      speech: `Grand, I've cancelled the ${oldItemName}. Now let me book the ${newItemName} for you. Just checking availability...`,
      next_action: "create_booking",
      next_action_params: newDetails
    });

  } catch (err) {
    console.error("change-booking failed:", err.message, err.payload || "");
    Sentry.captureException(err);

    return res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      speech: "I hit a snag trying to change that booking. Would you like to try again?"
    });
  }
};
