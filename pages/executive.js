import {getApprovals,esc,fmtDateTime} from '../client-data.js';
import {toast} from '../toast.js';

const TYPE_LABEL={
  pursuit_decision:'Pursuit Decision',
  proposal_submission:'Proposal Submission',
  pricing_commitment:'Pricing Commitment',
  contract_acceptance:'Contract Acceptance',
  external_outreach:'External Outreach',
};

let sessionUser=null;
let initialized=false;

async function checkSession(){
  try{
    const r=await fetch('/api/auth/session',{cache:'no-store'});
    const data=await r.json();
    sessionUser=data.authenticated?data.user:null;
  }catch{sessionUser=null;}
  return sessionUser;
}

function openDrawer(){document.getElementById('execDrawer').classList.add('open');document.getElementById('execBackdrop').classList.add('open');}
export function closeExecutiveDrawer(){document.getElementById('execDrawer').classList.remove('open');document.getElementById('execBackdrop').classList.remove('open');}

export async function openExecutiveDrawer(){
  ensureWired();
  openDrawer();
  const body=document.getElementById('execBody');
  const actorEl=document.getElementById('execActor');
  body.innerHTML='<div class="page-loading">Loading…</div>';
  await checkSession();
  actorEl.textContent=sessionUser?`Signed in as ${sessionUser.email}`:'Not signed in';
  if(!sessionUser){
    body.innerHTML=`<div class="auth-gate"><p>Sign in as the ProcessPilot owner to review and decide pending approvals. Decision counts remain visible without signing in, but decision content and actions require an authenticated owner session.</p><a class="btn btn-approve" href="/login.html?return_to=${encodeURIComponent(location.pathname)}">Sign in</a></div>`;
    return;
  }
  await refresh(body);
}

async function refresh(body){
  body.innerHTML='<div class="page-loading">Loading…</div>';
  try{
    const approvals=(await getApprovals()).filter((a)=>a.status==='pending');
    renderApprovals(body,approvals);
  }catch(e){
    body.innerHTML=`<div class="page-error"><p>Could not load approvals: ${esc(e.message)}</p></div>`;
  }
}

function renderApprovals(body,approvals){
  if(!approvals.length){
    body.innerHTML='<div class="empty-state"><b>No pending decisions</b>Nothing is waiting on executive review right now.</div>';
    return;
  }
  body.innerHTML=approvals.map((a)=>`
    <div class="card" data-approval="${esc(a.id)}">
      <h3>${esc(TYPE_LABEL[a.approval_type]||a.approval_type||'Decision')}</h3>
      <b style="display:block;margin-bottom:6px;color:#eafaff">${esc(a.title)}</b>
      <p style="margin:0 0 8px;color:#b9d3e4;font-size:12.5px">${esc(a.summary||'No summary provided.')}</p>
      <small style="color:#6e91a7">Requested ${esc(fmtDateTime(a.created_at))} by ${esc(a.requested_by_agent_id||'—')}</small>
      <div class="btn-row">
        <button class="btn btn-approve" data-act="approved">Approve</button>
        <button class="btn btn-decline" data-act="declined">Decline</button>
        <button class="btn btn-return" data-act="returned">Return for Revision</button>
      </div>
    </div>`).join('');
  body.querySelectorAll('[data-act]').forEach((btn)=>{
    btn.onclick=()=>decide(btn.closest('[data-approval]').dataset.approval,btn.dataset.act,body,btn);
  });
}

async function decide(approvalId,decision,body,btn){
  let note='';
  if(decision!=='approved'){note=window.prompt('Optional note for this decision:')||'';}
  const row=btn.closest('.card');
  row.querySelectorAll('button').forEach((b)=>{b.disabled=true;});
  try{
    const r=await fetch('/api/actions/approval',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({approval_id:approvalId,decision,note})});
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||'Decision failed');
    toast(`Decision recorded: ${decision}`);
    await refresh(body);
  }catch(e){
    toast(e.message,true);
    row.querySelectorAll('button').forEach((b)=>{b.disabled=false;});
  }
}

function ensureWired(){
  if(initialized)return;
  initialized=true;
  document.getElementById('execClose').onclick=closeExecutiveDrawer;
  document.getElementById('execBackdrop').onclick=closeExecutiveDrawer;
  document.addEventListener('keydown',(e)=>{if(e.key==='Escape')closeExecutiveDrawer();});
}

// Registered as a real route (/executive) for deep-linking (command
// palette, notification badge) even though it's presented as a drawer
// rather than replacing the routed-view content underneath it.
export async function render(container){
  container.innerHTML='<div class="page-header"><div><span class="breadcrumb">ProcessPilot</span><h1>Executive Command</h1><p>Pending decisions open in the panel on the right.</p></div></div>';
  await openExecutiveDrawer();
  return closeExecutiveDrawer;
}
