import { env } from "cloudflare:workers";
import { getAppIdentity } from "../../authz";
import { getSchoolAccess } from "../../subscription";
import { complaintCategories, privateReviewerName } from "../../student-rules";

export async function GET(request: Request) {
  const user=await getAppIdentity(request);
  if(!user?.schoolId) return Response.json({error:"Oturum bulunamadı."},{status:401});
  if(!(await getSchoolAccess(user.schoolId))?.allowed) return Response.json({error:"Okul erişimi kapalı."},{status:403});
  const school=user.schoolId, own=user.role==="student", admin=user.role==="admin";
  const params=new URL(request.url).searchParams, scope=params.get("scope"), book=Number(params.get("bookId"));
  if(scope==="reviews") {
    const reviews=await env.DB.prepare(`SELECT r.id,r.book_id AS bookId,r.content,r.status,r.created_at AS createdAt,s.full_name AS name,
      r.student_id AS studentId FROM book_reviews r JOIN students s ON s.id=r.student_id AND s.school_id=r.school_id
      JOIN books b ON b.id=r.book_id AND b.school_id=r.school_id WHERE r.school_id=?
      AND (?=0 OR (b.title,b.author) IN (SELECT title,author FROM books WHERE id=? AND school_id=?))
      AND (r.status='approved' OR ?=1 OR r.student_id=?) ORDER BY r.id DESC`).bind(school,book,book,school,admin?1:0,own?user.studentId:0).all();
    return Response.json({reviews:reviews.results.map((r:any)=>({id:r.id,bookId:r.bookId,content:r.content,status:r.status,createdAt:r.createdAt,name:privateReviewerName(r.name),own:own&&r.studentId===user.studentId}))});
  }
  if(scope==="complaints") {
    if(!own&&!admin&&!(user.role==="staff"&&user.permissions.includes("requests")))return Response.json({error:"Yetkisiz."},{status:403});
    const rows=await env.DB.prepare(`SELECT c.*,s.full_name AS studentName,b.title AS bookTitle FROM complaints c
      JOIN students s ON s.id=c.student_id AND s.school_id=c.school_id LEFT JOIN books b ON b.id=c.book_id AND b.school_id=c.school_id
      WHERE c.school_id=? AND (?=0 OR c.student_id=?) ORDER BY c.id DESC`).bind(school,own?1:0,user.studentId??0).all();
    return Response.json({complaints:rows.results});
  }
  if(!own||!user.studentId)return Response.json({lists:[],items:[]});
  const results=await env.DB.batch([
    env.DB.prepare("SELECT * FROM reading_lists WHERE school_id=? AND student_id=? ORDER BY id DESC").bind(school,user.studentId),
    env.DB.prepare(`SELECT i.* FROM reading_list_items i JOIN reading_lists l ON l.id=i.list_id AND l.school_id=i.school_id
      WHERE l.school_id=? AND l.student_id=?`).bind(school,user.studentId),
  ]);
  return Response.json({lists:results[0].results,items:results[1].results});
}

export async function POST(request: Request) {
  try {
    const user=await getAppIdentity(request);
    if(!user?.schoolId)return Response.json({error:"Oturum bulunamadı."},{status:401});
    if(!(await getSchoolAccess(user.schoolId))?.allowed)return Response.json({error:"Okul erişimi kapalı."},{status:403});
    const body=await request.json() as Record<string,unknown>, action=String(body.action), school=user.schoolId;
    const student=user.role==="student"?user.studentId:null, admin=user.role==="admin", now=new Date().toISOString();
    const id=Number(body.id), book=Number(body.bookId), content=String(body.content??"").trim();
    const fail=(error:string,status=400)=>Response.json({error},{status});
    if(action==="moderateReview") {
      if(!admin)return fail("Yalnızca yönetici yorum yayımlayabilir.",403);
      if(!["approved","rejected","pending"].includes(String(body.status)))return fail("Geçersiz durum.");
      await env.DB.prepare("UPDATE book_reviews SET status=?,reviewed_at=? WHERE school_id=? AND id=?").bind(body.status,now,school,id).run();
    } else if(action==="addReview") {
      if(!student)return fail("Yorumlar öğrenci hesabından gönderilir.",403);
      if(!content||content.length>2000)return fail("Yorum 1–2000 karakter olmalıdır.");
      const read=await env.DB.prepare(`SELECT l.id FROM loans l JOIN books b ON b.id=l.book_id AND b.school_id=l.school_id
        WHERE l.school_id=? AND l.student_id=? AND l.returned_at IS NOT NULL
        AND (b.title,b.author) IN (SELECT title,author FROM books WHERE school_id=? AND id=?) LIMIT 1`).bind(school,student,school,book).first();
      if(!read)return fail("Yalnızca okuyup iade ettiğiniz kitaplara yorum yapabilirsiniz.",403);
      await env.DB.prepare("INSERT INTO book_reviews(school_id,student_id,book_id,content,status,created_at) VALUES(?,?,?,?,'pending',?)").bind(school,student,book,content,now).run();
    } else if(action==="addComplaint") {
      if(!student)return fail("Öğrenci hesabı gereklidir.",403);
      const category=String(body.category), page=String(body.page??"").trim();
      if(!complaintCategories.includes(category)||!content||content.length>3000||page.length>60)return fail("Şikâyet türünü ve açıklamayı kontrol edin.");
      if(book&&!await env.DB.prepare("SELECT id FROM books WHERE school_id=? AND id=?").bind(school,book).first())return fail("Kitap bulunamadı.",404);
      await env.DB.prepare("INSERT INTO complaints(school_id,student_id,book_id,category,page,content,created_at) VALUES(?,?,?,?,?,?,?)").bind(school,student,book||null,category,page,content,now).run();
    } else if(action==="reviewComplaint") {
      if(!admin&&!(user.role==="staff"&&user.permissions.includes("requests")))return fail("Yetkisiz.",403);
      if(!["new","reviewed","resolved"].includes(String(body.status)))return fail("Geçersiz durum.");
      await env.DB.prepare("UPDATE complaints SET status=? WHERE school_id=? AND id=?").bind(body.status,school,id).run();
    } else {
      if(!student)return fail("Öğrenci hesabı gereklidir.",403);
      if(action==="createList") {
        const name=String(body.name??"").trim(); if(!name||name.length>100)return fail("Liste adı 1–100 karakter olmalıdır.");
        await env.DB.prepare("INSERT INTO reading_lists(school_id,student_id,name,created_at) VALUES(?,?,?,?)").bind(school,student,name,now).run();
      } else {
        const list=await env.DB.prepare("SELECT id FROM reading_lists WHERE id=? AND school_id=? AND student_id=?").bind(id,school,student).first();
        if(!list)return fail("Liste bulunamadı.",404);
        if(action==="deleteList")await env.DB.batch([
          env.DB.prepare("DELETE FROM reading_list_items WHERE list_id=? AND school_id=?").bind(id,school),
          env.DB.prepare("DELETE FROM reading_lists WHERE id=? AND school_id=? AND student_id=?").bind(id,school,student),
        ]);
        else if(action==="addListBook") {
          if(!await env.DB.prepare("SELECT id FROM books WHERE id=? AND school_id=? AND active_inventory=1").bind(book,school).first())return fail("Kitap bulunamadı.",404);
          await env.DB.prepare("INSERT OR IGNORE INTO reading_list_items(school_id,list_id,book_id,created_at) VALUES(?,?,?,?)").bind(school,id,book,now).run();
        } else if(action==="removeListBook")await env.DB.prepare("DELETE FROM reading_list_items WHERE school_id=? AND list_id=? AND book_id=?").bind(school,id,book).run();
        else return fail("Geçersiz işlem.");
      }
    }
    return Response.json({ok:true});
  } catch(error) { console.error("community error",error); return Response.json({error:"İşlem tamamlanamadı."},{status:500}); }
}
