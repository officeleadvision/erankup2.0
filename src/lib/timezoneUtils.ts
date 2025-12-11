/**
 * Timezone utilities for handling date/time formatting across different timezones.
 * Uses IANA timezone database via Intl API which automatically handles DST.
 */

export interface TimezoneInfo {
  name: string;
  offset: string;
  label: string;
}

/**
 * Get the current UTC offset for a timezone (e.g., "GMT+2", "GMT+3" for DST)
 */
export function getTimezoneOffset(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find((p) => p.type === "timeZoneName");
    return offsetPart?.value || "";
  } catch {
    return "";
  }
}

/**
 * Build a list of all supported timezones with their current offsets.
 * Handles DST automatically since it uses IANA timezone names.
 */
export function buildTimezoneList(): TimezoneInfo[] {
  try {
    // Use Intl API to get all supported timezones (IANA database)
    const timezones = Intl.supportedValuesOf("timeZone");
    return timezones.map((tz) => {
      const offset = getTimezoneOffset(tz);
      return {
        name: tz,
        offset,
        label: `${tz.replace(/_/g, " ")} (${offset})`,
      };
    });
  } catch {
    // Fallback for older browsers/environments
    const commonTimezones = [
      "UTC",
      "Europe/Sofia",
      "Europe/London",
      "Europe/Paris",
      "Europe/Berlin",
      "Europe/Moscow",
      "Europe/Athens",
      "Europe/Bucharest",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "Asia/Tokyo",
      "Asia/Shanghai",
      "Asia/Dubai",
      "Australia/Sydney",
    ];
    return commonTimezones.map((tz) => {
      const offset = getTimezoneOffset(tz);
      return {
        name: tz,
        offset,
        label: `${tz.replace(/_/g, " ")} (${offset})`,
      };
    });
  }
}

/**
 * Format a Date object in the specified timezone.
 * Returns date in YYYY-MM-DD format and time in HH:MM:SS format.
 */
export function formatDateInTimezone(
  date: Date,
  timezone: string
): { datePart: string; timePart: string } {
  try {
    const dateFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const timeFormatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return {
      datePart: dateFormatter.format(date),
      timePart: timeFormatter.format(date),
    };
  } catch {
    // Fallback to UTC if timezone is invalid
    return {
      datePart: date.toISOString().split("T")[0],
      timePart: date.toISOString().split("T")[1].split(".")[0],
    };
  }
}

/**
 * Parse a date string (YYYY-MM-DD) to start of day in UTC.
 * Returns null if the string is empty or invalid.
 */
export function parseDateStartOfDayUTC(dateString: string | null): Date | null {
  if (!dateString || dateString.trim() === "") return null;

  const parts = dateString.split("-");
  if (parts.length !== 3) return null;

  const [year, month, day] = parts.map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Parse a date string (YYYY-MM-DD) to end of day in UTC (23:59:59.999).
 * Returns null if the string is empty or invalid.
 */
export function parseDateEndOfDayUTC(dateString: string | null): Date | null {
  if (!dateString || dateString.trim() === "") return null;

  const parts = dateString.split("-");
  if (parts.length !== 3) return null;

  const [year, month, day] = parts.map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  const date = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Get the user's browser timezone or a default.
 */
export function getUserTimezone(
  defaultTimezone: string = "Europe/Sofia"
): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || defaultTimezone;
  } catch {
    return defaultTimezone;
  }
}

/**
 * Validate if a timezone string is valid.
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
