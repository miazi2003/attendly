import { store } from './state.js';
import { api, clearCsrfToken } from './api.js';

export function initAuth({onLogin,onLogout}) {
  const form=document.querySelector('#login-form'), email=form.email, password=form.password;
  const clear=()=>{ document.querySelectorAll('.field-error').forEach(el=>el.textContent=''); document.querySelector('#login-error').hidden=true; };
  form.addEventListener('submit', async e=>{
    e.preventDefault(); clear(); let valid=true;
    if(!email.value.trim()){ document.querySelector('#email-error').textContent='Email is required.'; valid=false; }
    else if(!/^\S+@\S+\.\S+$/.test(email.value)){ document.querySelector('#email-error').textContent='Enter a valid email address.'; valid=false; }
    if(!password.value){ document.querySelector('#password-error').textContent='Password is required.'; valid=false; }
    if(!valid) return;
    const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.setAttribute('aria-busy','true');
    try { const data=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email:email.value.trim(),password:password.value})});store.setAuthenticatedUser(data.user);await onLogin();form.reset(); }
    catch(error) { const err=document.querySelector('#login-error');err.textContent=error.code==='INVALID_CREDENTIALS'?'Incorrect email or password.':error.message;err.hidden=false; }
    finally { submit.disabled=false;submit.removeAttribute('aria-busy'); }
  });
  document.querySelector('#toggle-password').addEventListener('click',e=>{ const show=password.type==='password'; password.type=show?'text':'password'; e.currentTarget.setAttribute('aria-label',show?'Hide password':'Show password'); e.currentTarget.innerHTML=`<i data-lucide="${show?'eye-off':'eye'}"></i>`; window.lucide?.createIcons(); });
  document.querySelector('#logout-button').addEventListener('click',async()=>{ try{await api('/api/auth/logout',{method:'POST'});}catch(error){console.warn('Server logout failed',error);}finally{clearCsrfToken();store.logout();onLogout();} });
}
