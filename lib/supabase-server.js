import crypto from 'node:crypto';
function config(){const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Supabase server credentials are not configured');return {url,key};}
async function request(path,options={}){const {url,key}=config();const r=await fetch(`${url}/rest/v1/${path}`,{...options,headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json',prefer:'return=representation',...(options.headers||{})}});const text=await r.text();if(!r.ok)throw new Error(`Supabase request failed ${r.status}: ${text.slice(0,500)}`);return text?JSON.parse(text):null;}
export async function upsertIntegrationCredential(integrationKey,secretValue,metadata={}){return request('integration_credentials?on_conflict=integration_key',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({integration_key:integrationKey,secret_value:secretValue,metadata})});}
export async function getIntegrationCredential(integrationKey){const rows=await request(`integration_credentials?integration_key=eq.${encodeURIComponent(integrationKey)}&select=secret_value,metadata&limit=1`);return rows?.[0]||null;}
export async function setIntegrationStatus(integrationKey,status,detail,metadata={}){return request('integration_status?on_conflict=integration_key',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({integration_key:integrationKey,display_name:integrationKey==='gmail'?'Gmail':integrationKey,status,detail,last_checked_at:new Date().toISOString(),metadata})});}

// OAuth CSRF-state helpers. A random, short-lived, single-use token is
// persisted server-side when an OAuth flow is started and must be presented
// unchanged by the callback. consumeOAuthState() atomically deletes the
// matching, unexpired row and reports whether it found one -- so a missing,
// mismatched, expired, or already-used (replayed) state all fail the same
// way: no row is returned.
export async function createOAuthState(provider,ttlMs=10*60*1000){
  const state=crypto.randomBytes(32).toString('base64url');
  const expiresAt=new Date(Date.now()+ttlMs).toISOString();
  await request('oauth_states',{method:'POST',body:JSON.stringify({provider,state,expires_at:expiresAt})});
  return state;
}
export async function consumeOAuthState(provider,state){
  if(!state)return false;
  const rows=await request(`oauth_states?provider=eq.${encodeURIComponent(provider)}&state=eq.${encodeURIComponent(state)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`,{method:'DELETE'});
  return Boolean(rows?.length);
}
