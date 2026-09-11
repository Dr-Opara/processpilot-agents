import {getAgentsRegistry,getStatus,esc,statusPillClass,statusLabel} from '../client-data.js';

const REGION_AGENTS=[
  {id:'region-TX',name:'Texas Procurement Agent',department:'Regional Sourcing'},
  {id:'region-DC',name:'DC Procurement Agent',department:'Regional Sourcing'},
  {id:'region-MD',name:'Maryland Procurement Agent',department:'Regional Sourcing'},
  {id:'region-VA',name:'Virginia Procurement Agent',department:'Regional Sourcing'},
];

function agentState(states,id){return states?.[id]||'live_idle';}

export async function render(container){
  container.innerHTML='<div class="page-loading">Loading…</div>';
  let registry,status;
  try{
    [registry,status]=await Promise.all([getAgentsRegistry(),getStatus().catch(()=>null)]);
  }catch(e){
    container.innerHTML=`<div class="page-error">Could not load the agent registry: ${esc(e.message)}</div>`;return;
  }
  const agents=registry.agents||[];
  const states=status?.agentStates||{};
  const byDept={};
  agents.forEach((a)=>{(byDept[a.department]=byDept[a.department]||[]).push(a);});

  container.innerHTML=`
    <div class="page-header"><div><span class="breadcrumb">ProcessPilot</span><h1>AI Workforce</h1><p>${agents.length} registered specialist agents across ${Object.keys(byDept).length} departments, plus 4 regional sourcing agents visible on the Live Office floor.</p></div></div>
    <div class="metric-row">
      <div class="metric-card"><b>${agents.length+REGION_AGENTS.length}</b><small>Total Agents</small></div>
      <div class="metric-card"><b>${Object.values(states).filter((s)=>s==='working').length}</b><small>Working Now</small></div>
      <div class="metric-card"><b>${Object.values(states).filter((s)=>s==='awaiting_approval').length}</b><small>Awaiting Approval</small></div>
      <div class="metric-card"><b>${Object.values(states).filter((s)=>s==='blocked').length}</b><small>Blocked</small></div>
    </div>
    <div id="deptWrap"></div>`;

  const wrap=container.querySelector('#deptWrap');
  wrap.innerHTML=Object.entries(byDept).map(([dept,members])=>`
    <h3 style="margin:20px 0 8px;font-size:11px;letter-spacing:.08em;color:#7fd8ff;text-transform:uppercase">${esc(dept)} <small style="color:#6e91a7;text-transform:none;letter-spacing:0">(${members.length})</small></h3>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Agent</th><th>Mission</th><th>Runtime State</th></tr></thead>
      <tbody>${members.map((a)=>{const st=agentState(states,a.id);return `<tr data-id="${esc(a.id)}"><td><b style="color:#eafaff">${esc(a.name)}</b><br><small style="color:#6e91a7">${esc(a.id)}</small></td><td style="max-width:420px">${esc(a.mission)}</td><td><span class="${statusPillClass(st)}"><i></i>${esc(statusLabel(st))}</span></td></tr>`;}).join('')}</tbody>
    </table></div>`).join('');

  wrap.querySelectorAll('tbody tr').forEach((tr)=>{tr.onclick=()=>import('../router.js').then(({navigate})=>navigate(`/agents/${tr.dataset.id}`));});
}
