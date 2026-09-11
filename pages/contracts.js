import {getOpportunities,getApprovals,esc,fmtDate,statusPillClass,statusLabel,isSignInError,signInGateHtml} from '../client-data.js';

const CONTRACT_STATUSES=['contract_review','delivery','awarded'];

export async function render(container){
  container.innerHTML='<div class="page-loading">Loading…</div>';
  let all,approvals;
  try{ [all,approvals]=await Promise.all([getOpportunities(),getApprovals()]); }
  catch(e){
    if(isSignInError(e)){container.innerHTML=signInGateHtml('Sign in as the ProcessPilot owner to view Contracts & Delivery.');return;}
    container.innerHTML=`<div class="page-error">${esc(e.message)}</div>`;return;
  }
  const active=all.filter((o)=>CONTRACT_STATUSES.includes(o.status));

  container.innerHTML=`
    <div class="page-header"><div><span class="breadcrumb">ProcessPilot</span><h1>Contracts &amp; Delivery</h1><p>Award, contract review, contract-acceptance approval, and delivery kickoff. Contract acceptance always requires executive approval -- the system never auto-accepts.</p></div></div>
    <div id="contractsWrap"></div>`;
  const wrap=container.querySelector('#contractsWrap');
  if(!active.length){wrap.innerHTML='<div class="empty-state"><b>No opportunity is in contract review or delivery</b>Opportunities enter this stage once an award/contract notice is recorded.</div>';return;}

  wrap.innerHTML=active.map((o)=>{
    const gate=approvals.find((a)=>a.opportunity_id===o.id&&a.approval_type==='contract_acceptance');
    return `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div><b style="color:#eafaff"><a href="/opportunities/${esc(o.id)}" data-route style="color:inherit;text-decoration:none">${esc(o.title)}</a></b>
        <p style="margin:4px 0;color:#8aa4b8;font-size:12px">${esc(o.agency||'—')}</p></div>
        <span class="${statusPillClass(o.status)}"><i></i>${esc(statusLabel(o.status))}</span>
      </div>
      <small style="color:#6e91a7">${gate?`Contract acceptance: ${statusLabel(gate.status)}`:'No contract-acceptance decision recorded yet.'}</small>
    </div>`;
  }).join('');
}
