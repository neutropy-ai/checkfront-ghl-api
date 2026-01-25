// api/create-booking.js
const { checkfront, findItemsByName, safeBooking } = require("../lib/checkfront");
const { guard } = require("../lib/guard");
const { parseDate } = require("../lib/dates");

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
      item_id,
      item_name,
      date,
      start_date,
      customer_name,
      customer_email,
      customer_phone,
      quantity = 1
    } = { ...req.query, ...req.body };

    // Resolve item_id from item_name if needed
    let resolvedItemId = item_id;
    let itemInfo = null;

    if (!resolvedItemId && item_name) {
      const { exact, matches } = await findItemsByName(item_name);

      if (exact) {
        itemInfo = exact;
        resolvedItemId = exact.id;
      } else if (matches.length > 0) {
        const options = matches.slice(0, 3).map(m => m.name).join(", ");
        return res.status(400).json({
          ok: false,
          code: "MULTIPLE_ITEMS_FOUND",
          matches: matches.slice(0, 5).map(m => ({ id: m.id, name: m.name })),
          speech: `I found a few options: ${options}. Which one did you mean?`
        });
      } else {
        return res.status(404).json({
          ok: false,
          code: "ITEM_NOT_FOUND",
          speech: "I couldn't find that service. What would you like to book?"
        });
      }
    }

    if (!resolvedItemId) {
      return res.status(400).json({
        ok: false,
        code: "MISSING_ITEM",
        speech: "What service would you like to book?",
        fields_needed: ["item_name"]
      });
    }

    // Parse and validate date
    const bookingDate = date || start_date;
    if (!bookingDate) {
      return res.status(400).json({
        ok: false,
        code: "MISSING_DATE",
        speech: "What date would you like to book?",
        fields_needed: ["date"]
      });
    }

    const parsedDate = parseDate(bookingDate, process.env.TIMEZONE);
    if (parsedDate.error) {
      console.log("[create-booking] Date parse error:", parsedDate.error, "Input:", bookingDate);
      return res.status(400).json({
        ok: false,
        code: "INVALID_DATE",
        speech: `I didn't catch that date. Could you say it again? For example, "February 15th" or "next Saturday".`
      });
    }

    // Validate customer info
    if (!customer_name) {
      return res.status(400).json({
        ok: false,
        code: "MISSING_CUSTOMER_NAME",
        speech: "I'll need your name for the booking. What name should I put it under?",
        fields_needed: ["customer_name"]
      });
    }

    if (!customer_email && !customer_phone) {
      return res.status(400).json({
        ok: false,
        code: "MISSING_CONTACT",
        speech: "I'll need a way to send you the confirmation. What's your email or phone number?",
        fields_needed: ["customer_email", "customer_phone"]
      });
    }

    console.log("[create-booking] Creating booking:", {
      item_id: resolvedItemId,
      date: parsedDate.dateStr,
      customer_name,
      customer_email,
      customer_phone
    });

    // Step 1: Get rated item with SLIP
    // Checkfront requires a "rated" item query to get the SLIP token for booking
    const ratedItem = await checkfront(`/item/${resolvedItemId}`, {
      query: {
        start_date: parsedDate.dateStr,
        end_date: parsedDate.dateStr,
        param: { qty: quantity }
      }
    });

    console.log("[create-booking] Rated item response:", JSON.stringify(ratedItem).slice(0, 500));

    // Check if item is available
    if (!ratedItem?.item) {
      return res.status(404).json({
        ok: false,
        code: "ITEM_NOT_FOUND",
        speech: "I couldn't find that service. What would you like to book?"
      });
    }

    const itemName = ratedItem.item.name || itemInfo?.name || "that service";

    // Get the SLIP from the rated response
    const slip = ratedItem.item?.slip || ratedItem.item?.rate?.slip;

    if (!slip) {
      console.log("[create-booking] No SLIP returned - item may not be available");
      return res.status(400).json({
        ok: false,
        code: "NOT_AVAILABLE",
        speech: `Unfortunately ${itemName} isn't available on ${parsedDate.formatted}. Would you like to try a different date?`
      });
    }

    console.log("[create-booking] Got SLIP, creating session");

    // Step 2: Create booking session with the SLIP
    const sessionResult = await checkfront("/booking/session", {
      method: "POST",
      form: {
        slip: slip
      }
    });

    console.log("[create-booking] Session response:", JSON.stringify(sessionResult).slice(0, 500));

    if (!sessionResult?.booking?.session?.id) {
      if (sessionResult?.error || sessionResult?.request?.status === "ERROR") {
        const errorMsg = sessionResult?.request?.error || sessionResult?.error || "Unknown error";
        console.log("[create-booking] Session error:", errorMsg);
        return res.status(400).json({
          ok: false,
          code: "SESSION_ERROR",
          speech: `Unfortunately ${itemName} isn't available on ${parsedDate.formatted}. Would you like to try a different date?`
        });
      }
      throw new Error("Failed to create booking session");
    }

    const sessionId = sessionResult.booking.session.id;
    console.log("[create-booking] Session created:", sessionId);

    // Step 3: Set customer form data
    // Checkfront expects form fields as form[field_name]=value
    const formResult = await checkfront("/booking/session", {
      method: "POST",
      form: {
        session_id: sessionId,
        "form[customer_name]": customer_name,
        "form[customer_email]": customer_email || "",
        "form[customer_phone]": customer_phone || ""
      }
    });

    console.log("[create-booking] Form update response:", JSON.stringify(formResult).slice(0, 300));

    // Step 4: Complete the booking
    const bookingResult = await checkfront("/booking/create", {
      method: "POST",
      form: {
        session_id: sessionId
      }
    });

    console.log("[create-booking] Booking result:", JSON.stringify(bookingResult).slice(0, 500));

    if (!bookingResult?.booking) {
      const errorMsg = bookingResult?.request?.error || bookingResult?.error || "Unknown error";
      console.log("[create-booking] Booking failed:", errorMsg);
      throw new Error("Booking creation failed: " + errorMsg);
    }

    const booking = bookingResult.booking;

    return res.status(200).json({
      ok: true,
      booking_id: booking.booking_id || booking.id,
      code: booking.code,
      booking: safeBooking(booking),
      speech: `Great! I've booked ${itemName} for ${customer_name} on ${parsedDate.formatted}. Your confirmation number is ${booking.code}. You'll receive a confirmation email shortly. Is there anything else?`
    });

  } catch (err) {
    console.error("[create-booking] Error:", err.message, err.payload || "");

    return res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      speech: "I had trouble completing that booking. Would you like to try again?"
    });
  }
};
