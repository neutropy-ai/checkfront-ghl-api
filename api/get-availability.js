require("../instrument.js");
const Sentry = require("@sentry/node");
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
        // Multiple matches - build natural clarifying question
        const matchNames = matches.map(m => m.name.toLowerCase());
        let speech;

        // Smart categorization for common scenarios
        const hasShared = matchNames.some(n => n.includes("shared"));
        const hasPrivate = matchNames.some(n => n.includes("private"));
        const has30Min = matchNames.some(n => n.includes("30 min") || n.includes("30min"));
        const has1Hour = matchNames.some(n => n.includes("1 hour") || n.includes("hour"));

        if ((hasShared || hasPrivate) && (has30Min || has1Hour)) {
          // Sauna-specific: ask about type and duration
          speech = "Would you like a shared or private session? And would you prefer 30 minutes or a full hour?";
        } else if (hasShared && hasPrivate) {
          speech = "Would you prefer the shared or private option?";
        } else if (has30Min && has1Hour) {
          speech = "Would you like the 30 minute session or the full hour?";
        } else {
          // Generic: list top 3 options naturally
          const options = matches.slice(0, 3).map(m => m.name).join(", or ");
          speech = `I have a few options: ${options}. Which would you like?`;
        }

        return res.status(200).json({
          ok: true,
          code: "MULTIPLE_ITEMS_FOUND",
          needs_clarification: true,
          matches: matches.slice(0, 5).map(m => ({ id: m.id, name: m.name })),
          speech
        });
      } else {
        console.log("[get-availability] No item found matching:", item_name);
        return res.status(404).json({
          ok: false,
          code: "ITEM_NOT_FOUND",
          searched_for: item_name,
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

    console.log("[get-availability] Checking availability:", {
      item_id: resolvedItemId,
      start_date: checkStartDate,
      end_date: checkEndDate
    });

    // Fetch item with availability
    const result = await checkfront(`/item/${resolvedItemId}`, {
      query: {
        start_date: checkStartDate,
        end_date: checkEndDate
      }
    });

    console.log("[get-availability] API response:", JSON.stringify(result).slice(0, 500));

    // Handle the item from the response
    const item = result?.item || result;

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

    // Try different possible calendar locations in the response
    const calendar = item.calendar || result.calendar || item.item?.calendar;

    if (calendar) {
      for (const [dateStr, dayInfo] of Object.entries(calendar)) {
        // Format date for display (YYYYMMDD -> readable)
        const formattedDate = formatDateForSpeech(dateStr);

        if (dayInfo.available && dayInfo.available > 0) {
          availableDates.push({
            date: dateStr,
            formatted: formattedDate,
            available: dayInfo.available,
            rate: dayInfo.rate,
            slip: dayInfo.slip // Include SLIP for potential booking
          });
        } else {
          unavailableDates.push(dateStr);
        }
      }
    }

    const itemName = itemInfo?.name || item.name || "that";

    // Helper to format dates for speech
    function formatDateForSpeech(dateStr) {
      // YYYYMMDD -> human readable
      if (dateStr.length === 8) {
        const year = dateStr.slice(0, 4);
        const month = dateStr.slice(4, 6);
        const day = dateStr.slice(6, 8);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      }
      return dateStr;
    }

    // Helper to format time from SLIP or time string
    function formatTime(timeStr) {
      if (!timeStr) return null;
      // Handle various formats: "14:00", "1400", "2:00 PM"
      const match = timeStr.match(/(\d{1,2}):?(\d{2})?/);
      if (match) {
        let hours = parseInt(match[1]);
        const mins = match[2] ? parseInt(match[2]) : 0;
        const ampm = hours >= 12 ? "pm" : "am";
        if (hours > 12) hours -= 12;
        if (hours === 0) hours = 12;
        return mins > 0 ? `${hours}:${String(mins).padStart(2, "0")}${ampm}` : `${hours}${ampm}`;
      }
      return timeStr;
    }

    // Build natural speech response
    let speechResponse;
    if (availableDates.length === 0) {
      // No availability on requested date - find alternative time slots
      const requestedDay = formatDateForSpeech(checkStartDate).split(",")[0];

      // Check if we have time slot data in the calendar
      const dayData = calendar?.[checkStartDate];
      const timeSlots = dayData?.times || dayData?.slots || [];

      // Look for available slots on same day or nearby days
      const altTimes = [];

      // First check same day for available times
      if (calendar) {
        for (const [dateStr, dayInfo] of Object.entries(calendar)) {
          const slots = dayInfo.times || dayInfo.slots || [];
          if (Array.isArray(slots)) {
            for (const slot of slots) {
              if (slot.available > 0 || slot.status === "available") {
                const time = formatTime(slot.time || slot.start_time);
                if (time) {
                  altTimes.push({
                    date: dateStr,
                    dayName: formatDateForSpeech(dateStr).split(",")[0],
                    time
                  });
                }
              }
              if (altTimes.length >= 3) break;
            }
          }
          if (altTimes.length >= 3) break;
        }
      }

      if (altTimes.length >= 2) {
        const sameDay = altTimes.filter(t => t.date === checkStartDate);
        if (sameDay.length >= 2) {
          speechResponse = `That time is booked, but I have ${sameDay[0].time} and ${sameDay[1].time} available on ${requestedDay}. Would either work?`;
        } else {
          speechResponse = `${requestedDay} is fully booked, but I have ${altTimes[0].dayName} at ${altTimes[0].time} or ${altTimes[1].dayName} at ${altTimes[1].time}. Would either work?`;
        }
      } else if (altTimes.length === 1) {
        speechResponse = `That's booked, but ${altTimes[0].dayName} at ${altTimes[0].time} is available. Would that work?`;
      } else {
        // Fallback - no time slots, just day availability
        speechResponse = `${requestedDay} is fully booked. Would you like me to check a different day?`;
      }
    } else if (availableDates.length === 1) {
      const d = availableDates[0];
      // Use just the day name for natural speech
      const dayName = d.formatted.split(",")[0]; // "Friday" from "Friday, January 31"
      speechResponse = `${dayName} looks good! Would you like me to book that for you?`;
    } else {
      // List just day names for cleaner speech
      const dayNames = availableDates.slice(0, 3).map(d => d.formatted.split(",")[0]);
      const lastDay = dayNames.pop();
      const dayList = dayNames.length > 0 ? `${dayNames.join(", ")} or ${lastDay}` : lastDay;
      speechResponse = `I have ${dayList} available. Which works best for you?`;
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
    Sentry.captureException(err);

    return res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      speech: "Sorry about that — I hit a snag. Can we try that again?"
    });
  }
};
