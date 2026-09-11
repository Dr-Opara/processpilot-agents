let registry={agents:[]},runtime=null;
const $=s=>document.querySelector(s);
const COLORS=['#27d8ff','#5b9cff','#9a72ff','#2ee69f','#f2c14e','#ff7a59','#ff62c7'];
const SOURCE_ROWS=[['Gmail (RFP Intake)','gmail'],['Texas ESBD','procurementFeeds'],['DC OCP','procurementFeeds'],['Maryland eMMA','procurementFeeds'],['Virginia eVA','procurementFeeds'],['Private / Commercial','procurementFeeds']];
const SPOTS=[
  [50,84,1.18],[34,80,1.1],[67,80,1.1],[22,73,1.02],[78,73,1.02],
  [44,70,.98],[57,70,.98],[30,64,.92],[70,64,.92],[15,61,.88],[85,61,.88],
  [40,58,.84],[60,58,.84],[25,53,.79],[75,53,.79],[49,52,.78],[34,48,.74],[66,48,.74],
  [19,44,.7],[81,44,.7],[43,41,.68],[57,41,.68],[29,37,.64],[71,37,.64],
  [13,33,.6],[87,33,.6],[38,31,.58],[62,31,.58],[24,28,.55],[76,28,.55]
];
async function json(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${url}: ${r.status}`);return r.json()}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function state(id){return runtime?.agentStates?.[id]||'live_idle'}
function stateLabel(id){return({working:'Working now',awaiting_approval:'Awaiting approval',live_idle:'Live · monitoring',blocked:'Blocked'})[state(id)]||'Live · monitoring'}
function stateNote(id){return({working:'Executing a verified assignment',awaiting_approval:'Paused at a governed decision gate',live_idle:'Runtime-ready and monitoring for work',blocked:'Requires integration or configuration attention'})[state(id)]||'Runtime-ready'}
function agentById(id){return registry.agents.find(a=>a.id===id)}
function recentEventFor(id){return (runtime?.events||[]).find(e=>e.agent_id===id)}
function stationMarkup(a,i){
  const s=state(a.id),color=COLORS[i%COLORS.length],recent=recentEventFor(a.id);
  const screenText=s==='working'?'EXECUTING':s==='awaiting_approval'?'REVIEW':s==='blocked'?'BLOCKED':'MONITORING';
  return `<button class="agent-station ${s}" data-agent="${a.id}" style="--x:${SPOTS[i][0]}%;--y:${SPOTS[i][1]}%;--scale:${SPOTS[i][2]};--agent:${color};--delay:${(i%8)*-.42}s" aria-label="${escapeHtml(a.name)} — ${stateLabel(a.id)}">
    <span class="station-shadow"></span>
    <span class="desk-shell"><i class="desk-rim"></i><i class="desk-light"></i></span>
    <span class="holo-screen"><i class="scanline"></i><b>${screenText}</b><em>${String(i+1).padStart(2,'0')}</em></span>
    <span class="robot">
      <i class="antenna"></i>
      <span class="head"><i class="visor"><b></b><b></b></i></span>
      <span class="neck"></span>
      <span class="torso"><i></i></span>
      <span class="arm left"><i></i></span><span class="arm right"><i></i></span>
      <span class="hand left-hand"></span><span class="hand right-hand"></span>
    </span>
    <span class="station-label"><strong>${escapeHtml(a.name)}</strong><small>${stateLabel(a.id)}</small>${recent?`<em>${escapeHtml(recent.event_type.replaceAll('_',' '))}</em>`:''}</span>
    <span class="state-beacon"></span>
  </button>`;
}
function renderFloor(){const root=$('#agentFloor');root.innerHTML=registry.agents.map(stationMarkup).join('');root.querySelectorAll('[data-agent]').forEach(n=>n.addEventListener('click',()=>showAgent(n.dataset.agent)))}
function renderStatus(){
  const n=registry.agents.length,ready=runtime?.readyAgents??0,blocked=runtime?.blockedAgents??n,decisions=runtime?.approvals??[],events=runtime?.events??[],p=runtime?.progress||{};
  $('#readyCaption').textContent=ready;$('#readyCount').textContent=`${ready} / ${n} runtime-ready`;$('#systemState').textContent=blocked?'Attention Required':'All Systems Operational';
  $('#approvalMetric').textContent=decisions.length;$('#opportunityMetric').textContent=p.found||0;$('#proposalMetric').textContent=p.proposals||0;$('#outreachMetric').textContent=p.outreach||0;$('#completedTotal').textContent=events.filter(e=>e.event_type==='agent_completed').length;
  $('#coreStatus').textContent=decisions.length?`${decisions.length} REVIEW`:'LIVE';
  $('#activity').innerHTML=events.length?events.slice(0,11).map(e=>{const a=agentById(e.agent_id);return `<div class="activity-row"><time>${e.created_at?new Date(e.created_at).toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'}):''}</time><span class="activity-icon">${e.event_type==='approval_requested'?'!':e.event_type.includes('completed')?'✓':'•'}</span><div><strong>${escapeHtml(a?.name||e.agent_id||'System')}</strong><small>${escapeHtml(e.message||'Verified activity')}</small></div></div>`}).join(''):'<div class="activity-empty">No verified execution events yet. AI employees are live and monitoring for assignments.</div>';
  $('#progress').innerHTML=[['Opportunities Found',p.found||0],['Qualified',p.qualified||0],['Proposals',p.proposals||0],['Submitted',p.submitted||0],['Approvals Pending',decisions.length]].map(([k,v],i)=>`<li><span><i style="--dot:${COLORS[i%COLORS.length]}"></i>${k}</span><b>${v}</b></li>`).join('');
  $('#sources').innerHTML=SOURCE_ROWS.map(([label,key])=>{const ok=runtime?.integrations?.[key]!==false;return `<li><span><i class="source-pulse ${ok?'online':'offline'}"></i>${label}</span><b>${ok?'Online':'Attention'}</b></li>`}).join('');
  document.body.classList.toggle('has-approval',decisions.length>0);
}
function showAgent(id){
  const a=agentById(id);if(!a)return;const recent=recentEventFor(id);
  $('#detailBody').innerHTML=`<small class="eyebrow">AI EMPLOYEE // ${escapeHtml(a.department)}</small><h2>${escapeHtml(a.name)}</h2><div class="modal-state ${state(id)}"><span></span><div><b>${stateLabel(id)}</b><small>${stateNote(id)}</small></div></div><p>${escapeHtml(a.mission)}</p>${recent?`<div class="detail-section"><h3>LATEST VERIFIED EVENT</h3><p>${escapeHtml(recent.message||recent.event_type)}</p></div>`:''}<div class="detail-grid"><div class="detail-section"><h3>INPUTS</h3><p>${a.inputs.map(escapeHtml).join(' · ')}</p></div><div class="detail-section"><h3>OUTPUTS</h3><p>${a.outputs.map(escapeHtml).join(' · ')}</p></div><div class="detail-section"><h3>TOOLS</h3><p>${a.tools.map(escapeHtml).join(' · ')}</p></div><div class="detail-section"><h3>GOVERNANCE</h3><p>${escapeHtml(a.approval)}</p></div></div><div class="detail-section"><h3>NEXT HANDOFF</h3><p>${escapeHtml(a.handoff)}</p></div>`;
  $('#detail').showModal();
}
function showAllAgents(){
  const counts={working:0,awaiting_approval:0,live_idle:0,blocked:0};registry.agents.forEach(a=>counts[state(a.id)]++);
  $('#detailBody').innerHTML=`<small class="eyebrow">PROCESSPILOT AI WORKFORCE</small><h2>${registry.agents.length} AI Employees</h2><div class="workforce-summary"><span><b>${counts.working}</b> Working</span><span><b>${counts.awaiting_approval}</b> Awaiting Approval</span><span><b>${counts.live_idle}</b> Monitoring</span><span><b>${counts.blocked}</b> Blocked</span></div><div class="agent-directory">${registry.agents.map(a=>`<button data-agent="${a.id}" class="directory-agent ${state(a.id)}"><i></i><span><b>${escapeHtml(a.name)}</b><small>${escapeHtml(a.department)}</small></span><em>${stateLabel(a.id)}</em></button>`).join('')}</div>`;
  $('#detail').showModal();$('#detailBody').querySelectorAll('[data-agent]').forEach(b=>b.onclick=()=>showAgent(b.dataset.agent));
}
function showApprovals(){const items=runtime?.approvals||[];$('#detailBody').innerHTML=`<small class="eyebrow">EXECUTIVE OPERATIONS</small><h2>Chief of Staff Queue</h2>${items.length?items.map(x=>`<article class="approval-card"><span class="approval-pulse"></span><div><b>${escapeHtml(x.title)}</b><p>${escapeHtml(x.summary||'Decision required')}</p><small>${escapeHtml(String(x.approval_type||'approval').replaceAll('_',' '))}</small></div></article>`).join(''):'<p>No verified approvals are waiting right now.</p>'}<p class="governance-note">External sends, commitments, pricing and submissions remain approval-gated.</p>`;$('#detail').showModal()}
function showNav(view){
  const titles={opportunities:'Opportunities',proposals:'Proposals',outreach:'Outreach',knowledge:'Knowledge Base',analytics:'Analytics',settings:'Settings'};
  if(view==='command')return;
  const p=runtime?.progress||{};const body={opportunities:`${p.found||0} active opportunities are visible in the current live pipeline.`,proposals:`${p.proposals||0} proposals are currently in governed proposal stages.`,outreach:`${p.outreach||0} outreach items are recorded in the live pipeline.`,knowledge:'ProcessPilot company knowledge, proposal guidance and governed templates are available to the agent runtime.',analytics:`${runtime?.verifiedAgentExecutions||0} verified AI-agent executions have been recorded in the current runtime dataset.`,settings:'Runtime configuration is managed server-side. Secrets and protected actions are not exposed in this browser.'}[view];
  $('#detailBody').innerHTML=`<small class="eyebrow">PROCESSPILOT</small><h2>${titles[view]}</h2><p>${body}</p><div class="detail-section"><h3>STATUS</h3><p>This navigation control is active. Full workspace views can be expanded without changing the command-center runtime.</p></div>`;$('#detail').showModal();
}
function clock(){const d=new Date(),time=d.toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit',second:'2-digit'}),date=d.toLocaleDateString('en-US',{timeZone:'America/Chicago',weekday:'long',month:'short',day:'numeric',year:'numeric'});$('#clock').textContent=time;$('#railClock').textContent=time;$('#dateLabel').textContent=date;$('#railDate').textContent=date}
function wire(){
  $('#closeDetail').onclick=()=>$('#detail').close();$('#viewAgents').onclick=showAllAgents;$('#chiefCore').onclick=showApprovals;$('#progressDetails').onclick=()=>showNav('analytics');
  document.querySelectorAll('#mainNav [data-view]').forEach(b=>b.onclick=()=>showNav(b.dataset.view));
}
async function load(){try{const [agents]=await Promise.all([json('/data/agents.json')]);registry=agents;runtime=await json('/api/status');renderFloor();renderStatus()}catch(e){console.error(e);$('#systemState').textContent='Runtime unavailable';$('#readyCount').textContent='Check connection'}}
wire();clock();setInterval(clock,1000);load();setInterval(load,30000);
