import {getStatus,getSources,esc,fmtDateTime,isSignInError,signInGateHtml} from '../client-data.js';

const CYCLE_TIMES=['08:00','10:00','12:00','14:00','16:00'];

function sourceHealth(s){
  const cfg=s.config||{};
  const status=cfg.last_status||(s.last_success_at?'healthy':'unknown');
  const color={healthy:'#4fe9ab',degraded:'#f3c95d',failed:'#ff8b8f',unknown:'#8aa4b8'}[status]||'#8aa4b8';
  return `<span style="display:inline-flex;align-items:center;gap:6px;color:${color}"><i style="width:6px;height:6px;border-radius:50%;background:${color}"></i>${esc(status)}</span>`;
}

export async function render(container){
  container.innerHTML='<div class="page-loading">Loading…</div>';
  let status;
  try{ status=await getStatus(); }catch(e){ container.innerHTML=`<div class="page-error">${esc(e.message)}</div>`;return; }

  container.innerHTML=`
    <div class="page-header"><div><span class="breadcrumb">ProcessPilot</span><h1>Settings</h1><p>Operational configuration and integration health. Credentials are never displayed here.</p></div></div>
    <div class="detail-grid">
      <div>
        <div class="card"><h3>System</h3><dl>
          <dt>AI Runtime</dt><dd>${status.integrations.openai?'Ready':'Waiting for configuration'}</dd>
          <dt>Database</dt><dd>${status.integrations.database?'Connected':'Not configured'}</dd>
          <dt>Gmail</dt><dd>${status.integrations.gmail?'Connected':'Not connected'}</dd>
          <dt>Procurement Feeds</dt><dd>${status.integrations.procurementFeeds?'Ready':'Waiting for configuration'}</dd>
          <dt>Queue Depth</dt><dd>${status.queueDepth}</dd>
          <dt>Ready Agents</dt><dd>${status.readyAgents} / ${status.readyAgents+status.blockedAgents}</dd>
        </dl></div>
        <div class="card"><h3>Scheduler</h3><p style="margin:0 0 8px;color:#8aa4b8;font-size:12px">Operating cycles run daily, America/Chicago:</p>
          <div class="chip-group">${CYCLE_TIMES.map((t)=>`<span class="chip">${t} CT</span>`).join('')}</div>
        </div>
        <div class="card"><h3>Security</h3><dl>
          <dt>Owner auth</dt><dd>Supabase Auth (session cookie)</dd>
          <dt>Automation</dt><dd>PROCESSPILOT_RUN_SECRET (server-side only, never sent to the browser)</dd>
          <dt>Gmail OAuth</dt><dd>State + browser-bound cookie, single-use</dd>
        </dl></div>
      </div>
      <div id="sourcesWrap"><div class="card"><h3>Procurement Sources</h3><div class="page-loading">Loading…</div></div></div>
    </div>`;

  const wrap=container.querySelector('#sourcesWrap');
  try{
    const sources=await getSources();
    wrap.innerHTML=`<div class="card"><h3>Procurement Sources</h3>${sources.length?`<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Source</th><th>Jurisdiction</th><th>Health</th><th>Last Checked</th><th>Last Success</th></tr></thead>
      <tbody>${sources.map((s)=>`<tr><td><b style="color:#eafaff">${esc(s.name||s.code)}</b></td><td>${esc(s.jurisdiction||'—')}</td><td>${sourceHealth(s)}</td><td>${fmtDateTime(s.last_checked_at)}</td><td>${fmtDateTime(s.last_success_at)}</td></tr>`).join('')}</tbody>
    </table></div>`:'<div class="empty-state">No source registry rows recorded yet.</div>'}</div>`;
  }catch(e){
    if(isSignInError(e))wrap.innerHTML=signInGateHtml('Sign in as the ProcessPilot owner to view procurement source health.');
    else wrap.innerHTML=`<div class="card"><h3>Procurement Sources</h3><div class="page-error">${esc(e.message)}</div></div>`;
  }
}
