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

// getInitials("Aysel Huseynova") → "AH"
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}
