import { env } from "cloudflare:workers";
// Return only confirmed changes; never optimistically invent persisted IDs.
export async function circulationDelta(schoolId:number, since:string, loanId=0, bookId=0) {
  const results=await env.DB.batch([
    env.DB.prepare(`SELECT l.id,l.student_id AS studentId,s.student_no AS studentNo,s.full_name AS studentName,s.grade,
      s.contact,s.email,s.photo_key AS studentPhotoKey,l.book_id AS bookId,b.inventory_no AS inventoryNo,b.title AS bookTitle,
      b.author,b.cover_key AS bookCoverKey,l.loaned_at AS loanedAt,l.due_at AS dueAt,l.returned_at AS returnedAt,
      l.school_year AS schoolYear,l.renewal_count AS renewalCount,l.same_day_required AS sameDayRequired
      FROM loans l JOIN students s ON s.id=l.student_id AND s.school_id=l.school_id
      JOIN books b ON b.id=l.book_id AND b.school_id=l.school_id
      WHERE l.school_id=? AND (l.id=? OR (l.book_id=? AND l.returned_at IS NULL))`).bind(schoolId,loanId,bookId),
    env.DB.prepare(`SELECT id,session_id AS sessionId,book_id AS bookId,counted_at AS countedAt,shelf_before AS shelfBefore,shelf_after AS shelfAfter,source
      FROM inventory_entries WHERE school_id=? AND counted_at>=?`).bind(schoolId,since),
    env.DB.prepare(`SELECT id,count_no AS countNo,count_date AS countDate,status,created_at AS createdAt,updated_at AS updatedAt
      FROM inventory_sessions WHERE school_id=? AND updated_at>=?`).bind(schoolId,since),
    env.DB.prepare(`SELECT id,shelf,lost,lost_at AS lostAt FROM books WHERE school_id=? AND id=?`).bind(schoolId,bookId),
  ]);
  return Response.json({ok:true,patch:{loans:results[0].results,inventoryEntries:results[1].results,inventorySessions:results[2].results,books:results[3].results}});
}
