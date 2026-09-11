const $=s=>document.querySelector(s);
let registry={agents:[]},runtime=null,jurisdictions=null;
const DEPTS=['Opportunity Intelligence','Procurement Operations','Vendor Research','Proposal Studio','Compliance & Risk','Pricing & Finance','Outreach','Contracts & Delivery'];
const VISIBLE_SPECIALISTS=[
  {key:'research',label:'Research Agent',agentId:'agency-researcher',color:'#9b72ff'},
  {key:'outreach',label:'Outreach Agent',agentId:'outreach-drafter',color:'#ff72c6'},
  {key:'compliance',label:'Compliance Agent',agentId:'compliance-matrix',color:'#2ee69f'},
  {key:'pricing',label:'Pricing Agent',agentId:'pricing-analyst',color:'#f3c95d'},
  {key:'contracts',label:'Contracts Agent',agentId:'contracts-reviewer',color:'#ff7c66'},
  {key:'proposal',label:'Proposal Agent',agentId:'proposal-writer',color:'#38b7ff'}
];
const STATIONS=[
  {type:'region',code:'TX',x:16,y:42,scale:.9,color:'#20d6ff'},
  {type:'region',code:'DC',x:34,y:42,scale:.9,color:'#9a72ff'},
  {type:'region',code:'MD',x:66,y:42,scale:.9,color:'#2ee69f'},
  {type:'region',code:'VA',x:84,y:42,scale:.9,color:'#f2c14e'},
  {type:'specialist',key:'research',x:12,y:70,scale:1.0},
  {type:'specialist',key:'outreach',x:29,y:71,scale:1.0},
  {type:'specialist',key:'compliance',x:46,y:72,scale:1.04},
  {type:'specialist',key:'pricing',x:63,y:72,scale:1.0},
  {type:'specialist',key:'contracts',x:80,y:71,scale:1.0},
  {type:'specialist',key:'proposal',x:92,y:66,scale:.92}
];
const PEOPLE=[
  {skin:'#8a4f2f',skin2:'#63351f',hair:'#111820',shirt:'#1e6cff',accent:'#8bdcff',style:'fade'},
  {skin:'#d59a73',skin2:'#ad6d4b',hair:'#3a2118',shirt:'#5e47d9',accent:'#c1b4ff',style:'wave'},
  {skin:'#6f3d27',skin2:'#4c281a',hair:'#111',shirt:'#13845f',accent:'#8cf2c9',style:'crop'},
  {skin:'#f0c09a',skin2:'#c98b65',hair:'#c97826',shirt:'#9b6b16',accent:'#ffe49a',style:'swoop'},
  {skin:'#7b452d',skin2:'#57301f',hair:'#161616',shirt:'#6744b8',accent:'#c9b7ff',style:'short'},
  {skin:'#c8875f',skin2:'#9c5f40',hair:'#2a1712',shirt:'#ba3f78',accent:'#ffb7d8',style:'bun'},
  {skin:'#5f3422',skin2:'#3d2117',hair:'#090c10',shirt:'#147b63',accent:'#9df4d8',style:'locs'},
  {skin:'#e0ad86',skin2:'#b77a57',hair:'#4b2f22',shirt:'#b8871f',accent:'#ffe7a7',style:'side'},
  {skin:'#9d603f',skin2:'#734128',hair:'#1d1210',shirt:'#b5493b',accent:'#ffc1b8',style:'curl'},
  {skin:'#dca781',skin2:'#aa714f',hair:'#302016',shirt:'#237bb5',accent:'#a7e4ff',style:'bob'}
];
async function json(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${url}: ${r.status}`);return r.json()}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function agent(id){return registry.agents.find(a=>a.id===id)}
function agentState(id){return runtime?.agentStates?.[id]||'live_idle'}
function stateLabel(s){return({working:'Working',awaiting_approval:'Approval Gate',live_idle:'Monitoring',blocked:'Attention'})[s]||'Monitoring'}
function specialistState(){const vals=Object.values(runtime?.agentStates||{});return {working:vals.filter(v=>v==='working').length,waiting:vals.filter(v=>v==='awaiting_approval').length,idle:vals.filter(v=>v==='live_idle').length,blocked:vals.filter(v=>v==='blocked').length}}
function regionalConnected(){return Boolean(runtime?.integrations?.procurementFeeds)}
function regionData(code){return (jurisdictions?.priority||[]).find(r=>r.code===code)}
function stationData(s){if(s.type==='region'){const r=regionData(s.code);return {id:`region-${s.code}`,title:r?.employee||`${s.code} Procurement Agent`,subtitle:r?.name||s.code,state:regionalConnected()?'live_idle':'blocked',color:s.color,region:r}}const spec=VISIBLE_SPECIALISTS.find(v=>v.key===s.key),a=agent(spec.agentId);return {id:a?.id||spec.agentId,title:spec.label,subtitle:a?.department||'Specialist',state:agentState(spec.agentId),color:spec.color,agent:a}}
function stationMarkup(s,i){const d=stationData(s),status=stateLabel(d.state),p=PEOPLE[i%PEOPLE.length];return `<button class="live-station human-station ${d.state}" style="left:${s.x}%;top:${s.y}%;--scale:${s.scale};--agent:${d.color};--skin:${p.skin};--skin2:${p.skin2};--hair:${p.hair};--shirt:${p.shirt};--accent:${p.accent};--delay:${(i%5)*-.55}s" data-kind="${s.type}" data-key="${s.type==='region'?s.code:s.key}" aria-label="${esc(d.title)} — ${status}">
<span class="chair"><i></i></span>
<span class="desk human-desk"><i class="keyboard"></i><i class="coffee"></i><i class="monitor"><i class="scan"></i><b>${status.toUpperCase()}</b><small>${String(i+1).padStart(2,'0')}</small></i></span>
<span class="human person-${i} hair-${p.style}">
  <span class="human-shadow"></span>
  <span class="hair back"></span>
  <span class="ear left"></span><span class="ear right"></span>
  <span class="face"><i class="brow left"></i><i class="brow right"></i><i class="eye left"></i><i class="eye right"></i><i class="nose"></i><i class="mouth"></i></span>
  <span class="hair front"></span>
  <span class="neck"></span>
  <span class="torso"><i class="collar left"></i><i class="collar right"></i><i class="badge-dot"></i></span>
  <span class="human-arm left"><i class="forearm"></i><i class="hand"></i></span>
  <span class="human-arm right"><i class="forearm"></i><i class="hand"></i></span>
</span>
<span class="station-tag"><strong>${esc(d.title)}</strong><small>${esc(d.subtitle)}</small><em>${status}</em></span><span class="state-light"></span></button>`}
function renderFloor(){
  $('#liveStations').innerHTML=STATIONS.map(stationMarkup).join('');
  document.querySelectorAll('.live-station').forEach(node=>node.onclick=()=>{if(node.dataset.kind==='region')showRegion(regionData(node.dataset.key));else showSpecialist(VISIBLE_SPECIALISTS.find(v=>v.key===node.dataset.key))});
  const g=$('#livePaths');g.innerHTML='';STATIONS.forEach((s,i)=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path'),x=s.x/100*1000,y=s.y/100*620;p.setAttribute('d',`M ${x} ${y} Q 500 ${330+i%2*24} 500 118`);p.style.animationDelay=`${-i*.3}s`;g.append(p)});
}
function renderStatus(){const p=runtime?.progress||{},apps=runtime?.approvals||[],events=runtime?.events||[],s=specialistState();const visibleStates=STATIONS.map(st=>stationData(st).state),visibleReady=visibleStates.filter(v=>v!=='blocked').length;$('#agentCount').textContent=registry.agents.length;$('#regionalReady').textContent=`${visibleReady} / 10`;$('#systemState').textContent=visibleReady===10?'All Visible Agents Online':'Attention Required';$('#backgroundReady').textContent=Math.max(0,(runtime?.readyAgents||0)-6);$('#blockedCount').textContent=s.blocked;$('#queueDepth').textContent=runtime?.queueDepth||0;$('#availability').textContent=runtime?'ONLINE':'ERROR';$('#reviewBadge').textContent=`${apps.length} decision${apps.length===1?'':'s'}`;$('#regionalMini').innerHTML=STATIONS.slice(0,10).map(st=>{const d=stationData(st);return `<span><i></i><b>${st.type==='region'?st.code:VISIBLE_SPECIALISTS.find(v=>v.key===st.key)?.label.replace(' Agent','')}</b><small>${stateLabel(d.state)}</small></span>`}).join('');$('#progress').innerHTML=[['Opportunities Found',p.found||0],['Qualified',p.qualified||0],['Proposals in Progress',p.proposals||0],['Submitted',p.submitted||0],['Approvals Pending',apps.length]].map(x=>`<li>${x[0]} <b>${x[1]}</b></li>`).join('');$('#approvals').innerHTML=apps.length?apps.slice(0,3).map(x=>`<div><b>${esc(x.title)}</b><p>${esc(x.summary||'Executive decision required')}</p></div>`).join(''):'<div><b>No executive decisions waiting</b><p>Decision packets appear here when work reaches a governance gate.</p></div>';$('#activity').innerHTML=events.length?events.slice(0,12).map(e=>`<div><time>${new Date(e.created_at).toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'})}</time><span>${esc(e.message)}</span><b class="verified">VERIFIED</b></div>`).join(''):'<div><time>NOW</time><span>No verified execution events yet.</span><b class="waiting">IDLE</b></div>';$('#specialistSummary').innerHTML=DEPTS.map(d=>{const members=registry.agents.filter(a=>a.department===d),working=members.filter(a=>agentState(a.id)==='working').length;return `<button class="specialist-dept" data-dept="${esc(d)}"><b>${esc(d)}</b><small>${working?working+' working now':members.length+' ready in background'}</small></button>`}).join('');document.querySelectorAll('.specialist-dept').forEach(b=>b.onclick=()=>showDepartment(b.dataset.dept));document.body.classList.toggle('has-approval',apps.length>0)}
function renderCycles(){const times=jurisdictions?.scheduledCycles?.times||[];const now=new Date(),parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(now),hm=Number(parts.find(x=>x.type==='hour').value)*60+Number(parts.find(x=>x.type==='minute').value);let next=times.find(t=>{const[h,m]=t.split(':').map(Number);return h*60+m>hm});if(!next)next=times[0]+' tomorrow';const display=next.includes('tomorrow')?'8:00 AM tomorrow':formatTime(next);$('#nextRun').textContent=display;$('#nextRunSmall').textContent=display;$('#countdown').textContent=next.includes('tomorrow')?'Tomorrow':`${Math.max(0,(()=>{const[h,m]=next.split(':').map(Number);return h*60+m-hm})())} min`;$('#cycleList').innerHTML=times.map(t=>{const[h,m]=t.split(':').map(Number),v=h*60+m;return `<li class="${v<hm?'done':''}">${formatTime(t)} · ${v<hm?'Completed':'Scheduled'}</li>`}).join('')}
function formatTime(t){let[h,m]=t.split(':').map(Number),s=h>=12?'PM':'AM';h=h%12||12;return `${h}:${String(m).padStart(2,'0')} ${s}`}
function showRegion(r){if(!r)return;$('#detailBody').innerHTML=`<small>REGIONAL PROCUREMENT OPERATIONS</small><h2>${esc(r.employee)}</h2><p><b>${esc(r.name)}</b> · ${regionalConnected()?'Connected and monitoring approved procurement sources.':'Source connection needs attention.'}</p><div class="detail-section"><h3>PRIMARY RESPONSIBILITY</h3><p>Discover and route relevant ${esc(r.name)} state and local opportunities into ProcessPilot's qualification workflow.</p></div><div class="detail-section"><h3>WORKFLOW HANDOFF</h3><p>Opportunities move into research, compliance, pricing, proposal, outreach and contract workflows as needed.</p></div>`;$('#detail').showModal()}
function showSpecialist(spec){const a=agent(spec.agentId);if(!a)return;const s=agentState(a.id);$('#detailBody').innerHTML=`<small>LIVE SPECIALIST STATION</small><h2>${esc(spec.label)}</h2><p><b>${stateLabel(s)}</b> · ${esc(a.mission)}</p><div class="detail-section"><h3>INPUTS</h3><p>${a.inputs.map(esc).join(' · ')}</p></div><div class="detail-section"><h3>OUTPUTS</h3><p>${a.outputs.map(esc).join(' · ')}</p></div><div class="detail-section"><h3>TOOLS</h3><p>${a.tools.map(esc).join(' · ')}</p></div><div class="detail-section"><h3>GOVERNANCE</h3><p>${esc(a.approval)}</p></div>`;$('#detail').showModal()}
function showQueue(){const items=runtime?.approvals||[];$('#detailBody').innerHTML=`<small>EXECUTIVE OPERATIONS</small><h2>Opara · Chief of Staff / CEO</h2><p>Executive workspace for decisions that reach a governed checkpoint.</p><div class="detail-section"><h3>DECISION QUEUE</h3>${items.length?items.map(x=>`<article class="decision"><b>${esc(x.title)}</b><p>${esc(x.summary||'Decision required')}</p><small>${esc(String(x.approval_type||'approval').replaceAll('_',' '))}</small></article>`).join(''):'<p>No verified decisions are waiting.</p>'}</div>`;$('#detail').showModal()}
function showDepartment(name){const members=registry.agents.filter(a=>a.department===name);$('#detailBody').innerHTML=`<small>BACKGROUND SPECIALIST WORKFORCE</small><h2>${esc(name)}</h2><p>${members.length} specialist agents support the visible operations floor.</p><div class="detail-section"><h3>AGENTS</h3>${members.map(a=>`<div class="decision"><b>${esc(a.name)}</b><p>${esc(a.mission)}</p><small>${stateLabel(agentState(a.id))}</small></div>`).join('')}</div>`;$('#detail').showModal()}
function showWorkspace(view){const p=runtime?.progress||{},apps=runtime?.approvals||[],events=runtime?.events||[];const renderers={'regional-agents':()=>`<small>LIVE OFFICE</small><h2>Visible Operations Agents</h2><p>10 visible stations: TX, DC, MD, VA, Research, Outreach, Compliance, Pricing, Contracts and Proposal.</p>`,opportunities:()=>`<small>PIPELINE</small><h2>Opportunities</h2><p><b>${p.found||0}</b> opportunities are currently recorded in the live pipeline.</p><div class="detail-section"><h3>QUALIFICATION</h3><p>${p.qualified||0} currently meet the qualification threshold.</p></div>`,'work-queue':()=>`<small>OPERATIONS</small><h2>Work Queue</h2><p><b>${runtime?.queueDepth||0}</b> work packets are queued, running or waiting at governed checkpoints.</p><div class="detail-section"><h3>EXECUTION</h3><p>${runtime?.verifiedAgentExecutions||0} verified specialist executions are recorded.</p></div>`,proposals:()=>`<small>PROPOSAL STUDIO</small><h2>Proposals</h2><p><b>${p.proposals||0}</b> proposals are currently in progress.</p>`,outreach:()=>`<small>BUSINESS DEVELOPMENT</small><h2>Outreach</h2><p>Outreach is prepared by the visible Outreach Agent and supporting specialists. External sends remain governed.</p>`,contracts:()=>`<small>CONTRACTS & DELIVERY</small><h2>Contracts</h2><p>Contracts Agent reviews award and contract materials while delivery specialists operate behind the scenes.</p>`,reports:()=>`<small>ANALYTICS</small><h2>Reports & Analytics</h2><p><b>${events.length}</b> recent verified runtime events are visible. ${apps.length} executive decision packet${apps.length===1?' is':'s are'} pending.</p>`,settings:()=>`<small>ADMINISTRATION</small><h2>Settings</h2><p>Runtime secrets and protected controls remain server-side. Active sourcing scope is TX, DC, MD and VA; federal/SAM.gov sourcing is excluded.</p>`};if(view==='live-office'){window.scrollTo({top:0,behavior:'smooth'});return}const html=renderers[view]?.();if(!html)return;$('#detailBody').innerHTML=html;$('#detail').showModal()}
function setActive(view){document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view))}
function wireNav(){document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();const view=el.dataset.view;setActive(view);showWorkspace(view)}))}
function clock(){const d=new Date();$('#clock').textContent=d.toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'})}
async function load(){try{[registry,jurisdictions]=await Promise.all([json('/data/agents.json'),json('/data/jurisdictions.json')]);runtime=await json('/api/status');renderFloor();renderStatus();renderCycles()}catch(e){console.error(e);$('#systemState').textContent='Runtime unavailable';$('#availability').textContent='ERROR'}}
$('#closeDetail').onclick=()=>$('#detail').close();$('#chief').onclick=showQueue;$('#openQueue').onclick=showQueue;wireNav();setInterval(clock,1000);clock();load();setInterval(load,30000);