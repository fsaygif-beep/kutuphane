const normalized = (value:string) => value.normalize("NFC").trim().replace(/\s+/g," ").toLocaleUpperCase("tr");
export const sameBookIdentity = (left:{title:string;author:string},right:{title:string;author:string}) =>
  normalized(left.title) === normalized(right.title) && normalized(left.author) === normalized(right.author);

export function selectedInventoryBook<T extends {id:number;inventoryNo:string;isbn:string}>(books:T[],query:string,selectedId:number,matches:T[]) {
  const selected=matches.find(book=>book.id===selectedId);
  if(selected)return selected;
  const text=normalized(query);
  const exact=books.filter(book=>[book.inventoryNo,book.isbn].some(value=>value&&normalized(value)===text));
  return exact.length===1?exact[0]:matches.length===1?matches[0]:undefined;
}
