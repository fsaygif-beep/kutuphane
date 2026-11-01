import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { inventorySyncSql, protectedBulkArchiveSql, overdueEmail, deliverOverdueEmail } from "../app/library-operations.ts";
import { matchingRecords, memberActiveLoans } from "../app/circulation-selection.ts";

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE books(id INTEGER PRIMARY KEY,school_id INTEGER,active_inventory INTEGER DEFAULT 1,category TEXT DEFAULT 'Roman',genre TEXT DEFAULT '',shelf TEXT DEFAULT 'A',author TEXT DEFAULT 'Yazar');
    CREATE TABLE students(id INTEGER PRIMARY KEY,full_name TEXT);
    CREATE TABLE loans(id INTEGER PRIMARY KEY,school_id INTEGER,book_id INTEGER,student_id INTEGER,returned_at TEXT);
    CREATE TABLE inventory_sessions(id INTEGER PRIMARY KEY,school_id INTEGER,status TEXT,count_date TEXT);
    CREATE TABLE inventory_entries(id INTEGER PRIMARY KEY,school_id INTEGER,session_id INTEGER,book_id INTEGER,counted_at TEXT,shelf_before TEXT,shelf_after TEXT,UNIQUE(session_id,book_id));
    INSERT INTO books(id,school_id) VALUES(1,1),(2,1),(3,1),(4,2),(5,1);
    INSERT INTO students VALUES(1,'Üye');
    INSERT INTO loans VALUES(1,1,1,1,NULL),(2,1,2,1,NULL),(3,2,4,1,NULL),(4,1,5,1,'2026-10-01');
    INSERT INTO inventory_sessions VALUES(1,1,'open','2026-09-03'),(2,2,'open','2026-09-03'),(3,1,'closed','2026-09-04');
    INSERT INTO inventory_entries VALUES(1,1,1,1,'2026-09-03','A','B');`);
  return db;
}
const rows = (db, table) => db.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
test("additive migration preserves all existing book, member, loan and count values", () => {
  const db=fixture(); const before=Object.fromEntries(['books','students','loans','inventory_entries'].map(t=>[t,rows(db,t)]));
  db.exec(readFileSync(new URL('../drizzle/0018_sour_krista_starr.sql',import.meta.url),'utf8'));
  for(const table of ['books','students','loans']) assert.deepEqual(rows(db,table),before[table]);
  const after=rows(db,'inventory_entries'); assert.equal(after[0].source,'manual'); delete after[0].source;
  assert.deepEqual(after,before.inventory_entries);
});
test("automatic count adds only missing active loans and preserves manual count; rerun is idempotent", () => {
  const db=fixture(); db.exec("ALTER TABLE inventory_entries ADD source TEXT NOT NULL DEFAULT 'manual'");
  const before=rows(db,'inventory_entries')[0]; const loansBefore=rows(db,'loans');
  const sync=db.prepare(inventorySyncSql);
  assert.equal(sync.run('2026-11-02',1,'2026-11-02',null,'2026-11-02').changes,1);
  assert.equal(sync.run('2026-11-02',1,'2026-11-02',1,'2026-11-02').changes,0);
  assert.deepEqual(rows(db,'inventory_entries')[0],before);
  assert.equal(rows(db,'inventory_entries')[1].source,'loan');
  assert.deepEqual(rows(db,'loans'),loansBefore);
  assert.equal(sync.run('2026-11-02',1,'2026-11-02',2,'2026-11-02').changes,0);
  assert.equal(sync.run('2026-11-02',1,'2026-11-02',3,'2026-11-02').changes,0);
});
test("bulk archive protects loans, counted books, other schools and preserves all physical records", () => {
  const db=fixture(); const before=Object.fromEntries(['students','loans','inventory_entries'].map(t=>[t,rows(db,t)]));
  assert.equal(db.prepare(protectedBulkArchiveSql).run(1,'Roman','Roman','','','','','','').changes,2);
  assert.deepEqual(rows(db,'books').map(b=>b.active_inventory),[1,1,0,1,0]);
  assert.equal(rows(db,'books').length,5);
  for(const table of Object.keys(before)) assert.deepEqual(rows(db,table),before[table]);
});
test("member loan list excludes returned and other member loans; ambiguous copies require DN", () => {
  assert.deepEqual(memberActiveLoans([{studentId:1,returnedAt:null},{studentId:2,returnedAt:null},{studentId:1,returnedAt:'2026-11-01'}],1),[{studentId:1,returnedAt:null}]);
  assert.equal(matchingRecords([{dn:'1',isbn:'123'},{dn:'2',isbn:'123'}],'123',r=>[r.dn,r.isbn]).length,2);
});
test("email payload escapes user text and sends only to intended selected recipient", async () => {
  const payload=overdueEmail({libraryName:'Okul',senderName:'Kütüphane',senderEmail:'sender@example.com'},[{studentName:'<Üye>',email:'selected@example.com',bookTitle:'<script>',author:'A&B',loanedAt:'2026-10-01',dueAt:'2026-10-15'}]);
  assert.ok(!payload.html.includes('<script>')); assert.ok(payload.html.includes('&lt;script&gt;')); assert.ok(payload.html.includes('A&amp;B'));
  let calls=0;
  const result=await deliverOverdueEmail('test-key',payload,async(url,options)=>{calls++;assert.equal(url,'https://api.resend.com/emails');assert.deepEqual(JSON.parse(options.body).to,['selected@example.com']);return new Response('{}',{status:200});});
  assert.equal(calls,1);assert.equal(result.sent,true);
  assert.equal((await deliverOverdueEmail('test',payload,async()=>new Response('unverified sender',{status:403}))).sent,false);
  assert.equal((await deliverOverdueEmail('test',payload,async()=>{throw Error('network')})).sent,false);
});
