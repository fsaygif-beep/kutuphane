export const inventorySyncSql = `INSERT OR IGNORE INTO inventory_entries
  (school_id, session_id, book_id, counted_at, shelf_before, shelf_after, source)
  SELECT s.school_id, s.id, b.id, ?, b.shelf, b.shelf, 'loan'
  FROM inventory_sessions s JOIN books b ON b.school_id = s.school_id
  WHERE s.school_id = ? AND s.status = 'open' AND s.count_date <= ?
    AND s.id = COALESCE(?, (SELECT id FROM inventory_sessions WHERE school_id = s.school_id
      AND status = 'open' AND count_date <= ? ORDER BY count_date DESC, id DESC LIMIT 1))
    AND EXISTS (SELECT 1 FROM loans l WHERE l.book_id = b.id AND l.school_id = s.school_id AND l.returned_at IS NULL)`;

export const protectedBulkArchiveSql = `UPDATE books SET active_inventory = 0
  WHERE school_id = ? AND active_inventory = 1
    AND (? = '' OR category = ?) AND (? = '' OR genre = ?)
    AND (? = '' OR shelf = ?) AND (? = '' OR author = ?)
    AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.school_id = books.school_id AND l.book_id = books.id AND l.returned_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM inventory_entries e WHERE e.school_id = books.school_id AND e.book_id = books.id)`;

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
export function overdueEmail(config: { libraryName: string; senderName: string; senderEmail: string }, group: Array<{ studentName: string; email: string; bookTitle: string; author: string; loanedAt: string; dueAt: string }>) {
  const first = group[0];
  if (!first) throw new Error("E-posta için kayıt seçilmedi.");
  const items = group.map((item) => `<li><strong>${escapeHtml(item.bookTitle)}</strong> — ${escapeHtml(item.author)} (alış: ${escapeHtml(item.loanedAt)}, son teslim: ${escapeHtml(item.dueAt)})</li>`).join("");
  return { from: `${config.senderName.replace(/[\r\n<>]/g, "")} <${config.senderEmail}>`, to: [first.email], subject: `${config.libraryName}: geciken kitap hatırlatması`, html: `<p>Sayın ${escapeHtml(first.studentName)},</p><p>Aşağıdaki kitapların teslim süresi geçmiştir:</p><ul>${items}</ul><p>Kitapları kütüphaneye iade etmenizi rica ederiz.</p><p>${escapeHtml(config.libraryName)}</p>` };
}

export async function deliverOverdueEmail(apiKey: string, payload: ReturnType<typeof overdueEmail>, send: typeof fetch = fetch) {
  try {
    const response = await send("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return { sent: response.ok, detail: response.ok ? "Gönderim servisi kabul etti" : (await response.text()).slice(0, 500) };
  } catch { return { sent: false, detail: "E-posta servisine bağlanılamadı." }; }
}
