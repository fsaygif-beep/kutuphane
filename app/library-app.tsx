"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Student = { id:number; studentNo:string; fullName:string; grade:string; contact:string };
type Book = { id:number; inventoryNo:string; isbn:string; title:string; author:string; publisher:string; category:string; genre:string; shelf:string; dewey:string; pages:number };
type Loan = { id:number; studentId:number; studentNo:string; studentName:string; grade:string; bookId:number; inventoryNo:string; bookTitle:string; author:string; loanedAt:string; dueAt:string; returnedAt:string|null; schoolYear:string };
type Data = { settings:{libraryName:string; schoolYear:string; loanDays:number}; students:Student[]; books:Book[]; loans:Loan[]; today:string };
type Tab = "dashboard"|"circulation"|"books"|"students"|"overdue"|"inventory"|"reports"|"settings";

const menu: Array<[Tab,string,string]> = [
  ["dashboard","Genel Bakış","⌂"],["circulation","Ödünç / İade","⇄"],["books","Kitaplar","▤"],
  ["students","Öğrenciler","◉"],["overdue","Geç Kalanlar","!"],["inventory","Kitap Sayımı","⌕"],["reports","Raporlar","▥"],["settings","Ayarlar","⚙"],
];

async function request(action:string, payload:Record<string,unknown>={}) {
  const response = await fetch("/api/library", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action,...payload}) });
  const result = await response.json() as {error?:string};
  if (!response.ok) throw new Error(result.error || "İşlem başarısız.");
}

export default function LibraryApp() {
  const [tab,setTab] = useState<Tab>("dashboard");
  const [data,setData] = useState<Data|null>(null);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");
  const load = useCallback(async()=>{
    const response = await fetch("/api/library",{cache:"no-store"});
    if (!response.ok) throw new Error("Veriler yüklenemedi.");
    setData(await response.json() as Data);
  },[]);
  useEffect(()=>{ void load().catch(error=>setNotice(error.message)); },[load]);
  const act = async(action:string,payload:Record<string,unknown>,success:string)=>{
    setBusy(true); setNotice("");
    try { await request(action,payload); await load(); setNotice(success); }
    catch(error){ setNotice(error instanceof Error?error.message:"İşlem başarısız."); }
    finally{ setBusy(false); }
  };

  if (!data) return <main className="loading"><div className="loader"/><p>{notice||"Kütüphane hazırlanıyor…"}</p></main>;
  const activeLoans=data.loans.filter(x=>!x.returnedAt);
  const overdue=activeLoans.filter(x=>x.dueAt<data.today);
  const available=data.books.filter(book=>!activeLoans.some(loan=>loan.bookId===book.id));
  const stats=[
    ["Toplam Kitap",data.books.length,"kitap"],["Kayıtlı Öğrenci",data.students.length,"öğrenci"],
    ["Ödünçte",activeLoans.length,"aktif"],["Geciken",overdue.length,"gecikme"],
  ];
  return <div className="shell">
    <aside>
      <div className="brand"><div className="mark">K</div><div><strong>Kütüphane</strong><small>Yönetim Merkezi</small></div></div>
      <nav>{menu.map(([id,label,icon])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><span>{icon}</span>{label}{id==="overdue"&&overdue.length>0?<b>{overdue.length}</b>:null}</button>)}</nav>
      <div className="side-note"><span>2026</span><p>Kitaplar dolaştıkça bilgi çoğalır.</p></div>
    </aside>
    <main>
      <header><div><p className="eyebrow">{data.settings.schoolYear} Eğitim-Öğretim Yılı</p><h1>{data.settings.libraryName}</h1></div><div className="today"><small>BUGÜN</small><strong>{new Date(`${data.today}T12:00:00`).toLocaleDateString("tr-TR",{day:"numeric",month:"long"})}</strong></div></header>
      {notice&&<div className="notice" onClick={()=>setNotice("")}>{notice}<span>×</span></div>}
      {tab==="dashboard"&&<Dashboard stats={stats} active={activeLoans} overdue={overdue} setTab={setTab}/>} 
      {tab==="circulation"&&<Circulation students={data.students} books={available} active={activeLoans} busy={busy} act={act}/>} 
      {tab==="books"&&<Books books={data.books} active={activeLoans} busy={busy} act={act}/>} 
      {tab==="students"&&<Students students={data.students} loans={data.loans} busy={busy} act={act}/>} 
      {tab==="overdue"&&<Overdue rows={overdue} today={data.today} busy={busy} act={act}/>} 
      {tab==="inventory"&&<Inventory books={data.books} active={activeLoans}/>} 
      {tab==="reports"&&<Reports data={data}/>} 
      {tab==="settings"&&<Settings config={data.settings} students={data.students} empty={!data.books.length&&!data.students.length} busy={busy} act={act}/>} 
    </main>
  </div>;
}

function Dashboard({stats,active,overdue,setTab}:{stats:(string|number)[][];active:Loan[];overdue:Loan[];setTab:(t:Tab)=>void}) {
  return <section><div className="page-head"><div><h2>Genel Bakış</h2><p>Kütüphanenizin bugünkü durumunu tek bakışta görün.</p></div><button className="primary" onClick={()=>setTab("circulation")}>+ Yeni ödünç işlemi</button></div>
    <div className="reading-banner"><img src="/reading-hero.png" alt="Kütüphanede kitap okuyan öğrenciler"/><div><small>OKUMA İLHAMI</small><blockquote>“Bir kitap, insanın kendine yaptığı en güzel yatırımdır.”</blockquote><p>Bugün bir öğrenciye doğru kitabı ulaştırın.</p></div></div>
    <div className="stats">{stats.map(([label,value,detail],i)=><article key={String(label)}><div className={`stat-icon s${i}`}>{["▤","◉","↗","!"][i]}</div><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></article>)}</div>
    <div className="grid-2"><Card title="Aktif Ödünçler" action="Tüm işlemler" onAction={()=>setTab("circulation")}><LoanTable rows={active.slice(0,6)} showReturn={false}/></Card>
    <Card title="Dikkat Gerekenler" action="Geç kalanları aç" onAction={()=>setTab("overdue")}><div className="attention"><div className="big-alert">{overdue.length}</div><div><strong>geciken kitap</strong><p>{overdue.length?"Öğrencilere hatırlatma yapılması gerekiyor.":"Harika! Geciken kitap bulunmuyor."}</p></div></div></Card></div>
  </section>;
}

function Circulation({students,books,active,busy,act}:{students:Student[];books:Book[];active:Loan[];busy:boolean;act:(a:string,p:Record<string,unknown>,s:string)=>Promise<void>}) {
  const [studentId,setStudentId]=useState(""); const [bookId,setBookId]=useState("");
  return <section><PageHead title="Ödünç Verme ve İade" text="Öğrenciyi ve raftaki kitabı seçerek işlemi saniyeler içinde tamamlayın."/>
    <div className="circulation"><Card title="Yeni Ödünç"><div className="step"><b>1</b><label>Öğrenci seç<select value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Öğrenci no veya ad…</option>{students.map(x=><option key={x.id} value={x.id}>{x.studentNo} · {x.fullName} · {x.grade}</option>)}</select></label></div><div className="step"><b>2</b><label>Kitap seç<select value={bookId} onChange={e=>setBookId(e.target.value)}><option value="">DN, ISBN veya kitap adı…</option>{books.map(x=><option key={x.id} value={x.id}>{x.inventoryNo} · {x.title} · {x.author}</option>)}</select></label></div><button className="primary full" disabled={busy||!studentId||!bookId} onClick={async()=>{await act("loan",{studentId:Number(studentId),bookId:Number(bookId)},"Kitap ödünç verildi.");setBookId("");}}>Ödünç ver</button></Card>
    <Card title="Ödünçteki Kitaplar"><LoanTable rows={active} showReturn onReturn={id=>act("return",{loanId:id},"Kitap teslim alındı.")} busy={busy}/></Card></div>
  </section>;
}

function Books({books,active,busy,act}:{books:Book[];active:Loan[];busy:boolean;act:(a:string,p:Record<string,unknown>,s:string)=>Promise<void>}) {
  const [open,setOpen]=useState(false); const [editing,setEditing]=useState<Book|null>(null); const [q,setQ]=useState("");
  const shown=books.filter(x=>`${x.inventoryNo} ${x.isbn} ${x.title} ${x.author}`.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")));
  return <section><PageHead title="Kitaplar" text="Katalog kayıtlarını arayın, raf durumunu izleyin ve yeni kitap ekleyin." action={<button className="primary" onClick={()=>{setEditing(null);setOpen(!open)}}>+ Kitap ekle</button>}/>{open&&<BookForm busy={busy} initial={editing} submit={async p=>{await act(editing?"updateBook":"addBook",editing?{...p,id:editing.id}:p,editing?"Kitap güncellendi.":"Kitap kataloğa eklendi.");setOpen(false);setEditing(null);}} onDelete={editing?async()=>{if(confirm("Bu kitabı silmek istediğinize emin misiniz?")){await act("deleteBook",{id:editing.id},"Kitap silindi.");setOpen(false);setEditing(null);}}:undefined}/>}<Search value={q} setValue={setQ} placeholder="Kitap adı, yazar, DN veya ISBN ile ara"/><div className="book-grid">{shown.map(book=><article className="book" key={book.id}><div className="cover">{book.title.slice(0,1)}</div><div><span className={active.some(x=>x.bookId===book.id)?"badge red":"badge green"}>{active.some(x=>x.bookId===book.id)?"Ödünçte":"Rafta"}</span><h3>{book.title}</h3><p>{book.author}</p><small>{book.inventoryNo} · {book.shelf||"Raf belirtilmedi"}</small><button className="edit-link" onClick={()=>{setEditing(book);setOpen(true)}}>Düzenle</button></div></article>)}</div>{!shown.length&&<Empty text="Aramanızla eşleşen kitap bulunamadı."/>}</section>;
}

function Students({students,loans,busy,act}:{students:Student[];loans:Loan[];busy:boolean;act:(a:string,p:Record<string,unknown>,s:string)=>Promise<void>}) {
  const [open,setOpen]=useState(false); const [editing,setEditing]=useState<Student|null>(null); const [classes,setClasses]=useState(false); const [selected,setSelected]=useState<Set<number>>(new Set()); const [newGrade,setNewGrade]=useState(""); const [q,setQ]=useState("");
  const shown=students.filter(x=>`${x.studentNo} ${x.fullName} ${x.grade}`.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")));
  const gradeList=[...new Set(students.map(x=>x.grade))].sort((a,b)=>a.localeCompare(b,"tr",{numeric:true}));
  return <section><PageHead title="Öğrenciler" text="Öğrenci numarası ve sınıf bilgileriyle üyeleri yönetin." action={<div className="actions"><button className="secondary" onClick={()=>setClasses(!classes)}>Sınıf düzenle</button><button className="primary" onClick={()=>{setEditing(null);setOpen(!open)}}>+ Öğrenci ekle</button></div>}/>{open&&<StudentForm busy={busy} initial={editing} submit={async p=>{await act(editing?"updateStudent":"addStudent",editing?{...p,id:editing.id}:p,editing?"Öğrenci güncellendi.":"Öğrenci kaydedildi.");setOpen(false);setEditing(null);}} onDelete={editing?async()=>{if(confirm("Bu öğrenciyi silmek istediğinize emin misiniz?")){await act("deleteStudent",{id:editing.id},"Öğrenci silindi.");setOpen(false);setEditing(null);}}:undefined}/>} {classes&&<div className="panel class-manager"><div><strong>Sınıf yönetimi</strong><p className="muted">Öğrencileri seçin; fotoğraf ve geçmiş kayıtları korunarak yeni sınıfa taşıyın.</p></div><select value={newGrade} onChange={e=>setNewGrade(e.target.value)}><option value="">Yeni sınıf…</option>{gradeList.map(g=><option key={g}>{g}</option>)}<option value="9-A">9-A</option></select><button className="primary" disabled={!selected.size||!newGrade||busy} onClick={async()=>{await act("changeGrades",{ids:[...selected],grade:newGrade},"Seçilen öğrencilerin sınıfı değiştirildi.");setSelected(new Set());}}>Seçilenleri taşı</button></div>}<Search value={q} setValue={setQ} placeholder="Öğrenci no, ad soyad veya sınıf ile ara"/><div className="table-card"><table><thead><tr>{classes&&<th>Seç</th>}<th>Öğrenci</th><th>Sınıf</th><th>İletişim</th><th>Okuduğu Kitap</th><th></th></tr></thead><tbody>{shown.map(x=><tr key={x.id}>{classes&&<td><input className="row-check" type="checkbox" checked={selected.has(x.id)} onChange={()=>setSelected(current=>{const next=new Set(current);next.has(x.id)?next.delete(x.id):next.add(x.id);return next})}/></td>}<td><strong>{x.fullName}</strong><small>{x.studentNo}</small></td><td><span className="badge blue">{x.grade}</span></td><td>{x.contact||"—"}</td><td>{loans.filter(l=>l.studentId===x.id&&l.returnedAt).length}</td><td><button className="small" onClick={()=>{setEditing(x);setOpen(true)}}>Düzenle</button></td></tr>)}</tbody></table></div></section>;
}

function Overdue({rows,today,busy,act}:{rows:Loan[];today:string;busy:boolean;act:(a:string,p:Record<string,unknown>,s:string)=>Promise<void>}) {
  return <section><PageHead title="Geç Kalanlar" text="Teslim tarihi geçen kitapları gecikme süresine göre takip edin."/><div className="table-card"><table><thead><tr><th>Öğrenci</th><th>Kitap</th><th>Son Teslim</th><th>Gecikme</th><th></th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><strong>{x.studentName}</strong><small>{x.studentNo} · {x.grade}</small></td><td>{x.bookTitle}<small>{x.author}</small></td><td>{fmt(x.dueAt)}</td><td><span className="badge red">{daysBetween(x.dueAt,today)} gün</span></td><td><button className="small" disabled={busy} onClick={()=>act("return",{loanId:x.id},"Kitap teslim alındı.")}>İade al</button></td></tr>)}</tbody></table>{!rows.length&&<Empty text="Geciken kitap bulunmuyor."/>}</div></section>;
}

function Reports({data}:{data:Data}) {
  const completed=data.loans.filter(x=>x.returnedAt);
  const readers=Object.values(completed.reduce<Record<number,{name:string;grade:string;count:number}>>((acc,x)=>{acc[x.studentId]??={name:x.studentName,grade:x.grade,count:0};acc[x.studentId].count++;return acc;},{})).sort((a,b)=>b.count-a.count);
  const titles=Object.values(data.loans.reduce<Record<string,{title:string;author:string;count:number}>>((acc,x)=>{const key=`${x.bookTitle}|${x.author}`;acc[key]??={title:x.bookTitle,author:x.author,count:0};acc[key].count++;return acc;},{})).sort((a,b)=>b.count-a.count);
  return <section><PageHead title="Raporlar ve İstatistikler" text={`${data.settings.schoolYear} döneminin okuma hareketlerini inceleyin.`}/><div className="grid-2"><Card title="En Çok Okuyan Öğrenciler"><Ranking rows={readers.map(x=>[x.name,`${x.grade} · ${x.count} kitap`,x.count])}/></Card><Card title="En Çok Okunan Kitaplar"><Ranking rows={titles.map(x=>[x.title,`${x.author} · ${x.count} ödünç`,x.count])}/></Card></div></section>;
}

function Inventory({books,active}:{books:Book[];active:Loan[]}) {
  const [query,setQuery]=useState("");
  const [rows,setRows]=useState<Array<{query:string;book?:Book;status:string}>>([]);
  const check=()=>{const needle=query.trim().toLocaleLowerCase("tr");if(!needle)return;const book=books.find(x=>`${x.title} ${x.inventoryNo} ${x.isbn}`.toLocaleLowerCase("tr").includes(needle));setRows(v=>[{query:query.trim(),book,status:book?(active.some(l=>l.bookId===book.id)?"Ödünçte":"Rafta"):"Eksik / Kayıtsız"},...v]);setQuery("")};
  const download=()=>{const csv=["Aranan,Kitap,DN,ISBN,Raf,Durum",...rows.map(x=>[x.query,x.book?.title??"",x.book?.inventoryNo??"",x.book?.isbn??"",x.book?.shelf??"",x.status].map(v=>`\"${String(v).replaceAll('"','""')}\"`).join(","))].join("\n");const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="kitap-sayim-raporu.csv";a.click();URL.revokeObjectURL(url)};
  return <section><PageHead title="Kitap Sayımı ve Raf Kontrol" text="Kitap adı, demirbaş no veya ISBN ile raftaki durumu kontrol edin." action={<button className="secondary" disabled={!rows.length} onClick={download}>Raporu indir</button>}/><div className="inventory"><Card title="Kitap Sorgula"><div className="form-grid one"><label>Kitap Adı / DN / ISBN<input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")check()}} placeholder="örn. DN-001 veya kitap adı"/></label><button className="primary" onClick={check}>Kontrol et</button></div><div className="inventory-summary"><span><b>{rows.length}</b> Sayılan</span><span><b>{rows.filter(x=>x.status==="Rafta").length}</b> Rafta</span><span><b>{rows.filter(x=>x.status==="Ödünçte").length}</b> Ödünçte</span><span><b>{rows.filter(x=>x.status.startsWith("Eksik")).length}</b> Eksik</span></div></Card><div className="table-card"><table><thead><tr><th>Aranan</th><th>Kitap</th><th>DN / ISBN</th><th>Raf</th><th>Durum</th></tr></thead><tbody>{rows.map((x,i)=><tr key={`${x.query}-${i}`}><td>{x.query}</td><td><strong>{x.book?.title||"—"}</strong><small>{x.book?.author||"Kütüphane kaydında bulunamadı"}</small></td><td>{x.book?`${x.book.inventoryNo} / ${x.book.isbn||"—"}`:"—"}</td><td>{x.book?.shelf||"—"}</td><td><span className={x.status==="Rafta"?"badge green":"badge red"}>{x.status}</span></td></tr>)}</tbody></table>{!rows.length&&<Empty text="Kontrol edilen kitaplar burada listelenecek."/>}</div></div></section>;
}

function Settings({config,students,empty,busy,act}:{config:Data["settings"];students:Student[];empty:boolean;busy:boolean;act:(a:string,p:Record<string,unknown>,s:string)=>Promise<void>}) {
  const [form,setForm]=useState(config); const [graduate,setGraduate]=useState(""); const grades=[...new Set(students.map(x=>x.grade))].sort((a,b)=>a.localeCompare(b,"tr",{numeric:true}));
  return <section><PageHead title="Kütüphane Ayarları" text="Kurum bilgilerini, eğitim yılını ve ödünç süresini düzenleyin."/><div className="grid-2"><Card title="Genel Ayarlar"><div className="form-grid one"><label>Kütüphane adı<input value={form.libraryName} onChange={e=>setForm({...form,libraryName:e.target.value})}/></label><label>Eğitim-öğretim yılı<input value={form.schoolYear} onChange={e=>setForm({...form,schoolYear:e.target.value})}/></label><label>Ödünç süresi (gün)<input type="number" min="1" value={form.loanDays} onChange={e=>setForm({...form,loanDays:Number(e.target.value)})}/></label><button className="primary" disabled={busy} onClick={()=>act("settings",form,"Ayarlar kaydedildi.")}>Ayarları kaydet</button></div></Card><Card title="Öğretim Yılı İşlemleri"><div className="form-grid one"><p className="muted">Sınıf atlatma işlemi 9→10, 10→11 ve 11→12 olarak uygulanır. On ikinci sınıflar otomatik silinmez.</p><button className="secondary" disabled={busy||!students.length} onClick={()=>confirm("Tüm uygun öğrenciler bir üst sınıfa geçirilsin mi?")&&act("promoteGrades",{},"Öğrenciler bir üst sınıfa geçirildi.")}>Sınıfları topluca atlat</button><label>Mezun sınıfı seç<select value={graduate} onChange={e=>setGraduate(e.target.value)}><option value="">Sınıf seçin…</option>{grades.map(g=><option key={g}>{g}</option>)}</select></label><button className="danger" disabled={busy||!graduate} onClick={()=>confirm(`${graduate} sınıfındaki öğrenciler silinsin mi?`)&&act("deleteGrade",{grade:graduate},"Mezun sınıf kayıtları silindi.")}>Seçili mezun sınıfı sil</button></div></Card><Card title="Başlangıç Verileri"><p className="muted">Projeyi hızlıca denemek için üç öğrenci ve üç kitap ekleyebilirsiniz. Aynı kayıtlar ikinci kez oluşturulmaz.</p><div className="form-grid one"><button className="secondary" disabled={busy||!empty} onClick={()=>act("seed",{},"Örnek kayıtlar eklendi.")}>{empty?"Örnek verileri yükle":"Örnek veriler hazır"}</button></div></Card></div></section>;
}

function BookForm({busy,initial,submit,onDelete}:{busy:boolean;initial:Book|null;submit:(p:Record<string,unknown>)=>Promise<void>;onDelete?:()=>Promise<void>}) { const [f,setF]=useState(()=>initial?{...initial,pages:String(initial.pages)}:{inventoryNo:"",isbn:"",title:"",author:"",publisher:"",category:"",genre:"",shelf:"",dewey:"",pages:""}); return <form className="panel form-grid" onSubmit={e=>{e.preventDefault();void submit(f)}}>{Object.entries({inventoryNo:"Demirbaş No *",isbn:"ISBN",title:"Kitap Adı *",author:"Yazar *",publisher:"Yayınevi",category:"Kategori",genre:"Tür",shelf:"Raf No",dewey:"Dewey Kodu",pages:"Sayfa Sayısı"}).map(([key,label])=><label key={key}>{label}<input type={key==="pages"?"number":"text"} value={String(f[key as keyof typeof f]??"")} onChange={e=>setF({...f,[key]:e.target.value})}/></label>)}<div className="form-actions">{onDelete&&<button type="button" className="danger" disabled={busy} onClick={()=>void onDelete()}>Kaydı sil</button>}<button className="primary" disabled={busy}>{initial?"Değişiklikleri kaydet":"Kitabı kaydet"}</button></div></form> }
function StudentForm({busy,initial,submit,onDelete}:{busy:boolean;initial:Student|null;submit:(p:Record<string,unknown>)=>Promise<void>;onDelete?:()=>Promise<void>}) { const [f,setF]=useState(()=>initial?{studentNo:initial.studentNo,fullName:initial.fullName,grade:initial.grade,contact:initial.contact}:{studentNo:"",fullName:"",grade:"",contact:""}); return <form className="panel form-grid" onSubmit={e=>{e.preventDefault();void submit(f)}}>{Object.entries({studentNo:"Öğrenci No *",fullName:"Adı Soyadı *",grade:"Sınıfı *",contact:"Telefon / E-posta"}).map(([key,label])=><label key={key}>{label}<input value={f[key as keyof typeof f]} onChange={e=>setF({...f,[key]:e.target.value})}/></label>)}<div className="form-actions">{onDelete&&<button type="button" className="danger" disabled={busy} onClick={()=>void onDelete()}>Kaydı sil</button>}<button className="primary" disabled={busy}>{initial?"Değişiklikleri kaydet":"Öğrenciyi kaydet"}</button></div></form> }
function LoanTable({rows,showReturn,onReturn,busy}:{rows:Loan[];showReturn:boolean;onReturn?:(id:number)=>void;busy?:boolean}) { return <div className="table-wrap"><table><thead><tr><th>Öğrenci</th><th>Kitap</th><th>Son Teslim</th>{showReturn&&<th/>}</tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><strong>{x.studentName}</strong><small>{x.grade}</small></td><td>{x.bookTitle}<small>{x.inventoryNo}</small></td><td>{fmt(x.dueAt)}</td>{showReturn&&<td><button className="small" disabled={busy} onClick={()=>onReturn?.(x.id)}>İade al</button></td>}</tr>)}</tbody></table>{!rows.length&&<Empty text="Henüz kayıt yok."/>}</div> }
function Ranking({rows}:{rows:(string|number)[][]}) { const max=Math.max(1,...rows.map(x=>Number(x[2]))); return <div className="ranking">{rows.slice(0,8).map((x,i)=><div key={String(x[0])}><b>{i+1}</b><span><strong>{x[0]}</strong><small>{x[1]}</small><i style={{width:`${Number(x[2])/max*100}%`}}/></span></div>)}{!rows.length&&<Empty text="Rapor oluşturmak için tamamlanmış ödünç kaydı gerekiyor."/>}</div> }
function Card({title,children,action,onAction}:{title:string;children:React.ReactNode;action?:string;onAction?:()=>void}) { return <article className="card"><div className="card-head"><h3>{title}</h3>{action&&<button onClick={onAction}>{action} →</button>}</div>{children}</article> }
function PageHead({title,text,action}:{title:string;text:string;action?:React.ReactNode}) { return <div className="page-head"><div><h2>{title}</h2><p>{text}</p></div>{action}</div> }
function Search({value,setValue,placeholder}:{value:string;setValue:(x:string)=>void;placeholder:string}) { return <div className="search"><span>⌕</span><input value={value} onChange={e=>setValue(e.target.value)} placeholder={placeholder}/></div> }
function Empty({text}:{text:string}) { return <div className="empty"><span>◇</span><p>{text}</p></div> }
function fmt(value:string){ return new Date(`${value}T12:00:00`).toLocaleDateString("tr-TR"); }
function daysBetween(a:string,b:string){ return Math.max(0,Math.ceil((new Date(`${b}T12:00:00`).getTime()-new Date(`${a}T12:00:00`).getTime())/86400000)); }
