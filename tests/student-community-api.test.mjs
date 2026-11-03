import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {build} from 'esbuild';
import {normalizeGrade,validGrade,normalizePhone,privateReviewerName} from '../app/student-rules.ts';
import {matchText,sameDistrict} from '../app/member-matching.ts';

let sqlite,identity;
class Prepared {
  constructor(sql,values=[]){this.sql=sql;this.values=values;}
  bind(...values){return new Prepared(this.sql,values);}
  async all(){return {success:true,results:sqlite.prepare(this.sql).all(...this.values),meta:{}};}
  async first(){return sqlite.prepare(this.sql).get(...this.values)||null;}
  async raw(){const statement=sqlite.prepare(this.sql);statement.setReturnArrays(true);return statement.all(...this.values);}
  async run(){const r=sqlite.prepare(this.sql).run(...this.values);return {success:true,results:[],meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}
}
globalThis.__testEnv={DB:{prepare:sql=>new Prepared(sql),batch:async statements=>{sqlite.exec('BEGIN');try{const result=[];for(const s of statements){const select=/^\s*(SELECT|WITH)/i.test(s.sql);result.push(await (select?s.all():s.run()));}sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};
globalThis.__testIdentity=()=>identity;
const modules={};
for(const name of ['community','library','membership','platform','auth','portal']) {
  const built=await build({entryPoints:[`app/api/${name}/route.ts`],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'test-bindings',setup(b){
    b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));
    b.onResolve({filter:/\/authz$/},()=>({path:'identity',namespace:'mock'}));
    b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='env'?'export const env=globalThis.__testEnv':a.path==='identity'?'export const getAppIdentity=async()=>globalThis.__testIdentity(); export const canManage=u=>["admin","staff"].includes(u?.role)':'export const SUPER_ADMIN_EMAIL="owner@example.test"; export const isCankiriLisesi=()=>false; export const getSchoolAccess=async(id)=>({allowed:true,school:{id,name:"Test"}});',loader:'js'}));
  }}]});
  modules[name]=await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
}
function reset(){
  sqlite?.close();sqlite=new DatabaseSync(':memory:');
  for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(`drizzle/${file}`,'utf8'));
  sqlite.exec(`INSERT INTO schools(id,city,district,name,institution_code,created_at) VALUES(1,'ÇANKIRI','MERKEZ','TEST OKULU','111','2026-01-01'),(2,'ANKARA','ÇANKAYA','DİĞER OKUL','222','2026-01-01');
    INSERT INTO settings(id,school_id,library_name,school_year) VALUES(1,1,'Test','2026'),(2,2,'Other','2026');
    INSERT INTO students(id,school_id,student_no,full_name,grade,created_at) VALUES(1,1,'101','Ayşe Deniz Yılmaz','10A','2026'),(2,1,'102','Ali Kaya','10B','2026'),(3,2,'101','Başka Öğrenci','10A','2026');
    INSERT INTO books(id,school_id,inventory_no,title,author,created_at) VALUES(1,1,'B1','Kitap','Yazar','2026'),(2,1,'B2','Kitap','Yazar','2026'),(3,2,'B1','Başka','Yazar','2026'),(4,1,'B4','Diğer kitap','Yazar','2026');
    INSERT INTO loans(id,school_id,student_id,book_id,loaned_at,due_at,returned_at,school_year) VALUES(1,1,1,1,'2026-01-01','2026-01-15','2026-01-10','2026'),(2,2,3,3,'2026-01-01','2026-01-15',NULL,'2026');`);
  sqlite.prepare("UPDATE schools SET trial_started_at=?,trial_ends_at=?").run(new Date().toISOString(),new Date(Date.now()+86400000*30).toISOString());
  identity={id:10,active:1,schoolId:1,studentId:1,role:'student',permissions:[],email:'student@example.test',displayName:'Öğrenci'};
}
const post=(module,body)=>modules[module].POST(new Request('http://local/api/'+module,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
const get=(module,query='')=>modules[module].GET(new Request('http://local/api/'+module+query));

test('student format, phone normalization and review name privacy',()=>{
  assert.equal(normalizeGrade('10 - a'),'10A');assert.equal(validGrade('10A'),true);assert.equal(validGrade('10 A'),false);
  assert.equal(normalizePhone('+90 (532) 111 22 33'),'5321112233');assert.equal(privateReviewerName('Ayşe Deniz Yılmaz'),'A. Yılmaz');
});

test('case, Turkish letters, central district aliases and every requested class spelling are accepted',async()=>{
  assert.equal(matchText('ÇANKIRI LİSESİ'),matchText('çankırı lisesi'));
  assert.equal(sameDistrict('Çankırı','ÇANKIRI MERKEZ','Merkez'),true);
  assert.equal(sameDistrict('Çankırı','ÇANKIRI MERKEZ','Ilgaz'),false);
  for(const value of ['9a','9A','9/a','9/A','9 a','9 A','9-a','9-A'])assert.equal(normalizeGrade(value),'9A');
  reset();sqlite.exec("UPDATE students SET email='keep@example.test' WHERE id=1");
  const apply={city:'çankırı',district:'Çankırı Merkez',schoolName:'test okulu',fullName:'AYŞE DENİZ YILMAZ',grade:'10/a',studentNo:'101',phone:'05321112233',password:'test-password'};
  for(const key of ['city','district','schoolName','grade','studentNo','phone','password'])assert.equal((await post('membership',{...apply,[key]:''})).status,400);
  assert.equal((await post('membership',apply)).status,200);
  identity.role='admin';assert.equal((await post('library',{action:'approveMembership',id:1})).status,200);
  assert.equal(sqlite.prepare('SELECT email FROM students WHERE id=1').get().email,'keep@example.test');
  assert.equal((await post('auth',{email:apply.phone,password:apply.password})).status,200);
});

test('teacher and employee require only a name; branch persists and editing preserves hidden email',async()=>{
  reset();identity.role='admin';
  for(const memberType of ['teacher','employee']){
    assert.equal((await post('library',{action:'addStudent',memberType,fullName:''})).status,400);
    assert.equal((await post('library',{action:'addStudent',memberType,fullName:memberType,branch:'Matematik'})).status,201);
  }
  assert.equal(sqlite.prepare("SELECT branch FROM students WHERE member_type='teacher'").get().branch,'Matematik');
  sqlite.exec("UPDATE students SET email='preserve@example.test' WHERE id=1");
  assert.equal((await post('library',{action:'updateStudent',id:1,fullName:'Ayşe Deniz Yılmaz',studentNo:'101',grade:'10/a',contact:'05321112233',memberType:'student'})).status,200);
  assert.equal(sqlite.prepare('SELECT email FROM students WHERE id=1').get().email,'preserve@example.test');
});

test('recommendations are school-scoped, admin-managed and reading status remains per student',async()=>{
  reset();assert.equal((await post('portal',{action:'createRecommendation',name:'Yaz'})).status,403);
  identity.role='admin';for(const name of ['Yaz','Kış'])assert.equal((await post('portal',{action:'createRecommendation',name})).status,200);
  assert.equal((await post('portal',{action:'addRecommendationBook',id:1,bookId:1})).status,200);
  assert.equal((await post('portal',{action:'addRecommendationBook',id:1,bookId:3})).status,404);
  identity.role='student';assert.equal((await post('portal',{action:'setReadingStatus',bookId:1,status:'read'})).status,200);
  assert.equal((await (await get('portal')).json()).progress[0].status,'read');
  identity.studentId=2;assert.equal((await (await get('portal')).json()).progress.length,0);
  identity.schoolId=2;assert.equal((await (await get('portal')).json()).lists.length,0);
  assert.equal((await post('portal',{action:'setReadingStatus',bookId:1,status:'read'})).status,404);
});

test('individual and bulk messages are atomic, cannot cross schools and reading receipts cannot be forged',async()=>{
  reset();assert.equal((await post('portal',{action:'sendMessage',subject:'Duyuru',content:'Kitabı getirin',studentIds:[1]})).status,403);
  identity.role='admin';assert.equal((await post('portal',{action:'sendMessage',subject:'Duyuru',content:'Kitabı getirin',studentIds:[1,3]})).status,403);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM member_messages').get().n,0);
  assert.equal((await post('portal',{action:'sendMessage',subject:'Duyuru',content:'Kitabı getirin',studentIds:[1,2,1]})).status,200);
  const sent=(await (await get('portal','?scope=messages')).json()).messages;assert.equal(sent.length,2);
  identity.role='student';identity.studentId=1;const own=(await (await get('portal','?scope=messages')).json()).messages;assert.equal(own.length,1);assert.equal(own[0].read_at,null);
  await post('portal',{action:'markMessageRead',id:sent.find(r=>r.student_id===2).receiptId});
  assert.equal(sqlite.prepare('SELECT read_at FROM member_message_receipts WHERE student_id=2').get().read_at,null);
  await post('portal',{action:'markMessageRead',id:own[0].receiptId});
  identity.role='admin';assert.equal((await (await get('portal','?scope=messages')).json()).messages.filter(m=>m.read_at).length,1);
  identity.schoolId=2;assert.equal((await (await get('portal','?scope=messages')).json()).messages.length,0);
});

test('my reviews contains only this student comments including pending ones',async()=>{
  reset();await post('community',{action:'addReview',bookId:1,content:'Bana ait yorum'});
  assert.equal((await (await get('community','?scope=myReviews')).json()).reviews[0].bookTitle,'Kitap');
  identity.studentId=2;assert.equal((await (await get('community','?scope=myReviews')).json()).reviews.length,0);
});

test('shelf-only save does not count a book or change a loan, and rejects foreign books',async()=>{
  reset();identity.role='admin';const before=sqlite.prepare('SELECT * FROM loans').all();
  assert.equal((await post('library',{action:'saveBookShelf',bookId:1,shelf:'B7'})).status,200);
  assert.equal(sqlite.prepare('SELECT shelf FROM books WHERE id=1').get().shelf,'B7');
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM inventory_entries').get().n,0);
  assert.deepEqual(sqlite.prepare('SELECT * FROM loans').all(),before);
  assert.equal((await post('library',{action:'saveBookShelf',bookId:3,shelf:'B7'})).status,404);
});

test('membership reset revokes login only, permits new approval, and preserves all circulation data',async()=>{
  reset();const apply={city:'ÇANKIRI',district:'Merkez',schoolName:'test okulu',fullName:'Ayşe Deniz Yılmaz',grade:'10A',studentNo:'101',phone:'05321112233',password:'test-password'};
  await post('membership',apply);identity.role='admin';await post('library',{action:'approveMembership',id:1});
  const account=sqlite.prepare('SELECT id FROM app_users WHERE student_id=1').get(),before=sqlite.prepare('SELECT * FROM loans').all();
  assert.equal((await post('library',{action:'resetMembership',id:account.id})).status,200);
  assert.equal(sqlite.prepare('SELECT active FROM app_users WHERE id=?').get(account.id).active,0);
  assert.equal((await post('membership',apply)).status,200);
  assert.equal((await post('library',{action:'approveMembership',id:1})).status,200);
  assert.equal((await post('auth',{email:apply.phone,password:apply.password})).status,200);
  assert.deepEqual(sqlite.prepare('SELECT * FROM loans').all(),before);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM students').get().n,3);
});

test('admin edits phone-only accounts by stable id, preserves records and cannot use a foreign member',async()=>{
  reset();identity.role='admin';
  const body={action:'upsertUser',username:'ayse',displayName:'Ayşe Yılmaz',role:'student',studentId:1,phone:'05321112233',password:'test-password'};
  assert.equal((await post('library',{...body,studentId:3})).status,403);
  assert.equal((await post('library',body)).status,200);
  const id=sqlite.prepare('SELECT id FROM app_users WHERE username=?').get('ayse').id;
  assert.equal((await post('library',{...body,id,phone:'05321112244',password:''})).status,200);
  assert.equal(sqlite.prepare('SELECT contact FROM students WHERE id=1').get().contact,'5321112244');
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM app_users').get().n,1);
  assert.equal((await post('auth',{email:'05321112244',password:'test-password',switchUser:true})).status,200);
  identity.schoolId=2;
  assert.equal((await post('auth',{email:'05321112244',password:'test-password',switchUser:true})).status,403);
});
test('reviews require a completed loan, stay private until admin approval and match copies',async()=>{
  reset();assert.equal((await post('community',{action:'addReview',bookId:4,content:'x'})).status,403);
  assert.equal((await post('community',{action:'addReview',bookId:3,content:'x'})).status,403);
  assert.equal((await post('community',{action:'addReview',bookId:2,content:'Güzel bir kitap.'})).status,200);
  identity.studentId=2;assert.equal((await (await get('community','?scope=reviews&bookId=1')).json()).reviews.length,0);
  assert.equal((await post('community',{action:'moderateReview',id:1,status:'approved'})).status,403);
  identity.role='admin';assert.equal((await post('community',{action:'moderateReview',id:1,status:'approved'})).status,200);
  identity.role='student';const rows=(await (await get('community','?scope=reviews&bookId=1')).json()).reviews;assert.equal(rows.length,1);assert.equal(rows[0].name,'A. Yılmaz');assert.equal('studentId' in rows[0],false);
  identity.schoolId=2;assert.equal((await (await get('community','?scope=reviews')).json()).reviews.length,0);
});
test('approved comments appear on other copies with normalized matching title and author',async()=>{
  reset();sqlite.exec("UPDATE books SET title='  KİTAP  ',author='  Yazar  ' WHERE id=2; UPDATE books SET title='Kitap',author='Başka Yazar' WHERE id=4");
  assert.equal((await post('community',{action:'addReview',bookId:2,content:'Diğer nüshada da görülsün.'})).status,200);
  identity.role='admin';await post('community',{action:'moderateReview',id:1,status:'approved'});
  identity.role='student';identity.studentId=2;
  for(const id of [1,2])assert.equal((await (await get('community',`?scope=reviews&bookId=${id}`)).json()).reviews.length,1);
  assert.equal((await (await get('community','?scope=reviews&bookId=4')).json()).reviews.length,0);
  assert.equal((await get('community','?scope=reviews&bookId=3')).status,404);
});
test('complaints accept page references and general issues, isolate pupils and schools',async()=>{
  reset();assert.equal((await post('community',{action:'addComplaint',bookId:1,category:'Şiddet içeriyor',page:'42–45',content:'İçeriğin incelenmesini istiyorum.'})).status,200);
  assert.equal((await post('community',{action:'addComplaint',category:'Diğer',content:'Kütüphanenin açılış saati.'})).status,200);
  assert.equal((await post('community',{action:'addComplaint',bookId:3,category:'Diğer',content:'x'})).status,404);
  identity.studentId=2;assert.equal((await (await get('community','?scope=complaints')).json()).complaints.length,0);
  identity.role='admin';const c=(await (await get('community','?scope=complaints')).json()).complaints;assert.equal(c.length,2);assert.equal(c[1].page,'42–45');
  identity.schoolId=2;assert.equal((await (await get('community','?scope=complaints')).json()).complaints.length,0);
});
test('multiple reading lists stay private; cross-owner and foreign-school additions fail',async()=>{
  reset();for(const name of ['Yaz','Kış'])assert.equal((await post('community',{action:'createList',name})).status,200);
  assert.equal((await post('community',{action:'addListBook',id:1,bookId:1})).status,200);
  assert.equal((await post('community',{action:'addListBook',id:1,bookId:3})).status,404);
  identity.studentId=2;assert.equal((await post('community',{action:'addListBook',id:1,bookId:1})).status,404);
  assert.equal((await (await get('community','?scope=lists')).json()).lists.length,0);
  identity.studentId=1;assert.equal((await (await get('community','?scope=lists')).json()).lists.length,2);
});
test('membership approval copies phone while preserving stored email; phone login works; teacher needs no student number or grade',async()=>{
  reset();const apply={institutionCode:'111',city:'ÇANKIRI',district:'MERKEZ',schoolName:'TEST OKULU',fullName:'Ayşe Deniz Yılmaz',grade:'10 A',studentNo:'101',email:'ayse@example.test',phone:'05321112233',password:'test-password'};
  assert.equal((await post('membership',apply)).status,200);
  assert.equal(sqlite.prepare('SELECT contact FROM students WHERE id=1').get().contact,'');
  identity.role='admin';assert.equal((await post('library',{action:'approveMembership',id:1})).status,200);
  assert.deepEqual({...sqlite.prepare('SELECT contact,email FROM students WHERE id=1').get()},{contact:'5321112233',email:''});
  assert.equal((await post('auth',{email:'+90 532 111 22 33',password:'test-password'})).status,200);
  assert.equal((await post('library',{action:'addStudent',memberType:'teacher',fullName:'Öğretmen Test',contact:'05320000000',email:'teacher@example.test'})).status,201);
  assert.equal(sqlite.prepare("SELECT grade FROM students WHERE member_type='teacher'").get().grade,'');
});
test('lend, return and count delta patches preserve prior records and isolate a second school',async()=>{
  reset();identity.role='admin';const before=sqlite.prepare('SELECT * FROM loans WHERE id=2').get();
  sqlite.exec("INSERT INTO inventory_sessions(id,school_id,count_no,count_date,status,created_at,updated_at) VALUES(1,1,'1','2026-01-01','open','2026','2026')");
  let r=await post('library',{action:'loan',studentId:1,bookId:4});assert.equal(r.status,200);let patch=(await r.json()).patch;assert.equal(patch.loans.length,1);assert.equal(patch.inventoryEntries[0].source,'loan');
  const loanId=patch.loans[0].id;r=await post('library',{action:'return',loanId});assert.ok((await r.json()).patch.loans[0].returnedAt);
  r=await post('library',{action:'countInventoryBook',sessionId:1,bookId:2,shelf:'A2'});assert.equal(r.status,200);patch=(await r.json()).patch;assert.equal(patch.books[0].shelf,'A2');
  assert.equal((await post('library',{action:'countInventoryBook',sessionId:1,bookId:2})).status,409);
  assert.equal((await post('library',{action:'loan',studentId:3,bookId:3})).status,404);
  assert.deepEqual(sqlite.prepare('SELECT * FROM loans WHERE id=2').get(),before);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM books').get().n,4);
});
test('second-school application, approval, login and empty isolated catalogue',async()=>{
  reset();const app={action:'apply',city:'İZMİR',district:'KONAK',schoolName:'ÜÇÜNCÜ OKUL',institutionCode:'333',adminName:'Test Yönetici',adminEmail:'admin3@example.test',password:'test-password'};
  assert.equal((await post('platform',app)).status,200);
  identity.role='admin';identity.email='fsaygif@gmail.com';assert.equal((await post('platform',{action:'approve',id:1})).status,200);
  assert.equal((await post('auth',{email:app.adminEmail,password:app.password})).status,200);
  identity.schoolId=3;identity.email=app.adminEmail;
  const state=await (await get('library')).json();assert.equal(state.books.length,0);assert.equal(state.students.length,0);assert.equal(state.loans.length,0);assert.equal(state.settings.schoolName,app.schoolName);
});
test('request review moves it out of active status; only its school admin can delete',async()=>{
  reset();assert.equal((await post('library',{action:'addBookRequest',title:'İstenen kitap'})).status,201);
  assert.equal((await post('library',{action:'deleteBookRequest',id:1})).status,403);
  identity.role='admin';assert.equal((await post('library',{action:'updateBookRequest',id:1,status:'approved'})).status,200);
  assert.equal(sqlite.prepare('SELECT status FROM book_requests WHERE id=1').get().status,'approved');
  identity.schoolId=2;await post('library',{action:'deleteBookRequest',id:1});assert.equal(sqlite.prepare('SELECT count(*) AS n FROM book_requests').get().n,1);
  identity.schoolId=1;await post('library',{action:'deleteBookRequest',id:1});assert.equal(sqlite.prepare('SELECT count(*) AS n FROM book_requests').get().n,0);
});
test('a 5000-book inventory count returns a small confirmed patch, not another full catalogue',async()=>{
  reset();identity.role='admin';
  sqlite.exec('BEGIN');const insert=sqlite.prepare("INSERT INTO books(school_id,inventory_no,title,author,created_at) VALUES(1,?,?,?,'2026')");
  for(let n=0;n<5000;n++)insert.run(`PERF-${n}`,`Performans Kitabı ${n}`,'Örnek Yazar');sqlite.exec('COMMIT');
  sqlite.exec("INSERT INTO inventory_sessions(id,school_id,count_no,count_date,status,created_at,updated_at) VALUES(1,1,'1','2026-01-01','open','2026','2026')");
  const full=await (await get('library')).text();const count=await post('library',{action:'countInventoryBook',sessionId:1,bookId:2});const delta=await count.text();
  assert.equal(count.status,200);assert.ok(Buffer.byteLength(full)>Buffer.byteLength(delta)*100);assert.equal(JSON.parse(delta).patch.inventoryEntries.length,1);
  console.log(`5000 kitap testi: tam yükleme ${Buffer.byteLength(full)} bayt; sayım yanıtı ${Buffer.byteLength(delta)} bayt.`);
});
