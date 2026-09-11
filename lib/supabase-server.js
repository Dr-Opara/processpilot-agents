import crypto from 'node:crypto';
function config(){const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Supabase server credentials are not configured');return {url,key};}
async function request(path,options={}){const {url,key}=config();const r=await fetch(`${url}/rest/v1/${path}`,{...options,headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json',prefer:'return=representation',...(options.headers||{})}});const text=await r.text();if(!r.ok)throw new Error(`Supabase request failed ${r.status}: ${text.slice(0,500)}`);return text?JSON.parse(text):null;}
export async function upsertIntegrationCredential(integrationKey,secretValue,metadata={}){return request('integration_credentials?on_conflict=integration_key',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({integration_key:integrationKey,secret_value:secretValue,metadata})});}
export async function getIntegrationCredential(integrationKey){const rows=await request(`integration_credentials?integration_key=eq.${encodeURIComponent(integrationKey)}&select=secret_value,metadata&limit=1`);return rows?.[0]||null;}
export async function setIntegrationStatus(integrationKey,status,detail,metadata={}){return request('integration_status?on_conflict=integration_key',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({integration_key:integrationKey,display_name:integrationKey==='gmail'?'Gmail':integrationKey,status,detail,last_checked_at:new Date().toISOString(),metadata})});}

// OAuth CSRF-state helpers, with browser binding. A random, short-lived,
// single-use token (the query-string `state`) is persisted server-side when
// an OAuth flow is started. A SEPARATE random value (the cookie) is handed
// to the browser as an HttpOnly cookie; only its SHA-256 hash is stored
// server-side alongside the state row, never the raw value -- so even a
// leaked database row can't be used to forge the cookie. The callback must
// present both the original state AND the cookie from the SAME browser that
// started the flow, closing an OAuth-login-CSRF gap that state-in-the-URL
// alone doesn't: an attacker who completes their own consent screen and
// tricks a victim into visiting a crafted callback URL has the attacker's
// valid state, but not the victim browser's cookie (cookies aren't shared
// across browsers/devices), so verifyAndConsumeOAuthState() rejects it.
export async function createOAuthState(provider,ttlMs=10*60*1000){
  // Opportunistic cleanup: this table only ever accumulates single-digit
  // rows in practice (a new state per admin visit to /api/auth/gmail/start),
  // so a dedicated cleanup job isn't warranted -- instead, each new state
  // request also deletes this provider's already-expired, never-consumed
  // rows. Best-effort: a failure here must not block starting the flow.
  await request(`oauth_states?provider=eq.${encodeURIComponent(provider)}&expires_at=lt.${encodeURIComponent(new Date().toISOString())}`,{method:'DELETE'}).catch(()=>{});
  const state=crypto.randomBytes(32).toString('base64url');
  const cookieValue=crypto.randomBytes(32).toString('base64url');
  const correlationHash=crypto.createHash('sha256').update(cookieValue).digest('hex');
  const expiresAt=new Date(Date.now()+ttlMs).toISOString();
  await request('oauth_states',{method:'POST',body:JSON.stringify({provider,state,correlation_hash:correlationHash,expires_at:expiresAt})});
  return {state,cookieValue};
}
// Verifies the browser-binding cookie BEFORE consuming (deleting) the state
// row. If the cookie is missing or its hash doesn't match, the row is left
// intact and untouched -- rejecting this request must not burn a still-valid
// pending flow for whichever browser actually holds the correct cookie.
// Only a successful match consumes the row, preventing replay.
export async function verifyAndConsumeOAuthState(provider,state,cookieValue){
  if(!state||!cookieValue)return false;
  const rows=await request(`oauth_states?provider=eq.${encodeURIComponent(provider)}&state=eq.${encodeURIComponent(state)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,correlation_hash`);
  const row=rows?.[0];
  if(!row?.correlation_hash)return false;
  const expected=Buffer.from(row.correlation_hash,'hex');
  const actual=Buffer.from(crypto.createHash('sha256').update(cookieValue).digest('hex'),'hex');
  const match=expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);
  if(!match)return false;
  await request(`oauth_states?id=eq.${encodeURIComponent(row.id)}`,{method:'DELETE'});
  return true;
}
