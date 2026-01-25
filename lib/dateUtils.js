// lib/dateUtils.js v3.0.0
// Robust date parsing using chrono-node for natural language support

const chrono = require("chrono-node");

/**
 * Parse a date string from GHL Voice AI into components
 * Uses chrono-node for robust natural language parsing
 * Handles: "Friday", "next Tuesday", "Feb 15", "in 3 days", "the 20th", etc.
 *
 * @param {string} dateStr - The date string from GHL
 * @param {string} timezone - Timezone (default: Europe/Dublin)
 * @returns {object} { epoch, dateStr (YYYYMMDD), isoDate, formatted, error }
 */
function parseDate(dateStr, timezone = "Europe/Dublin") {
  if (!dateStr || typeof dateStr !== "string") {
    return { error: "No date provided" };
  }

  const input = dateStr.trim();
  if (!input) {
    return { error: "Empty date string" };
  }

  // Helper to format date result
  const formatDateResult = (date, originalInput) => {
    const epoch = Math.floor(date.getTime() / 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return {
      epoch,
      dateStr: `${year}${month}${day}`,
      isoDate: `${year}-${month}-${day}`,
      date,
      formatted: date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
      }),
      original: originalInput
    };
  };

  try {
    // Get current date as reference point
    const now = new Date();

    // Handle "the 15th" or "the 1st" (day of month without month name)
    const dayOnlyMatch = input.match(/^the\s+(\d{1,2})(st|nd|rd|th)?$/i);
    if (dayOnlyMatch) {
      const dayNum = parseInt(dayOnlyMatch[1]);
      if (dayNum >= 1 && dayNum <= 31) {
        const result = new Date(now);
        result.setDate(dayNum);
        result.setHours(12, 0, 0, 0);
        // If the day has passed this month, go to next month
        if (result <= now) {
          result.setMonth(result.getMonth() + 1);
        }
        return formatDateResult(result, input);
      }
    }

    // Use chrono to parse natural language date
    const results = chrono.parse(input, now, { forwardDate: true });

    let date;

    if (results.length > 0 && results[0].start) {
      date = results[0].start.date();
    } else {
      // Fallback: try native Date parsing for ISO formats
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        date = parsed;
      } else {
        // Log for debugging
        console.log(`[dateUtils] Could not parse: "${dateStr}"`);
        return { error: `Couldn't understand date: "${dateStr}"` };
      }
    }

    // Validate date
    if (!date || isNaN(date.getTime())) {
      return { error: `Invalid date: "${dateStr}"` };
    }

    return formatDateResult(date, input);
  } catch (err) {
    console.error(`[dateUtils] Parse error for "${dateStr}":`, err.message);
    return { error: `Failed to parse date: "${dateStr}"` };
  }
}

/**
 * Parse a time string into hours/minutes
 * @param {string} timeStr - "2pm", "14:00", "2:30 PM"
 * @returns {object} { hours, minutes, error }
 */
function parseTime(timeStr) {
  if (!timeStr) {
    return { hours: 9, minutes: 0 }; // Default to 9am
  }

  const input = timeStr.toLowerCase().trim();

  // Try chrono first
  const results = chrono.parse(input);
  if (results.length > 0 && results[0].start) {
    const parsed = results[0].start;
    if (parsed.isCertain("hour")) {
      return {
        hours: parsed.get("hour"),
        minutes: parsed.get("minute") || 0
      };
    }
  }

  // Fallback: manual parsing
  // Handle "2pm", "2 pm", "2:30pm", "2:30 pm"
  const match = input.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const ampm = match[3];

    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;

    return { hours, minutes };
  }

  // Handle 24-hour format "14:00"
  const match24 = input.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return { hours: parseInt(match24[1]), minutes: parseInt(match24[2]) };
  }

  return { error: `Couldn't understand time: "${timeStr}"` };
}

/**
 * Combine date and time into epoch timestamp
 */
function toEpoch(dateStr, timeStr, timezone = "Europe/Dublin") {
  const dateParsed = parseDate(dateStr, timezone);
  if (dateParsed.error) return dateParsed;

  const timeParsed = parseTime(timeStr);
  if (timeParsed.error) return timeParsed;

  const date = new Date(dateParsed.date);
  date.setHours(timeParsed.hours, timeParsed.minutes, 0, 0);

  return {
    epoch: Math.floor(date.getTime() / 1000),
    date,
    formatted: date.toLocaleString("en-US", { timeZone: timezone })
  };
}

module.exports = { parseDate, parseTime, toEpoch };
