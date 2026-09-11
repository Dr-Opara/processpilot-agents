import {getOpportunities,getArtifacts,esc,fmtDate,statusPillClass,statusLabel,isSignInError,signInGateHtml} from '../client-data.js';

const PROPOSAL_STATUSES=['research','pricing_review','proposal'];

export async function render(container){
  container.innerHTML='<div class="page-loading">Loading…</div>';
  let all;
  try{ all=await getOpportunities(); }
  catch(e){
    if(isSignInError(e)){container.innerHTML=signInGateHtml('Sign in as the ProcessPilot owner to view Proposal Studio.');return;}
    container.innerHTML=`<div class="page-error">${esc(e.message)}</div>`;return;
  }
  const active=all.filter((o)=>PROPOSAL_STATUSES.includes(o.status));

  container.innerHTML=`
    <div class="page-header"><div><span class="breadcrumb">ProcessPilot</span><h1>Proposal Studio</h1><p>Opportunities in active capture/research, pricing review, or final proposal development.</p></div></div>
    <div id="propWrap"></div>`;
  const wrap=container.querySelector('#propWrap');
  if(!active.length){wrap.innerHTML='<div class="empty-state"><b>No proposal is currently in development</b>Opportunities appear here once a pursuit decision is approved.</div>';return;}

  wrap.innerHTML=(await Promise.all(active.map(async(o)=>{
    let artifactCount=0;
    try{artifactCount=(await getArtifacts(o.id)).length;}catch{}
    return `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div><b style="color:#eafaff"><a href="/opportunities/${esc(o.id)}" data-route style="color:inherit;text-decoration:none">${esc(o.title)}</a></b>
        <p style="margin:4px 0;color:#8aa4b8;font-size:12px">${esc(o.agency||'—')} · Response due ${fmtDate(o.response_due_at)}</p></div>
        <span class="${statusPillClass(o.status)}"><i></i>${esc(statusLabel(o.status))}</span>
      </div>
      <small style="color:#6e91a7">${artifactCount} work product artifact${artifactCount===1?'':'s'} generated</small>
    </div>`;
  }))).join('');
}
