export const normalizeGrade = (value: unknown) => String(value ?? "").toLocaleUpperCase("tr").replace(/[\s/\-]+/g, "");
export const validGrade = (value: unknown) => /^(?:[1-9]|1[0-2])[A-ZÇĞİÖŞÜ]$/.test(String(value));
export const normalizePhone = (value: unknown) => String(value ?? "").replace(/\D/g, "").replace(/^90(?=5\d{9}$)/, "").replace(/^0(?=5\d{9}$)/, "");
export const validPhone = (value: unknown) => /^5\d{9}$/.test(normalizePhone(value));
export const privateReviewerName = (value: string) => { const names=value.trim().split(/\s+/); return `${names[0]?.slice(0,1) || ""}. ${names.length>1?names.at(-1):""}`.trim(); };
export const complaintCategories = ["Yaşa uygun değil", "Şiddet içeriyor", "Smut / cinsel içerik", "Hasarlı / eksik sayfa", "Diğer"];
