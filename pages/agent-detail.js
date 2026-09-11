import {getAgentById,getStatus,getAgentRuns,esc,fmtDateTime,statusPillClass,statusLabel,isSignInError} from '../client-data.js';

export async function render(container,{id}){
  container.innerHTML='<div class="page-loading">Loading…</div>';
  const [agent,status]=await Promise.all([getAgentById(id),getStatus().catch(()=>null)]);
  if(!agent){container.innerHTML='<div class="empty-state"><b>Agent not found</b></div>';return;}
  const state=status?.agentStates?.[id]||'live_idle';

  container.innerHTML=`
    <div class="page-header">
      <div><span class="breadcrumb"><a href="/agents" data-route>Agents</a> / ${esc(agent.name)}</span>
      <h1>${esc(agent.name)}</h1>
      <p>${esc(agent.department)} · <span class="${statusPillClass(state)}"><i></i>${esc(statusLabel(state))}</span></p></div>
    </div>
    <div class="detail-grid">
      <div>
        <div class="card"><h3>Mission</h3><p style="margin:0;color:#c7deee;font-size:12.5px;line-height:1.6">${esc(agent.mission)}</p></div>
        <div class="card"><h3>Inputs</h3><p style="margin:0;color:#c7deee;font-size:12.5px">${(agent.inputs||[]).map(esc).join(' · ')||'—'}</p></div>
        <div class="card"><h3>Outputs</h3><p style="margin:0;color:#c7deee;font-size:12.5px">${(agent.outputs||[]).map(esc).join(' · ')||'—'}</p></div>
        <div class="card"><h3>Tools</h3><p style="margin:0;color:#c7deee;font-size:12.5px">${(agent.tools||[]).map(esc).join(' · ')||'—'}</p></div>
        <div class="card"><h3>Handoff</h3><p style="margin:0;color:#c7deee;font-size:12.5px">${esc(agent.handoff||'—')}</p></div>
      </div>
      <div>
        <div class="card"><h3>Governance</h3><p style="margin:0;color:#c7deee;font-size:12.5px">${esc(agent.approval||'—')}</p></div>
        <div class="card" id="runsCard"><h3>Recent Runs</h3><div class="page-loading">Loading…</div></div>
      </div>
    </div>`;

  const runsCard=container.querySelector('#runsCard');
  try{
    const runs=await getAgentRuns();
    const mine=runs.filter((r)=>r.agent_id===id).slice(0,10);
    runsCard.innerHTML=`<h3>Recent Runs</h3>${mine.length?mine.map((r)=>`<p style="margin:4px 0;font-size:12px"><span class="${statusPillClass(r.status)}"><i></i>${esc(statusLabel(r.status))}</span> ${fmtDateTime(r.started_at)}</p>`).join(''):'<div class="empty-state">No verified execution recorded for this agent yet.</div>'}`;
  }catch(e){
    if(isSignInError(e)){runsCard.innerHTML='<h3>Recent Runs</h3><div class="empty-state">Sign in as the ProcessPilot owner to view execution history.<br><a class="btn btn-approve" style="display:inline-block;margin-top:10px" href="/login.html?return_to='+encodeURIComponent(location.pathname)+'">Sign in</a></div>';}
    else runsCard.innerHTML=`<h3>Recent Runs</h3><div class="page-error">${esc(e.message)}</div>`;
  }
}
