import {getOpportunities,getWorkPackets,getApprovals,getAgentRuns,getSources,esc,isSignInError,signInGateHtml} from '../client-data.js';

function bar(label,value,max){
  const pct=max?Math.round((value/max)*100):0;
  return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:11px;color:#9cb3c4;margin-bottom:3px"><span>${esc(label)}</span><b style="color:#eafaff">${value}</b></div><div style="height:6px;border-radius:4px;background:#0e2334"><div style="height:100%;border-radius:4px;width:${pct}%;background:linear-gradient(90deg,#1ed8ff,#29e6a1)"></div></div></div>`;
}

export async function render(container){
  container.innerHTML='<div class="page-loading">Loading…</div>';
  let opportunities,work,approvals,runs,sources;
  try{
    [opportunities,work,approvals,runs,sources]=await Promise.all([
      getOpportunities(),getWorkPackets(),getApprovals(),getAgentRuns(),getSources().catch(()=>[]),
    ]);
  }catch(e){
    if(isSignInError(e)){container.innerHTML=signInGateHtml('Sign in as the ProcessPilot owner to view analytics.');return;}
    container.innerHTML=`<div class="page-error">${esc(e.message)}</div>`;return;
  }

  const byJurisdiction={};
  opportunities.forEach((o)=>{const j=(o.jurisdiction||'Other').toUpperCase();byJurisdiction[j]=(byJurisdiction[j]||0)+1;});
  const bySource={};
  opportunities.forEach((o)=>{const s=o.source_name||'Unknown';bySource[s]=(bySource[s]||0)+1;});
  const fitScores=opportunities.map((o)=>Number(o.fit_score)).filter((n)=>Number.isFinite(n));
  const avgFit=fitScores.length?Math.round(fitScores.reduce((a,b)=>a+b,0)/fitScores.length):null;
  const decided=approvals.filter((a)=>a.status!=='pending');
  const approvedCount=approvals.filter((a)=>a.status==='approved').length;
  const submitted=opportunities.filter((o)=>o.status==='submitted'||o.status==='proposal').length;
  const awarded=opportunities.filter((o)=>o.status==='awarded').length;
  const declined=opportunities.filter((o)=>o.status==='declined').length;
  const closedCount=awarded+declined;
  const winRate=closedCount>=3?Math.round((awarded/closedCount)*100):null;
  const failedRuns=runs.filter((r)=>r.status==='failed').length;
  const failureRate=runs.length?Math.round((failedRuns/runs.length)*100):0;
  const maxJ=Math.max(1,...Object.values(byJurisdiction));
  const maxS=Math.max(1,...Object.values(bySource));
  const dueSoon=opportunities.filter((o)=>{
    if(!o.response_due_at)return false;
    const days=(new Date(o.response_due_at)-Date.now())/86400000;
    return days>=0&&days<=14;
  });

  container.innerHTML=`
    <div class="page-header"><div><span class="breadcrumb">ProcessPilot</span><h1>Analytics</h1><p>Computed directly from persisted production records -- no simulated history.</p></div></div>
    <div class="metric-row">
      <div class="metric-card"><b>${opportunities.length}</b><small>Opportunities</small></div>
      <div class="metric-card"><b>${avgFit??'—'}</b><small>Avg Fit Score</small></div>
      <div class="metric-card"><b>${approvals.filter((a)=>a.status==='pending').length}</b><small>Pending Approvals</small></div>
      <div class="metric-card"><b>${decided.length}</b><small>Decisions Made</small></div>
      <div class="metric-card"><b>${approvedCount}</b><small>Approved</small></div>
      <div class="metric-card"><b>${submitted}</b><small>Proposal / Submitted</small></div>
      <div class="metric-card"><b>${awarded}</b><small>Awarded</small></div>
      <div class="metric-card"><b>${winRate!=null?winRate+'%':'Not enough data'}</b><small>Win Rate</small></div>
      <div class="metric-card"><b>${runs.length}</b><small>Agent Executions</small></div>
      <div class="metric-card"><b>${failureRate}%</b><small>Agent Failure Rate</small></div>
      <div class="metric-card"><b>${work.filter((w)=>['queued','running','waiting_input','waiting_approval'].includes(w.status)).length}</b><small>Active Work</small></div>
      <div class="metric-card"><b>${dueSoon.length}</b><small>Due Within 14 Days</small></div>
    </div>
    <div class="detail-grid">
      <div class="card"><h3>Opportunities by Jurisdiction</h3>${Object.keys(byJurisdiction).length?Object.entries(byJurisdiction).sort((a,b)=>b[1]-a[1]).map(([j,v])=>bar(j,v,maxJ)).join(''):'<div class="empty-state">No opportunities recorded yet.</div>'}</div>
      <div class="card"><h3>Opportunities by Source</h3>${Object.keys(bySource).length?Object.entries(bySource).sort((a,b)=>b[1]-a[1]).map(([s,v])=>bar(s,v,maxS)).join(''):'<div class="empty-state">No opportunities recorded yet.</div>'}</div>
    </div>
    <div class="card"><h3>Source Health</h3>${sources.length?sources.map((s)=>bar(s.name||s.code,s.last_success_at?1:0,1)).join(''):'<div class="empty-state">No source registry data yet.</div>'}</div>
  `;
}
