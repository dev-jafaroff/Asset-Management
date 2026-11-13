export { cn } from "cn";

// Dates are shown in the office time zone, whatever zone the server runs in.
const APP_LOCALE = "en-GB";
const APP_TIME_ZONE = "Asia/Baku";

const dateFormat = new Intl.DateTimeFormat(APP_LOCALE, {
  dateStyle: "medium",
  timeZone: APP_TIME_ZONE,
});

const dateTimeFormat = new Intl.DateTimeFormat(APP_LOCALE, {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: APP_TIME_ZONE,
});

// formatDate(date) → "14 Mar 2025"
export function formatDate(date: Date): string {
  return dateFormat.format(date);
}

// formatDateTime(date) → "2 Nov 2026, 09:14"
export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}

const relativeTimeFormat = new Intl.RelativeTimeFormat(APP_LOCALE, {
  numeric: "auto",
});

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Largest unit first; a unit is used once the gap reaches its size.
const relativeTimeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * DAY],
  ["month", 30 * DAY],
  ["day", DAY],
  ["hour", HOUR],
  ["minute", MINUTE],
];

// formatRelativeTime(date) → "2 hours ago", "yesterday", "in 3 days"
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diff = date.getTime() - now.getTime();
  for (const [unit, size] of relativeTimeUnits) {
    if (Math.abs(diff) >= size) {
      return relativeTimeFormat.format(Math.trunc(diff / size), unit);
    }
  }
  return "just now";
}

// Whole days between two dates, e.g. to see how long ago something happened.
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY);
}

// formatCount(3, "asset") → "3 assets", formatCount(1, "asset") → "1 asset"
export function formatCount(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

// formatAge(purchaseDate) →"3 years 7 months", "5 months", "under a month"
export function formatAge(since: Date, now: Date = new Date()): string {
  const months =
    (now.getFullYear() - since.getFullYear()) * 12 +
    (now.getMonth() - since.getMonth()) -
    (now.getDate() < since.getDate() ? 1 : 0);
  if (months < 1) return "under a month";

  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [
    years > 0 && formatCount(years, "year"),
    rest > 0 && formatCount(rest, "month"),
  ]
    .filter(Boolean)
    .join(" ");
}

// getInitials("Aysel Huseynova") → "AH"
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}
