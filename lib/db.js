function cfg(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Database not configured');return {url,key};}
export async function db(path,options={}){const {url,key}=cfg();const r=await fetch(`${url}/rest/v1/${path}`,{...options,headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json',prefer:'return=representation',...(options.headers||{})}});const text=await r.text();if(!r.ok)throw new Error(`DB ${r.status}: ${text.slice(0,500)}`);return text?JSON.parse(text):null;}
export const listOpportunities=(limit=100)=>db(`opportunities?select=*&order=created_at.desc&limit=${limit}`);
export const listApprovals=(limit=100)=>db(`approvals?select=*&order=created_at.desc&limit=${limit}`);
export const listEvents=(limit=100)=>db(`activity_events?select=*&verified=eq.true&order=created_at.desc&limit=${limit}`);
export const listWork=(limit=100)=>db(`work_packets?select=*&order=created_at.desc&limit=${limit}`);
export const insertEvent=(event)=>db('activity_events',{method:'POST',body:JSON.stringify(event)});
export const createWork=(packet)=>db('work_packets',{method:'POST',body:JSON.stringify(packet)});
export const updateWork=(id,patch)=>db(`work_packets?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(patch)});
export const createArtifact=(artifact)=>db('artifacts',{method:'POST',body:JSON.stringify(artifact)});
