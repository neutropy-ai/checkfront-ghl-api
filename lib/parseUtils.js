// lib/parseUtils.js
const { wordsToNumbers } = require("words-to-numbers");
const parseDuration = require("parse-duration");
const human = require("humanparser");
const { parsePhoneNumber, isValidPhoneNumber } = require("libphonenumber-js");

/**
 * Parse quantity from text like "two adults and three kids"
 * @param {string} input - Text containing quantities
 * @returns {{ adults: number, children: number }} Parsed quantities
 */
function parseQuantity(input) {
  if (!input) return { adults: 0, children: 0 };

  // Convert words to numbers: "two adults" → "2 adults"
  const converted = String(wordsToNumbers(input) || input).toLowerCase();

  let adults = 0;
  let children = 0;

  // Match adult patterns
  const adultMatch = converted.match(/(\d+)\s*(?:adult|person|people|guest)/i);
  if (adultMatch) {
    adults = parseInt(adultMatch[1], 10);
  }

  // Match children patterns
  const childMatch = converted.match(/(\d+)\s*(?:kid|child|children)/i);
  if (childMatch) {
    children = parseInt(childMatch[1], 10);
  }

  // If just a number with no qualifier, assume adults
  if (adults === 0 && children === 0) {
    const numberMatch = converted.match(/(\d+)/);
    if (numberMatch) {
      adults = parseInt(numberMatch[1], 10);
    }
  }

  return { adults, children };
}

/**
 * Parse duration string to milliseconds
 * @param {string} input - Duration string like "2 hours", "1h 30m", "half an hour"
 * @returns {number|null} Duration in milliseconds, or null if invalid
 */
function parseDurationMs(input) {
  if (!input) return null;

  // Handle common natural language phrases parse-duration doesn't support
  const normalized = input.toLowerCase().trim();
  const naturalPhrases = {
    "half an hour": 30 * 60 * 1000,
    "half hour": 30 * 60 * 1000,
    "quarter of an hour": 15 * 60 * 1000,
    "quarter hour": 15 * 60 * 1000,
    "an hour": 60 * 60 * 1000,
    "a day": 24 * 60 * 60 * 1000,
  };

  if (naturalPhrases[normalized]) {
    return naturalPhrases[normalized];
  }

  try {
    return parseDuration(input);
  } catch {
    return null;
  }
}

/**
 * Parse duration string to minutes
 * @param {string} input - Duration string
 * @returns {number|null} Duration in minutes, or null if invalid
 */
function parseDurationMinutes(input) {
  const ms = parseDurationMs(input);
  return ms ? Math.round(ms / 60000) : null;
}

/**
 * Parse a full name into components
 * @param {string} fullName - Full name like "John O'Brien" or "Dr. Jane Smith Jr."
 * @returns {{ firstName: string, lastName: string, salutation?: string, suffix?: string }}
 */
function parseName(fullName) {
  if (!fullName) return { firstName: "", lastName: "" };

  const parsed = human.parseName(fullName);
  return {
    firstName: parsed.firstName || "",
    lastName: parsed.lastName || "",
    salutation: parsed.salutation || undefined,
    suffix: parsed.suffix || undefined,
  };
}

/**
 * Validate a phone number
 * @param {string} phone - Phone number
 * @param {string} [defaultCountry="IE"] - Default country code (IE for Ireland)
 * @returns {boolean} True if valid
 */
function validatePhone(phone, defaultCountry = "IE") {
  if (!phone) return false;
  try {
    return isValidPhoneNumber(phone, defaultCountry);
  } catch {
    return false;
  }
}

/**
 * Parse and format a phone number
 * @param {string} phone - Phone number
 * @param {string} [defaultCountry="IE"] - Default country code
 * @returns {{ valid: boolean, national?: string, international?: string, e164?: string }}
 */
function parsePhone(phone, defaultCountry = "IE") {
  if (!phone) return { valid: false };

  try {
    if (!isValidPhoneNumber(phone, defaultCountry)) {
      return { valid: false };
    }

    const parsed = parsePhoneNumber(phone, defaultCountry);
    return {
      valid: true,
      national: parsed.formatNational(),
      international: parsed.formatInternational(),
      e164: parsed.format("E.164"),
    };
  } catch {
    return { valid: false };
  }
}

/**
 * Format phone number for voice confirmation
 * Says digits individually, then "ending in XXX" for last 3
 * @param {string} phone - Phone number
 * @returns {string} Speech-friendly format like "zero eight five seven seven four six, ending in nine zero zero"
 */
function formatPhoneForSpeech(phone) {
  if (!phone) return "";

  // Remove non-digits except leading +
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 4) return phone;

  // Split into prefix and last 3 digits
  const prefix = digits.slice(0, -3);
  const suffix = digits.slice(-3);

  // Convert digits to words
  const digitWords = {
    "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
    "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine"
  };

  // Say prefix digits individually
  const prefixSpeech = prefix.split("").map(d => digitWords[d] || d).join(" ");

  // Say suffix as a number
  const suffixNum = parseInt(suffix, 10);
  const suffixSpeech = suffix; // Keep as digits for "ending in 900"

  return `${prefixSpeech}, ending in ${suffixSpeech}`;
}

module.exports = {
  parseQuantity,
  parseDurationMs,
  parseDurationMinutes,
  parseName,
  validatePhone,
  parsePhone,
  formatPhoneForSpeech,
};
