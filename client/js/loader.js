const templates={login:'pages/login.html',dashboard:'pages/dashboard.html',courses:'pages/courses.html','course-details':'pages/course-details.html',students:'pages/students.html',attendance:'pages/attendance.html',history:'pages/history.html',reports:'pages/reports.html',profile:'pages/profile.html'};

export async function loadTemplates(){
  const entries=await Promise.all(Object.entries(templates).map(async([name,path])=>{const response=await fetch(path);if(!response.ok)throw new Error(`Unable to load ${path}`);return [name,await response.text()];}));
  const pages=Object.fromEntries(entries);document.querySelector('#login-root').innerHTML=pages.login;document.querySelector('#page-root').innerHTML=Object.entries(pages).filter(([name])=>name!=='login').map(([,html])=>html).join('');
}
