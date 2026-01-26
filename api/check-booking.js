require("../instrument.js");
const Sentry = require("@sentry/node");
// api/check-booking.js
const { checkfront, safeBooking } = require("../lib/checkfront");
const { guard } = require("../lib/guard");
const { parsePhone } = require("../lib/parseUtils");

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

  // Allow both GET and POST
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      speech: "Sorry, something went wrong. Can you try that again?"
    });
  }

  try {
    const {
      booking_id,
      customer_email,
      customer_phone,
      customer_name
    } = { ...req.query, ...req.body };

    let booking = null;

    console.log("[check-booking] Looking up booking:", { booking_id, customer_email, customer_phone, customer_name });

    // Look up by booking ID first
    if (booking_id) {
      try {
        console.log("[check-booking] Searching by booking_id:", booking_id);
        const result = await checkfront(`/booking/${encodeURIComponent(booking_id)}`);
        booking = result?.booking;
        console.log("[check-booking] Found by ID:", booking ? "yes" : "no");
      } catch (err) {
        console.log("[check-booking] Booking ID lookup error:", err.status);
        if (err.status !== 404) throw err;
      }
    }

    // If no booking found by ID, try searching by customer info
    if (!booking && (customer_email || customer_phone || customer_name)) {
      console.log("[check-booking] Searching by customer info");
      const searchParams = {};
      if (customer_email) searchParams.customer_email = customer_email;
      if (customer_phone) {
        // Normalize phone for better matching
        const phoneResult = parsePhone(customer_phone, "IE");
        searchParams.customer_phone = phoneResult.valid ? phoneResult.e164 : customer_phone;
      }
      if (customer_name) searchParams.customer_name = customer_name;

      // Search recent bookings
      const searchResult = await checkfront("/booking", {
        query: {
          ...searchParams,
          limit: 5,
          order_by: "start_date",
          order_dir: "DESC"
        }
      });

      console.log("[check-booking] Search result:", searchResult?.bookings ? Object.keys(searchResult.bookings).length + " bookings" : "none");

      if (searchResult?.bookings && Object.keys(searchResult.bookings).length > 0) {
        // Get the most recent booking
        const bookings = Object.values(searchResult.bookings);
        booking = bookings[0];

        // If multiple bookings, mention it
        if (bookings.length > 1) {
          return res.status(200).json({
            ok: true,
            multiple: true,
            count: bookings.length,
            bookings: bookings.slice(0, 3).map(safeBooking),
            speech: `Found ${bookings.length} bookings. Most recent is ${booking.items?.[0]?.name || "a booking"} on ${booking.start_date}. That one?`
          });
        }
      }
    }

    // No search criteria provided
    if (!booking_id && !customer_email && !customer_phone && !customer_name) {
      return res.status(400).json({
        ok: false,
        code: "MISSING_LOOKUP_INFO",
        speech: "Sure! What's your booking reference?",
        fields_needed: ["booking_id", "customer_email", "customer_name"]
      });
    }

    // Booking not found
    if (!booking) {
      return res.status(404).json({
        ok: false,
        code: "BOOKING_NOT_FOUND",
        speech: "Can't find that one. Want to try a different reference?"
      });
    }

    // Format the booking details for voice - keep it SHORT
    const itemName = booking.items?.[0]?.name || "your booking";
    const startDate = booking.start_date;
    const startTime = booking.start_time || booking.time;

    // Format date nicely if possible (YYYYMMDD -> "January 30th")
    let dateStr = startDate;
    if (startDate && startDate.length === 8) {
      const d = new Date(startDate.slice(0,4), startDate.slice(4,6)-1, startDate.slice(6,8));
      dateStr = d.toLocaleDateString("en-IE", { month: "long", day: "numeric" });
    }

    // Format time nicely if available
    let timeStr = "";
    if (startTime) {
      timeStr = ` at ${startTime}`;
    }

    return res.status(200).json({
      ok: true,
      booking: safeBooking(booking),
      speech: `Found it! ${itemName}, ${dateStr}${timeStr}. Anything else?`
    });

  } catch (err) {
    console.error("check-booking failed:", err.message, err.payload || "");
    Sentry.captureException(err);

    return res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      speech: "I had trouble looking that up. Could you try again?"
    });
  }
};
