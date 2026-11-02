import { store } from './state.js';

const fmtDate=(date,opts={})=>new Intl.DateTimeFormat('en-GB',opts).format(date);
const sessionCounts=s=>({present:s.records.filter(r=>r.status==='PRESENT').length,absent:s.records.filter(r=>r.status==='ABSENT').length});
const pct=value=>value===null?'N/A':`${value}%`;
const localDate=date=>{const offset=date.getTimezoneOffset()*60000;return new Date(date-offset).toISOString().slice(0,10);};

function lineChart(canvas, points){
  const dpr=devicePixelRatio||1, box=canvas.getBoundingClientRect(), w=box.width||500,h=box.height||230; canvas.width=w*dpr;canvas.height=h*dpr;const x=canvas.getContext('2d');x.scale(dpr,dpr);x.clearRect(0,0,w,h);
  points=points.filter(point=>point.rate!==null);if(!points.length){x.fillStyle='#8a92a6';x.textAlign='center';x.font='13px "Google Sans Flex", sans-serif';x.fillText('No attendance data',w/2,h/2);return;}
  const pad={l:38,r:12,t:18,b:34}, min=60,max=100, px=i=>points.length===1?w/2:pad.l+i*(w-pad.l-pad.r)/(points.length-1), py=v=>pad.t+(max-v)*(h-pad.t-pad.b)/(max-min);
  x.font='13px "Google Sans Flex", sans-serif';x.fillStyle='#8a92a6';x.textAlign='right';[60,70,80,90,100].forEach(v=>{x.fillText(v+'%',pad.l-8,py(v)+4);x.strokeStyle='#edf0f5';x.beginPath();x.moveTo(pad.l,py(v));x.lineTo(w-pad.r,py(v));x.stroke();});
  x.beginPath();points.forEach((p,i)=>i?x.lineTo(px(i),py(p.rate)):x.moveTo(px(i),py(p.rate)));x.strokeStyle='#4f46e5';x.lineWidth=2.5;x.stroke();
  points.forEach((p,i)=>{x.fillStyle='#fff';x.strokeStyle='#4f46e5';x.lineWidth=2;x.beginPath();x.arc(px(i),py(p.rate),4,0,Math.PI*2);x.fill();x.stroke();x.fillStyle='#8a92a6';x.textAlign='center';x.fillText(fmtDate(new Date(p.date+'T12:00'),{day:'2-digit',month:'short'}),px(i),h-10);});
}
function barChart(canvas, items){
  const dpr=devicePixelRatio||1,box=canvas.getBoundingClientRect(),w=box.width||380,h=box.height||230;canvas.width=w*dpr;canvas.height=h*dpr;const x=canvas.getContext('2d');x.scale(dpr,dpr);x.clearRect(0,0,w,h);const pad={l:38,r:12,t:18,b:42},max=100,bw=(w-pad.l-pad.r)/items.length*.52;
  x.font='13px "Google Sans Flex", sans-serif';[0,25,50,75,100].forEach(v=>{const y=pad.t+(100-v)*(h-pad.t-pad.b)/max;x.fillStyle='#8a92a6';x.textAlign='right';x.fillText(v+'%',pad.l-8,y+4);x.strokeStyle='#edf0f5';x.beginPath();x.moveTo(pad.l,y);x.lineTo(w-pad.r,y);x.stroke();});
  items.forEach((it,i)=>{const cx=pad.l+(i+.5)*(w-pad.l-pad.r)/items.length,rate=it.rate??0,bh=rate*(h-pad.t-pad.b)/100,y=h-pad.b-bh;x.fillStyle=it.color;x.beginPath();x.roundRect(cx-bw/2,y,bw,bh,4);x.fill();x.fillStyle='#596174';x.textAlign='center';x.fillText(it.code.replace(' ',''),cx,h-18);x.fillStyle='#252a38';x.font='600 13px "Google Sans Flex", sans-serif';x.fillText(pct(it.rate),cx,y-7);x.font='13px "Google Sans Flex", sans-serif';});
}
export function renderDashboard(){
  const {teacher,courses}=store.data, now=new Date(), classes=store.todayClasses();
  document.querySelector('#teacher-name').textContent=teacher.name;document.querySelector('#teacher-dept').textContent=teacher.department;document.querySelector('#teacher-first-name').textContent=teacher.name.split(' ')[0];
  document.querySelector('#greeting').textContent=now.getHours()<12?'Good morning':now.getHours()<18?'Good afternoon':'Good evening';
  document.querySelector('#current-date').textContent=fmtDate(now,{weekday:'long',day:'numeric',month:'long',year:'numeric'});document.querySelector('#date-chip').textContent=fmtDate(now,{day:'2-digit',month:'short'});
  const stats=[['book-open','Total courses',courses.length,'Assigned this semester'],['users','Unique students',store.uniqueStudents(),'Across all your courses'],['calendar-clock',"Today's classes",classes.length,classes.length?'Next class on schedule':'No classes scheduled'],['circle-check-big','Attendance rate',pct(store.overallRate()),'Overall semester average']];
  document.querySelector('#stats-grid').innerHTML=stats.map(([icon,label,value,note])=>`<article class="stat-card"><span class="stat-icon"><i data-lucide="${icon}"></i></span><div><p>${label}</p><strong>${value}</strong><small>${note}</small></div></article>`).join('');
  const today=localDate(now);document.querySelector('#schedule-list').innerHTML=classes.length?classes.map((s,i)=>{const recorded=store.attendanceSession(s.course.id,today);return `<div class="schedule-item"><div class="time"><strong>${s.time}</strong><span>${s.duration} min</span></div><i style="background:${s.course.color}"></i><div class="schedule-info"><strong>${s.course.name}</strong><span>${s.course.code} · ${s.course.room}</span></div><span class="${recorded?'status-live':i===0?'status-live':'status-upcoming'}">${recorded?'Recorded':i===0?'Next':'Upcoming'}</span></div>`}).join(''):`<div class="empty"><i data-lucide="calendar-x"></i><strong>No classes today</strong><span>Your schedule is clear for the day.</span></div>`;
  document.querySelector('#courses-table').innerHTML=courses.map(c=>{const count=store.roster(c.id).length,rate=store.courseRate(c.id),s=c.schedule[0],schedule=s?`${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][s.day]}, ${s.time}`:'Not scheduled';return `<tr><td><span class="course-dot" style="background:${c.color}"></span><span><strong>${c.code}</strong><small>${c.name}</small></span></td><td>${count}</td><td>${schedule}</td><td><div class="rate-cell"><span>${pct(rate)}</span><i><b style="width:${rate??0}%;background:${c.color}"></b></i></div></td></tr>`}).join('');
  document.querySelector('#recent-table').innerHTML=store.recent().map(s=>{const c=store.course(s.courseId),n=sessionCounts(s),rate=store.sessionRate(s);return `<tr><td>${fmtDate(new Date(s.date+'T12:00'),{day:'2-digit',month:'short',year:'numeric'})}</td><td><span class="course-dot" style="background:${c.color}"></span><strong>${c.code}</strong><small>${c.name}</small></td><td><span class="present-count">${n.present}</span></td><td><span class="absent-count">${n.absent}</span></td><td><strong>${pct(rate)}</strong></td><td><span class="complete-badge"><i></i> Completed</span></td></tr>`}).join('');
  requestAnimationFrame(()=>{lineChart(document.querySelector('#trend-chart'),store.trend());barChart(document.querySelector('#course-chart'),courses.map(c=>({...c,rate:store.courseRate(c.id)})));window.lucide?.createIcons();});
}

export function redrawCharts(){ lineChart(document.querySelector('#trend-chart'),store.trend());barChart(document.querySelector('#course-chart'),store.data.courses.map(c=>({...c,rate:store.courseRate(c.id)}))); }
