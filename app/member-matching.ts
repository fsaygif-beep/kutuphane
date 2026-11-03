export const matchText = (value:unknown) => String(value??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').toLowerCase().replace(/\s+/g,' ');
export const districtKey = (city:unknown,district:unknown) => {
  const place=matchText(city),area=matchText(district);
  return area===`${place} merkez`||area===`merkez ${place}`?'merkez':area;
};
export const sameDistrict = (city:unknown,left:unknown,right:unknown) => districtKey(city,left)===districtKey(city,right);
