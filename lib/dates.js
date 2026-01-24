// lib/dates.js
// Date parsing for GHL Voice AI -> Checkfront

/**
 * Parse a date string from GHL Voice AI into components
 * Handles: "2025-02-15", "tomorrow", "next Friday", "February 15", etc.
 *
 * @param {string} dateStr - The date string from GHL
 * @param {string} timezone - Timezone (default: Europe/Dublin)
 * @returns {object} { epoch, dateStr (YYYYMMDD), isoDate, error }
 */
function parseDate(dateStr, timezone = "Europe/Dublin") {
  if (!dateStr) {
    return { error: "No date provided" };
  }

  const input = dateStr.toLowerCase().trim();
  let date;

  // Get current date in timezone
  const now = new Date();
  const today = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
  today.setHours(0, 0, 0, 0);

  // Handle relative dates
  if (input === "today") {
    date = today;
  } else if (input === "tomorrow") {
    date = new Date(today);
    date.setDate(date.getDate() + 1);
  } else if (input === "yesterday") {
    date = new Date(today);
    date.setDate(date.getDate() - 1);
  } else if (input.startsWith("next ")) {
    // "next monday", "next week", etc.
    const part = input.replace("next ", "");
    const dayMap = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6
    };

    if (dayMap[part] !== undefined) {
      date = new Date(today);
      const currentDay = date.getDay();
      const targetDay = dayMap[part];
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7; // Always next week
      date.setDate(date.getDate() + daysUntil);
    } else if (part === "week") {
      date = new Date(today);
      date.setDate(date.getDate() + 7);
    } else {
      return { error: `Couldn't understand "next ${part}"` };
    }
  } else if (input.startsWith("in ")) {
    // "in 3 days", "in a week"
    const match = input.match(/in (\d+|a|an) (day|days|week|weeks)/);
    if (match) {
      const num = match[1] === "a" || match[1] === "an" ? 1 : parseInt(match[1]);
      const unit = match[2].startsWith("week") ? 7 : 1;
      date = new Date(today);
      date.setDate(date.getDate() + (num * unit));
    } else {
      return { error: `Couldn't understand "${input}"` };
    }
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    // ISO format: 2025-02-15
    date = new Date(input + "T12:00:00");
  } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(input)) {
    // US format: 2/15/2025 or 2/15/25
    const [m, d, y] = input.split("/");
    const year = y.length === 2 ? "20" + y : y;
    date = new Date(`${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T12:00:00`);
  } else {
    // Try natural language: "February 15", "Feb 15th", "15 February"
    const months = {
      january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2,
      april: 3, apr: 3, may: 4, june: 5, jun: 5,
      july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8,
      october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11
    };

    // Remove ordinal suffixes
    const cleaned = input.replace(/(\d+)(st|nd|rd|th)/g, "$1");

    // Try "Month Day" or "Day Month"
    let matched = false;
    for (const [monthName, monthNum] of Object.entries(months)) {
      const regex1 = new RegExp(`${monthName}\\s+(\\d{1,2})`);
      const regex2 = new RegExp(`(\\d{1,2})\\s+${monthName}`);

      let match = cleaned.match(regex1) || cleaned.match(regex2);
      if (match) {
        const day = parseInt(match[1]);
        const year = today.getFullYear();
        date = new Date(year, monthNum, day, 12, 0, 0);

        // If date is in the past, assume next year
        if (date < today) {
          date.setFullYear(year + 1);
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Last resort: try native Date parsing
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) {
        return { error: `Couldn't understand date: "${dateStr}"` };
      }
      date = parsed;
    }
  }

  // Validate date
  if (!date || isNaN(date.getTime())) {
    return { error: `Invalid date: "${dateStr}"` };
  }

  // Return multiple formats
  const epoch = Math.floor(date.getTime() / 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return {
    epoch,
    dateStr: `${year}${month}${day}`,  // YYYYMMDD for Checkfront
    isoDate: `${year}-${month}-${day}`, // YYYY-MM-DD
    date,
    formatted: date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    })
  };
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
```

---

## Updated `.env.example`
```
# Checkfront API credentials
CHECKFRONT_DOMAIN=funkytown.checkfront.com
CHECKFRONT_API_KEY=__YOUR_API_KEY__
CHECKFRONT_API_SECRET=__YOUR_API_SECRET__

# Internal auth token (generate a random string)
# Used to protect endpoints from unauthorized access
INTERNAL_TOKEN=__RANDOM_LONG_STRING__

# Checkfront status ID for cancelled bookings
# Check your Checkfront settings for the correct value
CHECKFRONT_CANCEL_STATUS_ID=VOID

# Timezone for date parsing (optional)
TIMEZONE=Europe/Dublin
