import {SOURCES} from './sources.js';
import {db,insertEvent} from './db.js';

export async function checkSourceHealth(){
  const results=[];
  for(const source of SOURCES){
    const started=Date.now();
    try{
      const r=await fetch(source.url,{method:'GET',redirect:'follow',headers:{'user-agent':'ProcessPilot/1.0 procurement-source-health'}});
      const ok=r.ok;
      const result={source_key:source.code,name:source.name,jurisdiction:source.jurisdiction,reachable:ok,http_status:r.status,latency_ms:Date.now()-started,checked_at:new Date().toISOString(),collector_status:'discovery_pending'};
      results.push(result);
      await db(`source_registry?source_key=eq.${encodeURIComponent(source.code)}`,{method:'PATCH',body:JSON.stringify({last_checked_at:result.checked_at,status:ok?'reachable':'degraded',metadata:{http_status:r.status,latency_ms:result.latency_ms,collector_status:'discovery_pending'}})}).catch(()=>{});
    }catch(e){
      const result={source_key:source.code,name:source.name,jurisdiction:source.jurisdiction,reachable:false,error:e.message,latency_ms:Date.now()-started,checked_at:new Date().toISOString(),collector_status:'discovery_pending'};
      results.push(result);
      await db(`source_registry?source_key=eq.${encodeURIComponent(source.code)}`,{method:'PATCH',body:JSON.stringify({last_checked_at:result.checked_at,status:'degraded',metadata:{error:e.message,collector_status:'discovery_pending'}})}).catch(()=>{});
    }
  }
  await insertEvent({agent_id:'opportunity-scout',event_type:'source_health_checked',message:`Checked ${results.length} priority procurement portals; reachability is not treated as successful opportunity collection.`,severity:results.every(x=>x.reachable)?'info':'warning',verified:true,source:'source-health',metadata:{sources:results}});
  return results;
}
