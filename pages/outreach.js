import {getOutreachProspects,esc,fmtDateTime,statusPillClass,statusLabel,isSignInError,signInGateHtml} from '../client-data.js';

export async function render(container){
  container.innerHTML='<div class="page-loading">Loading…</div>';
  let prospects;
  try{ prospects=await getOutreachProspects(); }
  catch(e){
    if(isSignInError(e)){container.innerHTML=signInGateHtml('Sign in as the ProcessPilot owner to view outreach prospects.');return;}
    container.innerHTML=`<div class="page-error">${esc(e.message)}</div>`;return;
  }

  container.innerHTML=`
    <div class="page-header"><div><span class="breadcrumb">ProcessPilot</span><h1>Outreach</h1><p>Business-development prospects. External sends remain approval-gated through Executive Command; approved senders are eo@ and contracts@processpilottech.com.</p></div></div>
    <div class="metric-row">
      <div class="metric-card"><b>${prospects.length}</b><small>Total Prospects</small></div>
      <div class="metric-card"><b>${prospects.filter((p)=>p.status==='new').length}</b><small>New</small></div>
      <div class="metric-card"><b>${prospects.filter((p)=>p.status==='drafted').length}</b><small>Drafted</small></div>
      <div class="metric-card"><b>${prospects.filter((p)=>p.status==='contacted').length}</b><small>Contacted</small></div>
      <div class="metric-card"><b>${prospects.filter((p)=>p.status==='do_not_contact'||p.status==='invalid').length}</b><small>Suppressed</small></div>
    </div>
    <div id="prospectsWrap"></div>`;

  const wrap=container.querySelector('#prospectsWrap');
  if(!prospects.length){wrap.innerHTML='<div class="empty-state"><b>No outreach prospects yet</b>Qualified public-source contacts appear here once added by the Outreach Agent or governed intake.</div>';return;}
  wrap.innerHTML=`<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Organization</th><th>Contact</th><th>Market</th><th>Relevance</th><th>Status</th><th>Last Contact</th></tr></thead>
    <tbody>${prospects.map((p)=>`<tr>
      <td><b style="color:#eafaff">${esc(p.organization)}</b><br><small style="color:#6e91a7">${esc(p.email)}</small></td>
      <td>${esc(p.contact_name||'—')}${p.contact_title?` · ${esc(p.contact_title)}`:''}</td>
      <td>${esc(p.market||'—')}</td>
      <td style="max-width:280px">${esc(p.relevance_reason||'—')}</td>
      <td><span class="${statusPillClass(p.status)}"><i></i>${esc(statusLabel(p.status))}</span></td>
      <td>${fmtDateTime(p.last_contacted_at)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}
