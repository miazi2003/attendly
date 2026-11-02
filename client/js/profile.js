import { store } from './state.js';

const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export function initProfile(){
  const render=()=>{const {teacher,courses}=store.data,initials=teacher.name.replace(/^Dr\.\s*/,'').split(' ').map(n=>n[0]).join('');document.querySelector('#profile-hero').innerHTML=`<span class="profile-avatar">${esc(initials)}</span><div><p class="eyebrow">Faculty member</p><h2>${esc(teacher.name)}</h2><span>${esc(teacher.department)} Department</span></div><div class="profile-metrics"><span><strong>${courses.length}</strong><small>Assigned courses</small></span><span><strong>${store.uniqueStudents()}</strong><small>Unique students</small></span></div>`;document.querySelector('#profile-details').innerHTML=[['Teacher ID',teacher.id],['Full name',teacher.name],['Email address',teacher.email],['Department',teacher.department]].map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('');document.querySelector('#profile-schedule').innerHTML=courses.flatMap(c=>c.schedule.map(s=>`<div class="profile-class"><i style="background:${esc(c.color)}"></i><span><strong>${esc(c.code)} · ${esc(c.name)}</strong><small>${days[s.day]}, ${esc(s.time)} · ${s.duration} min · ${esc(c.room)}</small></span></div>`)).join('')||'<div class="report-empty"><strong>No classes assigned</strong></div>';window.lucide?.createIcons();};return {render};
}
