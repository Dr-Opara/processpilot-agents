import {getOpportunities,esc,fmtDate,fmtMoney,statusPillClass,statusLabel,isSignInError,signInGateHtml} from '../client-data.js';

const JURISDICTIONS=['TX','DC','MD','VA'];

function matches(o,filters){
  if(filters.jurisdiction&&filters.jurisdiction!=='all'){
    const j=(o.jurisdiction||'').toUpperCase();
    if(filters.jurisdiction==='other'){if(JURISDICTIONS.includes(j))return false;}
    else if(j!==filters.jurisdiction)return false;
  }
  if(filters.market&&filters.market!=='all'){
    const m=String(o.metadata?.market||'').toLowerCase();
    if(m!==filters.market)return false;
  }
  if(filters.status&&filters.status!=='all'&&o.status!==filters.status)return false;
  if(filters.q){
    const q=filters.q.toLowerCase();
    const hay=`${o.title||''} ${o.agency||''} ${o.source_name||''} ${o.description||''}`.toLowerCase();
    if(!hay.includes(q))return false;
  }
  return true;
}

function metricRow(list){
  const count=(s)=>list.filter((o)=>o.status===s).length;
  const cards=[
    ['Total',list.length],
    ['Qualified',list.filter((o)=>Number(o.fit_score)>=60).length],
    ['Pursuit Review',count('pursuit_review')],
    ['Proposal',count('proposal')],
    ['Submitted',count('submitted')],
    ['Awarded',count('awarded')],
    ['Declined',count('declined')],
  ];
  return `<div class="metric-row">${cards.map(([label,val])=>`<div class="metric-card"><b>${val}</b><small>${esc(label)}</small></div>`).join('')}</div>`;
}

function row(o){
  const status=o.status||'discovered';
  return `<tr data-id="${esc(o.id)}">
    <td><b style="color:#eafaff">${esc(o.title||'Untitled opportunity')}</b><br><small style="color:#6e91a7">${esc(o.source_name||'—')}</small></td>
    <td>${esc(o.agency||'—')}</td>
    <td>${esc((o.jurisdiction||'—').toUpperCase())}</td>
    <td>${esc(o.metadata?.market||'—')}</td>
    <td>${o.fit_score!=null?Math.round(Number(o.fit_score)):'—'}</td>
    <td>${fmtDate(o.response_due_at)}</td>
    <td>${fmtMoney(o.estimated_value)}</td>
    <td><span class="${statusPillClass(status)}"><i></i>${esc(statusLabel(status))}</span></td>
  </tr>`;
}

export async function render(container){
  container.innerHTML=`
    <div class="page-header">
      <div><span class="breadcrumb">ProcessPilot</span><h1>Opportunities</h1><p>Persisted procurement opportunities across TX, DC, MD, VA and approved non-federal sources.</p></div>
    </div>
    <div id="oppMetrics"></div>
    <div class="filter-bar">
      <input type="search" id="oppSearch" placeholder="Search title, agency, source…">
      <div class="chip-group" id="oppJurisdiction">
        ${['all','TX','DC','MD','VA','other'].map((j)=>`<button class="chip ${j==='all'?'active':''}" data-j="${j}">${j==='all'?'All':j==='other'?'Other':j}</button>`).join('')}
      </div>
      <select id="oppMarket">
        <option value="all">All markets</option>
        <option value="state">State</option>
        <option value="local">Local</option>
        <option value="private">Private</option>
        <option value="commercial">Commercial</option>
      </select>
      <select id="oppStatus"><option value="all">All statuses</option></select>
    </div>
    <div id="oppTableWrap"></div>`;

  let all=[];
  try{
    all=await getOpportunities();
  }catch(e){
    if(isSignInError(e)){container.querySelector('#oppMetrics').outerHTML=signInGateHtml('Sign in as the ProcessPilot owner to view the opportunity pipeline.');container.querySelector('#oppTableWrap')?.remove();document.querySelector('.filter-bar')?.remove();return;}
    container.innerHTML+=`<div class="page-error">Could not load opportunities: ${esc(e.message)}</div>`;return;
  }

  const statusSelect=container.querySelector('#oppStatus');
  const statuses=[...new Set(all.map((o)=>o.status).filter(Boolean))].sort();
  statusSelect.innerHTML+=statuses.map((s)=>`<option value="${esc(s)}">${esc(statusLabel(s))}</option>`).join('');

  const filters={jurisdiction:'all',market:'all',status:'all',q:''};

  function draw(){
    const filtered=all.filter((o)=>matches(o,filters));
    container.querySelector('#oppMetrics').innerHTML=metricRow(all);
    const wrap=container.querySelector('#oppTableWrap');
    if(!filtered.length){
      wrap.innerHTML='<div class="empty-state"><b>No opportunities match these filters</b>Try widening your search or clearing filters.</div>';
      return;
    }
    wrap.innerHTML=`<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Opportunity</th><th>Agency</th><th>Jurisdiction</th><th>Market</th><th>Fit</th><th>Response Due</th><th>Est. Value</th><th>Status</th></tr></thead>
      <tbody>${filtered.map(row).join('')}</tbody>
    </table></div>`;
    wrap.querySelectorAll('tbody tr').forEach((tr)=>{
      tr.onclick=()=>{ import('../router.js').then(({navigate})=>navigate(`/opportunities/${tr.dataset.id}`)); };
    });
  }

  container.querySelector('#oppSearch').addEventListener('input',(e)=>{filters.q=e.target.value.trim();draw();});
  container.querySelector('#oppMarket').addEventListener('change',(e)=>{filters.market=e.target.value;draw();});
  statusSelect.addEventListener('change',(e)=>{filters.status=e.target.value;draw();});
  container.querySelector('#oppJurisdiction').addEventListener('click',(e)=>{
    const btn=e.target.closest('[data-j]');if(!btn)return;
    filters.jurisdiction=btn.dataset.j;
    container.querySelectorAll('#oppJurisdiction .chip').forEach((c)=>c.classList.toggle('active',c===btn));
    draw();
  });

  draw();
}
