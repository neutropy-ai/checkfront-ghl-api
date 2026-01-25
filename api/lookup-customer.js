// api/lookup-customer.js
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

  // Allow both GET and POST
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      speech: "Sorry, something went wrong."
    });
  }

  try {
    const { phone, customer_phone, email, customer_email } = { ...req.query, ...req.body };

    const searchPhone = phone || customer_phone;
    const searchEmail = email || customer_email;

    if (!searchPhone && !searchEmail) {
      return res.status(400).json({
        ok: false,
        code: "MISSING_IDENTIFIER",
        speech: "I need a phone number or email to look up your bookings.",
        fields_needed: ["phone"]
      });
    }

    // Normalize phone number - remove spaces, dashes, keep + prefix
    const normalizePhone = (p) => {
      if (!p) return null;
      return p.replace(/[\s\-\(\)]/g, "");
    };

    const normalizedPhone = normalizePhone(searchPhone);

    console.log("[lookup-customer] Searching for:", { phone: normalizedPhone, email: searchEmail });

    // Search bookings by customer phone or email
    // Checkfront API: /booking?customer_email=X or search in results
    const query = {};
    if (searchEmail) {
      query.customer_email = searchEmail;
    }

    // Get recent bookings (last 90 days + next 90 days)
    const today = new Date();
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - 90);
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 90);

    const formatDate = (d) => {
      return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    };

    query.start_date = formatDate(pastDate);
    query.end_date = formatDate(futureDate);
    query.limit = 50;

    const result = await checkfront("/booking", { query });

    console.log("[lookup-customer] Search returned:", result?.bookings ? Object.keys(result.bookings).length + " bookings" : "none");

    if (!result?.bookings) {
      return res.status(200).json({
        ok: true,
        found: false,
        customer: null,
        upcoming_bookings: [],
        past_bookings: [],
        speech: "I don't have any bookings on file for that contact. Would you like to make a new booking?"
      });
    }

    // Filter bookings by phone number if provided (Checkfront may not filter by phone directly)
    let matchedBookings = Object.values(result.bookings);

    if (normalizedPhone) {
      matchedBookings = matchedBookings.filter(b => {
        const bookingPhone = normalizePhone(b.customer?.phone);
        return bookingPhone && (
          bookingPhone === normalizedPhone ||
          bookingPhone.endsWith(normalizedPhone.slice(-10)) || // Match last 10 digits
          normalizedPhone.endsWith(bookingPhone.slice(-10))
        );
      });
    }

    console.log("[lookup-customer] After phone filter:", matchedBookings.length, "bookings matched");

    if (matchedBookings.length === 0) {
      return res.status(200).json({
        ok: true,
        found: false,
        customer: null,
        upcoming_bookings: [],
        past_bookings: [],
        speech: "I don't have any bookings on file for that contact. Would you like to make a new booking?"
      });
    }

    // Extract customer info from most recent booking
    const mostRecent = matchedBookings.sort((a, b) =>
      new Date(b.created_date) - new Date(a.created_date)
    )[0];

    const customer = {
      name: mostRecent.customer?.name || null,
      email: mostRecent.customer?.email || null,
      phone: mostRecent.customer?.phone || null
    };

    // Split into upcoming and past bookings
    const todayStr = formatDate(today);
    const upcoming = [];
    const past = [];

    matchedBookings.forEach(b => {
      const booking = safeBooking(b);
      const bookingDate = b.start_date?.replace(/-/g, "") || "";

      if (bookingDate >= todayStr && b.status_name !== "Cancelled") {
        upcoming.push(booking);
      } else {
        past.push(booking);
      }
    });

    // Sort upcoming by date (soonest first)
    upcoming.sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
    // Sort past by date (most recent first)
    past.sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""));

    // Build personalized speech response
    let speech;
    const firstName = customer.name?.split(" ")[0] || "";

    if (upcoming.length > 0) {
      const nextBooking = upcoming[0];
      const itemName = nextBooking.item || "your appointment";

      if (upcoming.length === 1) {
        speech = firstName
          ? `Welcome back, ${firstName}! I see you have ${itemName} coming up on ${nextBooking.start_date}. How can I help you today?`
          : `I found your booking for ${itemName} on ${nextBooking.start_date}. How can I help you today?`;
      } else {
        speech = firstName
          ? `Welcome back, ${firstName}! I see you have ${upcoming.length} upcoming bookings, the next one is ${itemName} on ${nextBooking.start_date}. How can I help you today?`
          : `I found ${upcoming.length} upcoming bookings. The next one is ${itemName} on ${nextBooking.start_date}. How can I help you today?`;
      }
    } else if (past.length > 0) {
      speech = firstName
        ? `Welcome back, ${firstName}! I don't see any upcoming bookings, but I found your previous visits. Would you like to book another appointment?`
        : `I found your previous bookings but nothing upcoming. Would you like to make a new booking?`;
    } else {
      speech = "I don't have any bookings on file. Would you like to make a new booking?";
    }

    return res.status(200).json({
      ok: true,
      found: true,
      customer,
      upcoming_bookings: upcoming.slice(0, 5), // Limit to 5
      past_bookings: past.slice(0, 5), // Limit to 5
      total_upcoming: upcoming.length,
      total_past: past.length,
      speech
    });

  } catch (err) {
    console.error("lookup-customer failed:", err.message, err.payload || "");

    return res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      speech: "I had trouble looking that up. Can you tell me your name or booking reference instead?"
    });
  }
};
