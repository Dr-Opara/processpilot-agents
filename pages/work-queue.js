import {getWorkPackets,getOpportunities,esc,fmtDateTime,statusPillClass,statusLabel,isSignInError,signInGateHtml} from '../client-data.js';

const STATES=['queued','running','waiting_input','waiting_approval','completed','failed','cancelled'];

export async function render(container){
  container.innerHTML=`
    <div class="page-header"><div><span class="breadcrumb">ProcessPilot</span><h1>Work Queue</h1><p>Every real work packet the agent runtime has created, with its current stage and assigned agent.</p></div></div>
    <div class="filter-bar">
      <input type="search" id="wqSearch" placeholder="Search workflow, agent, stage…">
      <select id="wqStatus"><option value="all">All statuses</option>${STATES.map((s)=>`<option value="${s}">${esc(statusLabel(s))}</option>`).join('')}</select>
    </div>
    <div id="wqWrap"></div>`;

  let work=[],opportunities=[];
  try{
    [work,opportunities]=await Promise.all([getWorkPackets(),getOpportunities().catch(()=>[])]);
  }catch(e){
    if(isSignInError(e)){container.innerHTML=signInGateHtml('Sign in as the ProcessPilot owner to view the work queue.');return;}
    container.innerHTML+=`<div class="page-error">Could not load work packets: ${esc(e.message)}</div>`;return;
  }
  const oppTitle=(id)=>opportunities.find((o)=>o.id===id)?.title||'—';

  const filters={q:'',status:'all'};
  function draw(){
    const filtered=work.filter((w)=>{
      if(filters.status!=='all'&&w.status!==filters.status)return false;
      if(filters.q){
        const hay=`${w.workflow_id||''} ${w.current_agent_id||''} ${w.current_stage||''}`.toLowerCase();
        if(!hay.includes(filters.q.toLowerCase()))return false;
      }
      return true;
    });
    const wrap=container.querySelector('#wqWrap');
    if(!filtered.length){wrap.innerHTML='<div class="empty-state"><b>No work packets match these filters</b></div>';return;}
    wrap.innerHTML=`<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Opportunity</th><th>Workflow</th><th>Stage</th><th>Agent</th><th>Status</th><th>Priority</th><th>Created</th><th>Error</th></tr></thead>
      <tbody>${filtered.map((w)=>`<tr data-id="${esc(w.id)}">
        <td>${esc(oppTitle(w.opportunity_id))}</td>
        <td>${esc(w.workflow_id||'—')}</td>
        <td>${esc(w.current_stage||'—')}</td>
        <td>${esc(w.current_agent_id||'—')}</td>
        <td><span class="${statusPillClass(w.status)}"><i></i>${esc(statusLabel(w.status))}</span></td>
        <td>${w.priority??'—'}</td>
        <td>${fmtDateTime(w.created_at)}</td>
        <td>${w.error?`<span style="color:#ff8b8f">${esc(w.error).slice(0,60)}</span>`:'—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
    wrap.querySelectorAll('tbody tr').forEach((tr)=>{tr.onclick=()=>import('../router.js').then(({navigate})=>navigate(`/work-queue/${tr.dataset.id}`));});
  }
  container.querySelector('#wqSearch').addEventListener('input',(e)=>{filters.q=e.target.value.trim();draw();});
  container.querySelector('#wqStatus').addEventListener('change',(e)=>{filters.status=e.target.value;draw();});
  draw();
}
