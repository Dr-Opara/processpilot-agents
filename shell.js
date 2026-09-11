import {openExecutiveDrawer} from './pages/executive.js';

export function initShell(){
  const toggle=document.getElementById('sidebarToggle');
  const sidebar=document.getElementById('sideNav');
  const app=document.querySelector('.app');
  if(toggle&&sidebar&&app){
    let collapsed=localStorage.getItem('pp_sidebar_collapsed')==='1';
    const apply=()=>{
      sidebar.classList.toggle('collapsed',collapsed);
      app.classList.toggle('sidebar-collapsed',collapsed);
      toggle.setAttribute('aria-expanded',String(!collapsed));
    };
    apply();
    toggle.onclick=()=>{collapsed=!collapsed;localStorage.setItem('pp_sidebar_collapsed',collapsed?'1':'0');apply();};
  }

  const decisionsTrigger=document.getElementById('decisionsTrigger');
  if(decisionsTrigger)decisionsTrigger.onclick=()=>openExecutiveDrawer();
}
