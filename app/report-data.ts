type ReadLoan = { id: number; studentId: number; studentName: string; grade: string; bookTitle: string; author: string; loanedAt: string; returnedAt: string | null; sameDayRequired: number };
export function reportData<T extends ReadLoan>(loans: T[], start: string, end: string) {
  const completed = loans.filter((loan) => {
    if (!loan.returnedAt || loan.returnedAt < start || loan.returnedAt > end) return false;
    const next = new Date(`${loan.loanedAt}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return !(loan.sameDayRequired && loan.returnedAt <= next.toISOString().slice(0, 10));
  });
  const readers = new Map<number, { id: number; name: string; grade: string; count: number }>();
  const titles = new Map<string, { key: string; title: string; author: string; count: number }>();
  for (const loan of completed) {
    const reader = readers.get(loan.studentId) ?? { id: loan.studentId, name: loan.studentName, grade: loan.grade, count: 0 };
    reader.count++; readers.set(loan.studentId, reader);
    const key = JSON.stringify([loan.bookTitle, loan.author]);
    const title = titles.get(key) ?? { key, title: loan.bookTitle, author: loan.author, count: 0 };
    title.count++; titles.set(key, title);
  }
  return { completed, readers: [...readers.values()].sort((a,b) => b.count-a.count), titles: [...titles.values()].sort((a,b) => b.count-a.count) };
}
