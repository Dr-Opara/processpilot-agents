import {getOpportunityById,getArtifacts,getAgentRuns,getApprovals,getEvents,esc,fmtDate,fmtDateTime,fmtMoney,statusPillClass,statusLabel,isSignInError,signInGateHtml} from '../client-data.js';

const ARTIFACT_GROUP={
  'agency-researcher':'Research','incumbent-researcher':'Research','partner-researcher':'Research',
  'requirements-analyst':'Requirements','compliance-matrix':'Compliance','clause-analyst':'Compliance','registration-analyst':'Compliance',
  'proposal-manager':'Proposal','proposal-writer':'Proposal','technical-writer':'Proposal','executive-writer':'Proposal','proposal-reviewer':'Proposal','past-performance':'Proposal',
  'pricing-analyst':'Pricing','margin-reviewer':'Pricing',
  'contracts-reviewer':'Contracts','delivery-manager':'Delivery','performance-analyst':'Delivery',
  'opportunity-analyst':'Qualification','fit-scorer':'Qualification','bid-no-bid':'Qualification','capture-analyst':'Capture','deadline-monitor':'Capture',
};

function emptyTab(msg){return `<div class="empty-state">${esc(msg)}</div>`;}

function overviewTab(o){
  return `<div class="detail-grid">
    <div>
      <div class="card"><h3>Solicitation</h3><dl>
        <dt>Agency</dt><dd>${esc(o.agency||'—')}</dd>
        <dt>Jurisdiction</dt><dd>${esc((o.jurisdiction||'—').toUpperCase())}</dd>
        <dt>Market</dt><dd>${esc(o.metadata?.market||'—')}</dd>
        <dt>Source</dt><dd>${o.source_url?`<a href="${esc(o.source_url)}" target="_blank" rel="noopener">${esc(o.source_name||o.source_url)}</a>`:'—'}</dd>
        <dt>Solicitation type</dt><dd>${esc(o.solicitation_type||'—')}</dd>
        <dt>NAICS</dt><dd>${esc(o.naics||'—')}</dd>
        <dt>Set-aside</dt><dd>${esc(o.set_aside||'—')}</dd>
        <dt>Posted</dt><dd>${fmtDate(o.posted_at)}</dd>
        <dt>Questions due</dt><dd>${fmtDate(o.questions_due_at)}</dd>
        <dt>Response due</dt><dd>${fmtDate(o.response_due_at)}</dd>
        <dt>Estimated value</dt><dd>${fmtMoney(o.estimated_value)}</dd>
      </dl></div>
      <div class="card"><h3>Description</h3><p style="margin:0;color:#c7deee;font-size:12.5px;line-height:1.6">${o.description?esc(o.description):'<i>No description captured for this opportunity.</i>'}</p></div>
    </div>
    <div>
      <div class="card"><h3>Status</h3><dl>
        <dt>Stage</dt><dd><span class="${statusPillClass(o.status)}"><i></i>${esc(statusLabel(o.status||'discovered'))}</span></dd>
        <dt>Fit score</dt><dd>${o.fit_score!=null?Math.round(Number(o.fit_score)):'Not yet scored'}</dd>
        <dt>Discovered</dt><dd>${fmtDateTime(o.created_at)}</dd>
        <dt>Last updated</dt><dd>${fmtDateTime(o.updated_at)}</dd>
      </dl></div>
      ${o.fit_rationale?`<div class="card"><h3>Fit Rationale</h3><p style="margin:0;color:#c7deee;font-size:12.5px;line-height:1.6">${esc(o.fit_rationale)}</p></div>`:''}
    </div>
  </div>`;
}

function artifactCard(a){
  const summary=typeof a.content==='object'?(a.content?.summary||a.content?.recommendation||JSON.stringify(a.content).slice(0,240)):String(a.content||'');
  return `<div class="card"><h3>${esc(a.title||a.artifact_type||'Artifact')}</h3>
    <p style="margin:0 0 8px;color:#c7deee;font-size:12.5px;line-height:1.6">${esc(summary)||'<i>No summary content.</i>'}</p>
    <small style="color:#6e91a7">v${a.version||1} · ${esc(a.status||'draft')} · ${fmtDateTime(a.created_at)}</small>
  </div>`;
}

function workProductTab(artifacts){
  if(!artifacts.length)return emptyTab('No work product has been produced for this opportunity yet.');
  const groups={};
  artifacts.forEach((a)=>{const g=ARTIFACT_GROUP[a.artifact_type]||'Other';(groups[g]=groups[g]||[]).push(a);});
  return Object.entries(groups).map(([group,items])=>`
    <h3 style="margin:18px 0 8px;font-size:11px;letter-spacing:.08em;color:#7fd8ff;text-transform:uppercase">${esc(group)}</h3>
    ${items.map(artifactCard).join('')}
  `).join('');
}

function approvalsTab(approvals){
  if(!approvals.length)return emptyTab('No approval has been requested for this opportunity yet.');
  return approvals.map((a)=>`<div class="card">
    <h3>${esc((a.approval_type||'').replace(/_/g,' '))}</h3>
    <b style="display:block;color:#eafaff">${esc(a.title)}</b>
    <p style="margin:6px 0;color:#c7deee;font-size:12.5px">${esc(a.summary||'')}</p>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
      <span class="${statusPillClass(a.status)}"><i></i>${esc(statusLabel(a.status))}</span>
      <small style="color:#6e91a7">${fmtDateTime(a.created_at)}${a.decided_at?` → decided ${fmtDateTime(a.decided_at)} by ${esc(a.decision_by||'—')}`:''}</small>
    </div>
  </div>`).join('');
}

function agentRunsTab(runs){
  if(!runs.length)return emptyTab('No agent has executed work on this opportunity yet.');
  return `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Agent</th><th>Department</th><th>Status</th><th>Started</th><th>Completed</th></tr></thead>
    <tbody>${runs.map((r)=>`<tr><td>${esc(r.agent_id)}</td><td>${esc(r.department||'—')}</td><td><span class="${statusPillClass(r.status)}"><i></i>${esc(statusLabel(r.status))}</span></td><td>${fmtDateTime(r.started_at)}</td><td>${fmtDateTime(r.completed_at)}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

function timelineTab(events){
  if(!events.length)return emptyTab('No verified activity has been recorded for this opportunity yet.');
  return `<div class="card">${events.map((e)=>`<div style="display:grid;grid-template-columns:110px 1fr;gap:10px;padding:8px 0;border-top:1px solid #102e42;font-size:12px"><time style="color:#718fa4">${fmtDateTime(e.created_at)}</time><span>${esc(e.message)}</span></div>`).join('')}</div>`;
}

const TABS=[
  {key:'overview',label:'Overview'},
  {key:'work',label:'Work Product'},
  {key:'approvals',label:'Approvals'},
  {key:'runs',label:'Agent Runs'},
  {key:'timeline',label:'Activity Timeline'},
];

export async function render(container,{id}){
  container.innerHTML='<div class="page-loading">Loading…</div>';
  let opportunity;
  try{
    opportunity=await getOpportunityById(id);
  }catch(e){
    if(isSignInError(e)){container.innerHTML=signInGateHtml('Sign in as the ProcessPilot owner to view this opportunity.');return;}
    container.innerHTML=`<div class="page-error">Could not load opportunity: ${esc(e.message)}</div>`;return;
  }
  if(!opportunity){container.innerHTML='<div class="empty-state"><b>Opportunity not found</b>It may have been removed or the link is incorrect.</div>';return;}

  container.innerHTML=`
    <div class="page-header">
      <div><span class="breadcrumb"><a href="/opportunities" data-route>Opportunities</a> / ${esc(opportunity.title||'Opportunity')}</span>
      <h1>${esc(opportunity.title||'Untitled opportunity')}</h1>
      <p>${esc(opportunity.agency||'Agency unknown')} · ${esc((opportunity.jurisdiction||'—').toUpperCase())}</p></div>
    </div>
    <div class="tab-strip">${TABS.map((t,i)=>`<button data-tab="${t.key}" class="${i===0?'active':''}">${esc(t.label)}</button>`).join('')}</div>
    ${TABS.map((t,i)=>`<div class="tab-panel" data-panel="${t.key}" ${i===0?'':'hidden'}></div>`).join('')}
  `;

  const panels={};
  TABS.forEach((t)=>{panels[t.key]=container.querySelector(`[data-panel="${t.key}"]`);});
  panels.overview.innerHTML=overviewTab(opportunity);

  container.querySelectorAll('.tab-strip button').forEach((btn)=>{
    btn.onclick=async()=>{
      container.querySelectorAll('.tab-strip button').forEach((b)=>b.classList.toggle('active',b===btn));
      Object.values(panels).forEach((p)=>{p.hidden=true;});
      const panel=panels[btn.dataset.tab];panel.hidden=false;
      if(panel.dataset.loaded)return;
      panel.dataset.loaded='1';
      try{
        if(btn.dataset.tab==='work')panel.innerHTML=workProductTab(await getArtifacts(id));
        else if(btn.dataset.tab==='approvals')panel.innerHTML=approvalsTab((await getApprovals()).filter((a)=>a.opportunity_id===id));
        else if(btn.dataset.tab==='runs')panel.innerHTML=agentRunsTab(await getAgentRuns(id));
        else if(btn.dataset.tab==='timeline')panel.innerHTML=timelineTab((await getEvents()).filter((e)=>e.opportunity_id===id));
      }catch(e){panel.innerHTML=`<div class="page-error">${esc(e.message)}</div>`;}
    };
  });
}
