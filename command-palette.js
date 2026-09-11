import {getAgentsRegistry,getOpportunities,esc} from './client-data.js';
import {navigate} from './router.js';

const STATIC_PAGES=[
  {label:'Live Office',path:'/live-office'},
  {label:'Opportunities',path:'/opportunities'},
  {label:'Work Queue',path:'/work-queue'},
  {label:'Proposal Studio',path:'/proposals'},
  {label:'Outreach',path:'/outreach'},
  {label:'Contracts & Delivery',path:'/contracts'},
  {label:'Analytics',path:'/analytics'},
  {label:'Agents',path:'/agents'},
  {label:'Settings',path:'/settings'},
  {label:'Executive Command',path:'/executive'},
];

export function initCommandPalette(){
  const dialog=document.getElementById('commandPalette');
  const input=document.getElementById('cmdInput');
  const results=document.getElementById('cmdResults');
  const trigger=document.getElementById('commandTrigger');
  if(!dialog||!input||!results)return;

  let activeIndex=0;
  let items=[];

  function open(){dialog.showModal();input.value='';renderResults('');input.focus();}
  function close(){dialog.close();}

  function renderResults(query){
    const q=query.trim().toLowerCase();
    const pages=STATIC_PAGES.filter((p)=>!q||p.label.toLowerCase().includes(q));
    items=pages.map((p)=>({label:p.label,hint:'Page',go:()=>navigate(p.path)}));
    if(!q){
      results.innerHTML=`<div class="cmd-group">Pages</div>${items.map((it,i)=>row(it,i)).join('')}`;
      wireRows();
      return;
    }
    results.innerHTML='<div class="cmd-empty">Searching…</div>';
    Promise.all([
      getAgentsRegistry().then((r)=>r.agents||[]).catch(()=>[]),
      getOpportunities().catch(()=>[]),
    ]).then(([agents,opportunities])=>{
      const agentItems=agents.filter((a)=>a.name.toLowerCase().includes(q)).slice(0,6).map((a)=>({label:a.name,hint:a.department,go:()=>navigate(`/agents/${a.id}`)}));
      const oppItems=opportunities.filter((o)=>(o.title||'').toLowerCase().includes(q)).slice(0,6).map((o)=>({label:o.title||'Untitled opportunity',hint:o.agency||'Opportunity',go:()=>navigate(`/opportunities/${o.id}`)}));
      items=[...pages.map((p)=>({label:p.label,hint:'Page',go:()=>navigate(p.path)})),...oppItems,...agentItems];
      if(!items.length){results.innerHTML='<div class="cmd-empty">No matches.</div>';return;}
      let html='';
      if(pages.length)html+=`<div class="cmd-group">Pages</div>${pages.map((p,i)=>row({label:p.label,hint:'Page'},i)).join('')}`;
      if(oppItems.length)html+=`<div class="cmd-group">Opportunities</div>${oppItems.map((it,i)=>row(it,pages.length+i)).join('')}`;
      if(agentItems.length)html+=`<div class="cmd-group">Agents</div>${agentItems.map((it,i)=>row(it,pages.length+oppItems.length+i)).join('')}`;
      results.innerHTML=html;
      wireRows();
    });
  }

  function row(it,i){return `<button data-i="${i}"><span>${esc(it.label)}</span><small>${esc(it.hint||'')}</small></button>`;}
  function wireRows(){
    results.querySelectorAll('button').forEach((btn)=>{
      btn.onclick=()=>{items[Number(btn.dataset.i)]?.go();close();};
    });
  }

  input.addEventListener('input',(e)=>renderResults(e.target.value));
  input.addEventListener('keydown',(e)=>{
    if(e.key==='Enter'&&items[activeIndex]){items[activeIndex].go();close();}
  });
  dialog.addEventListener('close',()=>{});
  dialog.addEventListener('click',(e)=>{if(e.target===dialog)close();});
  if(trigger)trigger.onclick=open;
  document.addEventListener('keydown',(e)=>{
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open();}
  });
}
