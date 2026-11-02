import { loadTemplates } from './loader.js';
import { initAuth } from './auth.js';
import { renderDashboard, redrawCharts } from './dashboard.js';
import { initCourses } from './courses.js';
import { initStudents } from './students.js';
import { initAttendance } from './attendance.js';
import { initHistory } from './history.js';
import { initReports, exportSemesterCsv } from './reports.js';
import { initProfile } from './profile.js';
import { store } from './state.js';
import { api } from './api.js';
import { loadManagementData } from './management.js';
import { loadAttendance, loadReports } from './attendance-data.js';

await loadTemplates();

const login=document.querySelector('#login-view'),app=document.querySelector('#app-view'),sidebar=document.querySelector('#sidebar'),backdrop=document.querySelector('#nav-backdrop');
const views={dashboard:document.querySelector('#dashboard'),courses:document.querySelector('#courses-view'),'course-details':document.querySelector('#course-details-view'),students:document.querySelector('#students-view'),attendance:document.querySelector('#attendance-view'),history:document.querySelector('#history-view'),reports:document.querySelector('#reports-view'),profile:document.querySelector('#profile-view')};
const labels={dashboard:['Overview','Dashboard'],courses:['Management','My Courses'],'course-details':['My Courses','Course Details'],students:['Management','Students'],attendance:['Attendance','Take Attendance'],history:['Attendance','History'],reports:['Analytics','Reports'],profile:['Account','Profile']};
const simpleRoutes=new Set(['dashboard','courses','students','attendance','history','reports','profile']);
let coursesPage,studentsPage,attendancePage,historyPage,reportsPage,profilePage,currentView='dashboard',authenticated=false,pendingNavigation=null;

const closeNav=()=>{sidebar.classList.remove('open');backdrop.classList.remove('show');};
const parseRoute=()=>{
  const hash=location.hash||'#/dashboard',detail=hash.match(/^#\/courses\/([^/?#]+)$/);
  if(detail){try{const id=decodeURIComponent(detail[1]);return store.course(id)?{view:'course-details',id,hash:`#/courses/${encodeURIComponent(id)}`} : null;}catch{return null;}}
  const match=hash.match(/^#\/([^/?#]+)\/?$/);return match&&simpleRoutes.has(match[1])?{view:match[1],hash:`#/${match[1]}`} : null;
};
const renderRoute=async route=>{
  if(!authenticated)return;Object.entries(views).forEach(([name,element])=>element.hidden=name!==route.view);currentView=route.view;
  document.querySelectorAll('[data-page]').forEach(element=>element.classList.toggle('active',element.dataset.page===(route.view==='course-details'?'courses':route.view)));document.querySelector('#breadcrumb-parent').textContent=labels[route.view][0];document.querySelector('#breadcrumb-current').textContent=labels[route.view][1];
  const options=pendingNavigation?.hash===route.hash?pendingNavigation.options:undefined;pendingNavigation=null;
  if(route.view==='dashboard'){await Promise.all([loadAttendance(),loadReports()]);renderDashboard();}if(route.view==='courses')coursesPage.renderList();if(route.view==='course-details')coursesPage.showDetails(route.id);if(route.view==='students')studentsPage.render();if(route.view==='attendance')attendancePage.show(options||{});if(route.view==='history')historyPage.render();if(route.view==='reports')reportsPage.render();if(route.view==='profile')profilePage.render();closeNav();window.scrollTo(0,0);
};
const applyRoute=()=>{const route=parseRoute();if(route)return renderRoute(route);history.replaceState(null,'','#/dashboard');renderRoute({view:'dashboard',hash:'#/dashboard'});};
const navigate=(view,options)=>{const hash=view==='course-details'&&typeof options==='string'?`#/courses/${encodeURIComponent(options)}`:`#/${view}`;pendingNavigation={hash,options};if(location.hash===hash)applyRoute();else location.hash=hash;};
const showApp=()=>{authenticated=true;login.hidden=true;app.hidden=false;applyRoute();};
const showLogin=()=>{authenticated=false;app.hidden=true;login.hidden=false;document.querySelector('#email').focus();window.lucide?.createIcons();};
window.addEventListener('auth:unauthorized',()=>{store.logout();showLogin();});

const loadApplicationData=async()=>{await loadManagementData();await Promise.all([loadAttendance(),loadReports()]);};
initAuth({onLogin:async()=>{const data=await api('/api/auth/me');store.setAuthenticatedUser(data.user);await loadApplicationData();renderAccount();showApp();},onLogout:showLogin});
coursesPage=initCourses({navigate});studentsPage=initStudents();attendancePage=initAttendance();historyPage=initHistory({editSession:(courseId,date)=>navigate('attendance',{courseId,date})});reportsPage=initReports();profilePage=initProfile();
store.subscribe(change=>{if(app.hidden||change.type!=='management')return;if(currentView==='dashboard')renderDashboard();if(currentView==='courses')coursesPage.renderList();if(currentView==='course-details')coursesPage.refreshDetails();if(currentView==='students')studentsPage.render();});
document.addEventListener('open-attendance',event=>navigate('attendance',event.detail));document.querySelectorAll('[data-page]').forEach(element=>element.addEventListener('click',()=>navigate(element.dataset.page)));document.querySelectorAll('[data-page-link]').forEach(element=>element.addEventListener('click',()=>navigate(element.dataset.pageLink)));document.querySelector('#export-report').addEventListener('click',exportSemesterCsv);
document.querySelector('#open-nav').addEventListener('click',()=>{sidebar.classList.add('open');backdrop.classList.add('show');});document.querySelector('#close-nav').addEventListener('click',closeNav);backdrop.addEventListener('click',closeNav);window.addEventListener('hashchange',applyRoute);
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(app.hidden)return;if(currentView==='dashboard')redrawCharts();if(currentView==='reports')reportsPage.redraw();},120);});
function renderAccount(){document.querySelector('#teacher-name').textContent=store.data.teacher.name;document.querySelector('#teacher-dept').textContent=store.data.teacher.department;}window.lucide?.createIcons();
if(!parseRoute())history.replaceState(null,'','#/dashboard');
try{const data=await api('/api/auth/me');store.setAuthenticatedUser(data.user);await loadApplicationData();renderAccount();showApp();}catch{showLogin();}
