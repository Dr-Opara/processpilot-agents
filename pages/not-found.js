import {esc} from '../client-data.js';

export async function render(container){
  container.innerHTML=`<div class="empty-state" style="margin-top:60px">
    <b>Page not found</b>
    ${esc(location.pathname)} doesn't match a ProcessPilot workspace.
    <div style="margin-top:14px"><a class="btn" href="/live-office" data-route>Return to Live Office</a></div>
  </div>`;
}
