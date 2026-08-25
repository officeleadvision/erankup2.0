/**
 * Timezone utilities for handling date/time formatting across different timezones.
 * Uses the IANA timezone database via the Intl API, which handles DST automatically.
 *
 * Every record in the database stores an absolute instant (UTC). Everything that
 * turns a calendar day ("2025-12-11") into an instant, or an instant into a
 * calendar day, MUST go through these helpers with an explicit timezone so that
 * the query range and the displayed date agree with each other.
 */

/** Business default: the customer base is in Bulgaria. */
export const DEFAULT_TIMEZONE = "Europe/Sofia";

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
 * Validate if a timezone string is valid.
 */
export function isValidTimezone(timezone: string | null | undefined): boolean {
  if (!timezone) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a timezone coming from a query string / user input. Falls back to the
 * business default when the value is missing or not a valid IANA name.
 */
export function resolveTimezone(
  timezone: string | null | undefined,
  fallback: string = DEFAULT_TIMEZONE
): string {
  return isValidTimezone(timezone) ? (timezone as string) : fallback;
}

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getPartsFormatter(timezone: string): Intl.DateTimeFormat {
  let formatter = partsFormatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatterCache.set(timezone, formatter);
  }
  return formatter;
}

/**
 * Break an absolute instant into wall-clock components in the given timezone.
 */
export function getZonedParts(date: Date, timezone: string): ZonedParts {
  const parts = getPartsFormatter(timezone).formatToParts(date);
  const lookup: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      lookup[part.type] = Number(part.value);
    }
  }
  return {
    year: lookup.year,
    month: lookup.month,
    day: lookup.day,
    // Some engines still emit "24" for midnight even with h23; normalise.
    hour: lookup.hour === 24 ? 0 : lookup.hour,
    minute: lookup.minute,
    second: lookup.second,
  };
}

/**
 * Offset (ms) that must be ADDED to a UTC instant to obtain the wall clock in
 * `timezone` at that instant. Europe/Sofia in winter -> +2h, in summer -> +3h.
 */
function getOffsetMs(utcMs: number, timezone: string): number {
  const p = getZonedParts(new Date(utcMs), timezone);
  const asIfUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
    0
  );
  // Drop sub-second part of the source instant before diffing.
  return asIfUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Convert wall-clock components in `timezone` to the absolute instant (UTC).
 * Correct across DST transitions (iterates once to settle the offset).
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timezone: string
): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let offset = getOffsetMs(wall, timezone);
  let utc = wall - offset;
  const settled = getOffsetMs(utc, timezone);
  if (settled !== offset) {
    offset = settled;
    utc = wall - offset;
  }
  return new Date(utc);
}

function parseYmd(
  dateString: string | null | undefined
): { year: number; month: number; day: number } | null {
  if (!dateString || dateString.trim() === "") return null;
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateString.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Reject impossible dates like 2025-02-30
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * Parse a calendar date (YYYY-MM-DD) to the instant when that day STARTS in
 * `timezone`. Returns null if the string is empty or invalid.
 */
export function parseDateStartOfDay(
  dateString: string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE
): Date | null {
  const ymd = parseYmd(dateString);
  if (!ymd) return null;
  return zonedTimeToUtc(ymd.year, ymd.month, ymd.day, 0, 0, 0, 0, timezone);
}

/**
 * Parse a calendar date (YYYY-MM-DD) to the last instant (23:59:59.999) of that
 * day in `timezone`. Returns null if the string is empty or invalid.
 */
export function parseDateEndOfDay(
  dateString: string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE
): Date | null {
  const ymd = parseYmd(dateString);
  if (!ymd) return null;
  return zonedTimeToUtc(
    ymd.year,
    ymd.month,
    ymd.day,
    23,
    59,
    59,
    999,
    timezone
  );
}

/** @deprecated use parseDateStartOfDay(dateString, "UTC") */
export function parseDateStartOfDayUTC(dateString: string | null): Date | null {
  return parseDateStartOfDay(dateString, "UTC");
}

/** @deprecated use parseDateEndOfDay(dateString, "UTC") */
export function parseDateEndOfDayUTC(dateString: string | null): Date | null {
  return parseDateEndOfDay(dateString, "UTC");
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Format an instant in the specified timezone.
 * Returns date as YYYY-MM-DD and time as HH:MM:SS.
 */
export function formatDateInTimezone(
  date: Date,
  timezone: string
): { datePart: string; timePart: string } {
  try {
    const p = getZonedParts(date, timezone);
    return {
      datePart: `${p.year}-${pad2(p.month)}-${pad2(p.day)}`,
      timePart: `${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`,
    };
  } catch {
    // Fallback to UTC if timezone is invalid
    const iso = date.toISOString();
    return {
      datePart: iso.split("T")[0],
      timePart: iso.split("T")[1].split(".")[0],
    };
  }
}

/**
 * Calendar date (YYYY-MM-DD) of an instant in `timezone`.
 */
export function toDateKey(date: Date, timezone: string): string {
  return formatDateInTimezone(date, timezone).datePart;
}

/**
 * Value for an <input type="date"> representing the LOCAL calendar date of the
 * given instant (browser timezone). Never use toISOString() for this: it yields
 * the UTC date, which is "yesterday" for a few hours every night east of UTC.
 */
export function toLocalDateInputValue(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
}

/**
 * Human readable dd.MM.yyyy for a YYYY-MM-DD input value, without any
 * timezone shift (the string is treated as a plain calendar date).
 */
export function formatDateInputBG(value: string | null | undefined): string {
  const ymd = parseYmd(value);
  if (!ymd) return value ?? "";
  return `${pad2(ymd.day)}.${pad2(ymd.month)}.${ymd.year}`;
}

/**
 * Get the user's browser timezone or a default.
 */
export function getUserTimezone(
  defaultTimezone: string = DEFAULT_TIMEZONE
): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || defaultTimezone;
  } catch {
    return defaultTimezone;
  }
}
