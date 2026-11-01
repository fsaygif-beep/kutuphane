const normalize = (value: string) => value.trim().toLocaleUpperCase("tr");

// A shared ISBN may identify several physical copies. Never silently choose one.
export function matchingRecords<T>(rows: T[], query: string, values: (row: T) => string[]): T[] {
  const target = normalize(query);
  if (!target) return [];
  return rows.filter((row) => values(row).some((value) => normalize(value) === target));
}

export function memberActiveLoans<T extends { studentId: number; returnedAt: string | null }>(rows: T[], studentId: number): T[] {
  return rows.filter((row) => row.studentId === studentId && !row.returnedAt);
}
