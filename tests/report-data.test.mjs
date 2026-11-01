import test from 'node:test';
import assert from 'node:assert/strict';
import { reportData } from '../app/report-data.ts';

test('ranking and drilldown use the same completed records, date range and same-day rule',()=>{
  const base={studentId:1,studentName:'Aynı Ad',grade:'9A',bookTitle:'Eser',author:'Yazar',loanedAt:'2026-09-01',returnedAt:'2026-09-20',sameDayRequired:0};
  const loans=[{...base,id:1},{...base,id:2,studentId:2},{...base,id:3,author:'Başka Yazar'},{...base,id:4,returnedAt:null},{...base,id:5,returnedAt:'2026-08-31'},{...base,id:6,sameDayRequired:1,returnedAt:'2026-09-02'}];
  const before=structuredClone(loans);
  const result=reportData(loans,'2026-09-01','2026-09-30');
  assert.deepEqual(result.completed.map(l=>l.id),[1,2,3]);
  assert.deepEqual(result.readers.map(r=>[r.id,r.count]),[[1,2],[2,1]]);
  assert.deepEqual(result.titles.map(r=>[r.author,r.count]),[['Yazar',2],['Başka Yazar',1]]);
  for(const r of result.readers) assert.equal(result.completed.filter(l=>l.studentId===r.id).length,r.count);
  for(const r of result.titles) assert.equal(result.completed.filter(l=>JSON.stringify([l.bookTitle,l.author])===r.key).length,r.count);
  assert.deepEqual(loans,before);
});
