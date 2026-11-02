"use client";
import locations from "./turkey-locations.json";
const places=locations as Record<string,string[]>;
export function LocationFields({city,district,onChange}:{city:string;district:string;onChange:(city:string,district:string)=>void}) {
  const selected=city.toLocaleUpperCase("tr");
  return <><label>İl<select required value={selected} onChange={e=>onChange(e.target.value,"")}><option value="">İl seçin…</option>{Object.keys(places).sort((a,b)=>a.localeCompare(b,"tr")).map(name=><option key={name}>{name}</option>)}</select></label>
    <label>İlçe<select required disabled={!places[selected]} value={district.toLocaleUpperCase("tr")} onChange={e=>onChange(selected,e.target.value)}><option value="">İlçe seçin…</option>{(places[selected]||[]).map(name=><option key={name}>{name}</option>)}</select></label></>;
}
