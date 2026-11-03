import {normalizeGrade,validGrade} from './student-rules';

// Presentation only: keep stored grades and member identifiers unchanged.
export function displayGrade(value:unknown):string {
  const grade=normalizeGrade(value);
  return validGrade(grade)?grade.replace(/^(\d+)(.+)$/,'$1 $2'):String(value??'').trim();
}
export function memberCaption(member:{memberType:string;studentNo:string;fullName:string;grade:string;branch?:string}):string {
  return member.memberType==='student'
    ? [member.studentNo,member.fullName,displayGrade(member.grade)].filter(Boolean).join(' · ')
    : [member.fullName,member.branch].filter(Boolean).join(' · ');
}
