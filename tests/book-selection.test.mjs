import test from 'node:test';
import assert from 'node:assert/strict';
import {sameBookIdentity,selectedInventoryBook} from '../app/book-identity.ts';

test('comments group matching title and author despite case or spacing, but keep distinct books separate',()=>{
  assert.equal(sameBookIdentity({title:' Körlük ',author:'Jose  SARAMAGO'},{title:'KÖRLÜK',author:'Jose Saramago'}),true);
  assert.equal(sameBookIdentity({title:'Körlük',author:'Jose Saramago'},{title:'Körlük',author:'Başka Yazar'}),false);
  assert.equal(sameBookIdentity({title:'Körlük',author:'Jose Saramago'},{title:'Görmek',author:'Jose Saramago'}),false);
});
test('explicit inventory copy wins over shared ISBN; ambiguous ISBN never chooses the first copy',()=>{
  const books=[{id:1,inventoryNo:'DN01',isbn:'123456'},{id:2,inventoryNo:'DN02',isbn:'123456'},{id:3,inventoryNo:'DN03',isbn:'999999'}];
  assert.equal(selectedInventoryBook(books,'123456',2,books.slice(0,2)).id,2);
  assert.equal(selectedInventoryBook(books,'123456',0,books.slice(0,2)),undefined);
  assert.equal(selectedInventoryBook(books,'DN02',0,[books[1]]).id,2);
  assert.equal(selectedInventoryBook(books,'999999',1,[books[2]]).id,3);
});
