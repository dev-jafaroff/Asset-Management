// Console output shared by the read-only reports (snipeit:inspect,
// intune:inspect).

export function heading(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 70 - title.length))}`);
}

export function warnInvalid(what: string, invalid: number) {
  if (invalid > 0) console.log(`  ! ${invalid} ${what} did not parse`);
}

// Counts per key, largest first: [["Laptops", 120], …]
export function countBy<T>(
  items: T[],
  key: (item: T) => string,
): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = key(item);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]);
}

// Labels in one column, counts after them.
export function printCounts(rows: [string, number][], indent = "  ") {
  const width = Math.max(0, ...rows.map(([label]) => label.length));
  for (const [label, count] of rows) {
    console.log(`${indent}${label.padEnd(width)}  ${count}`);
  }
}
