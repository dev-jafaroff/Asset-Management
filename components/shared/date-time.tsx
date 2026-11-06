import { formatDateTime, formatRelativeTime } from "@/lib/utils";

type DateTimeProps = {
  date: Date;
  className?: string;
};

// "2 hours ago", with the exact date and time on hover.
// Rendered on the server per request, so the text matches the moment the
// page was loaded.
export function DateTime({ date, className }: DateTimeProps) {
  return (
    <time
      dateTime={date.toISOString()}
      title={formatDateTime(date)}
      className={className}
    >
      {formatRelativeTime(date)}
    </time>
  );
}
