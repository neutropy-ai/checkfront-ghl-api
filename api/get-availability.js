// api/get-availability.js
const { checkfront, findItemsByName } = require("../lib/checkfront");
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
      item_id,
      item_name,
      date,
      start_date,
      end_date,
      days = 7
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
          speech: `I found a few options: ${options}. Which one were you asking about?`
        });
      } else {
        return res.status(404).json({
          ok: false,
          code: "ITEM_NOT_FOUND",
          speech: "I couldn't find that service. What would you like to check availability for?"
        });
      }
    }

    if (!resolvedItemId) {
      return res.status(400).json({
        ok: false,
        code: "MISSING_ITEM",
        speech: "What service would you like to check availability for?",
        fields_needed: ["item_name"]
      });
    }

    // Calculate date range
    let checkStartDate, checkEndDate;
    const timezone = process.env.TIMEZONE || "America/Los_Angeles";

    if (date || start_date) {
      const parsedStart = parseDate(date || start_date, timezone);
      if (parsedStart.error) {
        return res.status(400).json({
          ok: false,
          code: "INVALID_DATE",
          speech: "I didn't catch that date. Could you say it again?"
        });
      }
      checkStartDate = parsedStart.dateStr;

      if (end_date) {
        const parsedEnd = parseDate(end_date, timezone);
        if (!parsedEnd.error) {
          checkEndDate = parsedEnd.dateStr;
        }
      }

      if (!checkEndDate) {
        // Default to same day or range based on days param
        const endDate = new Date(parsedStart.date);
        endDate.setDate(endDate.getDate() + parseInt(days) - 1);
        const year = endDate.getFullYear();
        const month = String(endDate.getMonth() + 1).padStart(2, "0");
        const day = String(endDate.getDate()).padStart(2, "0");
        checkEndDate = `${year}${month}${day}`;
      }
    } else {
      // Default to next 7 days starting today
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      checkStartDate = `${year}${month}${day}`;

      const endDay = new Date(today);
      endDay.setDate(endDay.getDate() + parseInt(days) - 1);
      checkEndDate = `${endDay.getFullYear()}${String(endDay.getMonth() + 1).padStart(2, "0")}${String(endDay.getDate()).padStart(2, "0")}`;
    }

    // Fetch item with availability
    const item = await checkfront(`/item/${resolvedItemId}`, {
      query: {
        start_date: checkStartDate,
        end_date: checkEndDate
      }
    });

    if (!item) {
      return res.status(404).json({
        ok: false,
        code: "ITEM_NOT_FOUND",
        speech: "I couldn't pull that one up. Want me to check something else for you?"
      });
    }

    // Parse available dates from calendar
    const availableDates = [];
    const unavailableDates = [];

    if (item.calendar) {
      for (const [dateStr, dayInfo] of Object.entries(item.calendar)) {
        if (dayInfo.available && dayInfo.available > 0) {
          availableDates.push({
            date: dateStr,
            available: dayInfo.available,
            rate: dayInfo.rate
          });
        } else {
          unavailableDates.push(dateStr);
        }
      }
    }

    const itemName = itemInfo?.name || item.name || "that";

    // Build speech response
    let speechResponse;
    if (availableDates.length === 0) {
      speechResponse = `Unfortunately ${itemName} is fully booked from ${checkStartDate} to ${checkEndDate}. Want me to check some other dates?`;
    } else if (availableDates.length === 1) {
      speechResponse = `Good news — ${itemName} is available on ${availableDates[0].date}. Would you like me to book that for you?`;
    } else {
      const dateList = availableDates.slice(0, 3).map(d => d.date).join(", ");
      if (availableDates.length > 3) {
        speechResponse = `${itemName} has availability on ${dateList}, plus ${availableDates.length - 3} more dates. Which date works best for you?`;
      } else {
        speechResponse = `${itemName} is available on ${dateList}. Which date would you prefer?`;
      }
    }

    return res.status(200).json({
      ok: true,
      item_id: resolvedItemId,
      item_name: itemName,
      start_date: checkStartDate,
      end_date: checkEndDate,
      available_dates: availableDates,
      unavailable_dates: unavailableDates,
      total_available: availableDates.length,
      speech: speechResponse
    });

  } catch (err) {
    console.error("get-availability failed:", err.message, err.payload || "");

    return res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      speech: "Sorry about that — I hit a snag. Can we try that again?"
    });
  }
};
