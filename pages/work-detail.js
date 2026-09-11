import {getWorkPacketById,getOpportunityById,getArtifacts,getAgentRuns,getApprovals,esc,fmtDateTime,statusPillClass,statusLabel,isSignInError,signInGateHtml} from '../client-data.js';

export async function render(container,{id}){
  container.innerHTML='<div class="page-loading">Loading…</div>';
  let packet;
  try{ packet=await getWorkPacketById(id); }
  catch(e){
    if(isSignInError(e)){container.innerHTML=signInGateHtml('Sign in as the ProcessPilot owner to view this work packet.');return;}
    container.innerHTML=`<div class="page-error">${esc(e.message)}</div>`;return;
  }
  if(!packet){container.innerHTML='<div class="empty-state"><b>Work packet not found</b></div>';return;}

  const [opportunity,artifacts,runs,approvals]=await Promise.all([
    packet.opportunity_id?getOpportunityById(packet.opportunity_id).catch(()=>null):null,
    getArtifacts(packet.opportunity_id).catch(()=>[]),
    getAgentRuns(packet.opportunity_id).catch(()=>[]),
    getApprovals().then((a)=>a.filter((x)=>x.work_packet_id===id)).catch(()=>[]),
  ]);

  container.innerHTML=`
    <div class="page-header">
      <div><span class="breadcrumb"><a href="/work-queue" data-route>Work Queue</a> / ${esc(packet.current_stage||'Work Packet')}</span>
      <h1>${esc(opportunity?.title||'Work packet')}</h1>
      <p>${esc(packet.workflow_id||'—')} · stage ${esc(packet.current_stage||'—')}</p></div>
    </div>
    <div class="detail-grid">
      <div>
        <div class="card"><h3>Status</h3><dl>
          <dt>Status</dt><dd><span class="${statusPillClass(packet.status)}"><i></i>${esc(statusLabel(packet.status))}</span></dd>
          <dt>Current agent</dt><dd>${esc(packet.current_agent_id||'—')}</dd>
          <dt>Priority</dt><dd>${packet.priority??'—'}</dd>
          <dt>Created</dt><dd>${fmtDateTime(packet.created_at)}</dd>
          <dt>Started</dt><dd>${fmtDateTime(packet.started_at)}</dd>
          <dt>Completed</dt><dd>${fmtDateTime(packet.completed_at)}</dd>
          <dt>Error</dt><dd>${packet.error?esc(packet.error):'—'}</dd>
        </dl></div>
        <div class="card"><h3>Agent Runs</h3>${runs.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Agent</th><th>Status</th><th>Started</th><th>Completed</th></tr></thead><tbody>${runs.map((r)=>`<tr><td>${esc(r.agent_id)}</td><td><span class="${statusPillClass(r.status)}"><i></i>${esc(statusLabel(r.status))}</span></td><td>${fmtDateTime(r.started_at)}</td><td>${fmtDateTime(r.completed_at)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state">No agent has run on this work packet\'s opportunity yet.</div>'}</div>
        <div class="card"><h3>Artifacts</h3>${artifacts.length?artifacts.map((a)=>`<p style="margin:4px 0;font-size:12.5px"><b>${esc(a.title||a.artifact_type)}</b> · <small style="color:#6e91a7">${fmtDateTime(a.created_at)}</small></p>`).join(''):'<div class="empty-state">No artifacts produced yet.</div>'}</div>
      </div>
      <div>
        <div class="card"><h3>Input</h3><pre style="white-space:pre-wrap;font-size:11px;color:#9cb3c4;margin:0">${esc(JSON.stringify(packet.input||{},null,2))}</pre></div>
        ${packet.output&&Object.keys(packet.output).length?`<div class="card"><h3>Output</h3><pre style="white-space:pre-wrap;font-size:11px;color:#9cb3c4;margin:0">${esc(JSON.stringify(packet.output,null,2))}</pre></div>`:''}
        <div class="card"><h3>Approval History</h3>${approvals.length?approvals.map((a)=>`<p style="margin:4px 0;font-size:12.5px"><span class="${statusPillClass(a.status)}"><i></i>${esc(statusLabel(a.status))}</span> ${esc(a.title)}</p>`).join(''):'<div class="empty-state">No approval tied to this work packet.</div>'}</div>
      </div>
    </div>`;
}
