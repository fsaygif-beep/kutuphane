import {env} from 'cloudflare:workers';
import {getAppIdentity} from '../../authz';
import {getSchoolAccess} from '../../subscription';

export async function GET(request:Request) {
  const user=await getAppIdentity(request);
  if(!user?.schoolId)return Response.json({error:'Oturum bulunamadı.'},{status:401});
  if(!(await getSchoolAccess(user.schoolId))?.allowed)return Response.json({error:'Okul erişimi kapalı.'},{status:403});
  const school=user.schoolId,admin=user.role==='admin',student=user.role==='student'?user.studentId:null;
  if(!admin&&!student)return Response.json({error:'Yetkisiz.'},{status:403});
  if(new URL(request.url).searchParams.get('scope')==='messages') {
    const messages=await env.DB.prepare(`SELECT m.id,m.subject,m.content,m.created_at,r.id AS receiptId,r.read_at,r.student_id,s.full_name,s.grade,s.student_no
      FROM member_messages m JOIN member_message_receipts r ON r.message_id=m.id AND r.school_id=m.school_id
      JOIN students s ON s.id=r.student_id AND s.school_id=m.school_id WHERE m.school_id=? AND (?=1 OR r.student_id=?) ORDER BY m.id DESC,r.id`).bind(school,admin?1:0,student).all();
    return Response.json({messages:messages.results});
  }
  const result=await env.DB.batch([
    env.DB.prepare('SELECT id,name FROM recommendation_lists WHERE school_id=? ORDER BY id DESC').bind(school),
    env.DB.prepare('SELECT i.id,i.list_id,i.book_id FROM recommendation_items i JOIN recommendation_lists l ON l.id=i.list_id AND l.school_id=i.school_id WHERE i.school_id=?').bind(school),
    env.DB.prepare('SELECT book_id,status FROM recommendation_progress WHERE school_id=? AND student_id=?').bind(school,student),
  ]);
  return Response.json({lists:result[0].results,items:result[1].results,progress:result[2].results});
}

export async function POST(request:Request) {
 try {
  const user=await getAppIdentity(request);
  if(!user?.schoolId)return Response.json({error:'Oturum bulunamadı.'},{status:401});
  if(!(await getSchoolAccess(user.schoolId))?.allowed)return Response.json({error:'Okul erişimi kapalı.'},{status:403});
  const body=await request.json() as Record<string,unknown>,school=user.schoolId,admin=user.role==='admin',student=user.role==='student'?user.studentId:null;
  const fail=(error:string,status=400)=>Response.json({error},{status}),action=String(body.action),id=Number(body.id),book=Number(body.bookId),now=new Date().toISOString();
  if(action==='markMessageRead') {
    if(!student)return fail('Öğrenci hesabı gereklidir.',403);
    await env.DB.prepare('UPDATE member_message_receipts SET read_at=COALESCE(read_at,?) WHERE school_id=? AND student_id=? AND id=?').bind(now,school,student,id).run();
  } else if(action==='setReadingStatus') {
    if(!student)return fail('Öğrenci hesabı gereklidir.',403);
    const status=String(body.status);if(!['read','planned',''].includes(status))return fail('Geçersiz durum.');
    if(!await env.DB.prepare('SELECT i.id FROM recommendation_items i JOIN recommendation_lists l ON l.id=i.list_id AND l.school_id=i.school_id WHERE i.school_id=? AND i.book_id=? LIMIT 1').bind(school,book).first())return fail('Tavsiye edilen kitap bulunamadı.',404);
    await env.DB.prepare('INSERT INTO recommendation_progress(school_id,student_id,book_id,status) VALUES(?,?,?,?) ON CONFLICT(school_id,student_id,book_id) DO UPDATE SET status=excluded.status').bind(school,student,book,status).run();
  } else {
    if(!admin)return fail('Yönetici yetkisi gereklidir.',403);
    if(action==='sendMessage') {
      const subject=String(body.subject??'').trim(),content=String(body.content??'').trim();
      if(!subject||subject.length>150||!content||content.length>4000)return fail('Başlık ve mesaj girin (en fazla 150 / 4000 karakter).');
      const ids=Array.isArray(body.studentIds)?[...new Set(body.studentIds.map(Number))].filter(n=>Number.isSafeInteger(n)&&n>0):[];
      if(!ids.length||ids.length>10000)return fail('En az bir öğrenci seçin.');
      const members=await env.DB.prepare("SELECT id FROM students WHERE school_id=? AND active_member=1 AND member_type='student'").bind(school).all<{id:number}>();
      if(ids.some(id=>!members.results.some(m=>m.id===id)))return fail('Alıcı bu okula ait etkin öğrenci değil.',403);
      // Token identifies this send inside one atomic batch; receipts can never attach to another concurrent message.
      const created=now+'#'+crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare('INSERT INTO member_messages(school_id,sender_id,subject,content,created_at) VALUES(?,?,?,?,?)').bind(school,user.id,subject,content,created),
        env.DB.prepare(`INSERT INTO member_message_receipts(school_id,message_id,student_id) SELECT ?,m.id,CAST(j.value AS INTEGER) FROM member_messages m,json_each(?) j WHERE m.school_id=? AND m.created_at=? AND m.sender_id=?`).bind(school,JSON.stringify(ids),school,created,user.id),
      ]);
    } else if(action==='createRecommendation') {
      const name=String(body.name??'').trim();if(!name||name.length>100)return fail('Liste adı 1–100 karakter olmalıdır.');
      await env.DB.prepare('INSERT INTO recommendation_lists(school_id,name,created_at) VALUES(?,?,?)').bind(school,name,now).run();
    } else {
      if(!await env.DB.prepare('SELECT id FROM recommendation_lists WHERE school_id=? AND id=?').bind(school,id).first())return fail('Liste bulunamadı.',404);
      if(action==='renameRecommendation') {
        const name=String(body.name??'').trim();if(!name||name.length>100)return fail('Liste adı girin.');
        await env.DB.prepare('UPDATE recommendation_lists SET name=? WHERE school_id=? AND id=?').bind(name,school,id).run();
      }else if(action==='addRecommendationBook') {
        if(!await env.DB.prepare('SELECT id FROM books WHERE school_id=? AND id=? AND active_inventory=1').bind(school,book).first())return fail('Kitap bulunamadı.',404);
        await env.DB.prepare('INSERT OR IGNORE INTO recommendation_items(school_id,list_id,book_id) VALUES(?,?,?)').bind(school,id,book).run();
      }else if(action==='removeRecommendationBook')await env.DB.prepare('DELETE FROM recommendation_items WHERE school_id=? AND list_id=? AND book_id=?').bind(school,id,book).run();
      else return fail('Geçersiz işlem.');
    }
  }
  return Response.json({ok:true});
 }catch(error){console.error('portal error',error);return Response.json({error:'İşlem tamamlanamadı.'},{status:500});}
}
