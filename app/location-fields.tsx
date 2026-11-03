"use client";
import locations from "./turkey-locations.json";
import {matchText,sameDistrict} from './member-matching';
const places=locations as Record<string,string[]>;
export function LocationFields({city,district,onChange}:{city:string;district:string;onChange:(city:string,district:string)=>void}) {
  const selected=Object.keys(places).find(name=>matchText(name)===matchText(city))||'';
  const selectedDistrict=(places[selected]||[]).find(name=>sameDistrict(selected,name,district))||'';
  return <><label>İl<select required value={selected} onChange={e=>onChange(e.target.value,"")}><option value="">İl seçin…</option>{Object.keys(places).sort((a,b)=>a.localeCompare(b,"tr")).map(name=><option key={name}>{name}</option>)}</select></label>
    <label>İlçe<select required disabled={!places[selected]} value={selectedDistrict} onChange={e=>onChange(selected,e.target.value)}><option value="">İlçe seçin…</option>{(places[selected]||[]).map(name=><option key={name} value={name}>{sameDistrict(selected,name,'Merkez')?'Merkez':name}</option>)}</select></label></>;
}
