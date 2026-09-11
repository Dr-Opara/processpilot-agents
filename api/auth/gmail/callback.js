import {upsertIntegrationCredential,setIntegrationStatus,verifyAndConsumeOAuthState} from '../../../lib/supabase-server.js';

const ALLOWED_SENDERS=new Set(['eo@processpilottech.com','contracts@processpilottech.com']);
const COOKIE_NAME='pp_gmail_oauth';
const COOKIE_PATH='/api/auth/gmail';

function parseCookies(header=''){
  return Object.fromEntries(String(header).split(';').map(p=>p.trim()).filter(Boolean).map(p=>{
    const i=p.indexOf('=');
    return i===-1?[p,'']:[decodeURIComponent(p.slice(0,i)),decodeURIComponent(p.slice(i+1))];
  }));
}

// Every response path clears the browser-binding cookie -- on success or
// failure alike, per Task 4's requirement -- so a completed or abandoned
// attempt never leaves a stale cookie sitting in the browser.
function respond(res,status,body){
  res.setHeader('Set-Cookie',`${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=${COOKIE_PATH}; Max-Age=0`);
  return res.status(status).send(body);
}

export default async function handler(req,res){
  const {code,error,state}=req.query;
  if(error)return respond(res,400,`Gmail authorization failed: ${error}`);
  if(!code)return respond(res,400,'Missing Google authorization code.');

  // Browser-binding + CSRF/state verification. The query-string state alone
  // isn't sufficient: an attacker can complete their OWN Google consent
  // screen (getting a genuinely valid code+state pair) and trick a victim
  // into visiting a crafted callback URL with the attacker's state. Pure
  // server-side state validation would accept that -- state and code really
  // are valid. Requiring the SAME browser's HttpOnly cookie closes this,
  // since the attacker's browser session never reaches the victim.
  if(!state)return respond(res,400,'Missing OAuth state parameter. Start the connection again from ProcessPilot.');
  const cookies=parseCookies(req.headers.cookie);
  const cookieValue=cookies[COOKIE_NAME];
  if(!cookieValue)return respond(res,400,'Missing browser verification cookie. Start the connection again from ProcessPilot in the same browser that will complete it.');
  let stateValid=false;
  try{
    // verifyAndConsumeOAuthState constant-time-compares the cookie's hash
    // against the stored correlation_hash before consuming (deleting) the
    // row -- so a mismatched cookie is rejected without invalidating a
    // still-pending, legitimately-bound attempt. Missing, mismatched,
    // expired, and replayed (already consumed) state all fail identically.
    stateValid=await verifyAndConsumeOAuthState('gmail', String(state), cookieValue);
  }catch(e){
    console.error('Gmail OAuth state verification failed', e.message);
    return respond(res,503,'ProcessPilot could not verify the OAuth request state. Try again shortly.');
  }
  if(!stateValid)return respond(res,400,'This authorization link is invalid, already used, expired, or was not completed in the same browser that started it. Start the connection again from ProcessPilot.');

  const clientId=process.env.GMAIL_CLIENT_ID;
  const clientSecret=process.env.GMAIL_CLIENT_SECRET;
  if(!clientId||!clientSecret)return respond(res,503,'Gmail OAuth credentials are not configured in Vercel.');
  const redirectUri='https://processpilot-agents.vercel.app/api/auth/gmail/callback';
  const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,grant_type:'authorization_code',redirect_uri:redirectUri});
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  const tokens=await response.json();
  if(!response.ok)return respond(res,400,'Google did not issue Gmail authorization tokens.');
  if(!tokens.refresh_token)return respond(res,400,'Authorization succeeded but no refresh token was issued. Revoke the app grant and authorize again with consent.');

  // Identity check: the OAuth state (+ cookie) proves the request came from
  // this app's own /start redirect in the same browser, but not which
  // Google account completed consent. eo@/contracts@processpilottech.com
  // may be the account's primary mailbox OR a "send as" alias configured on
  // a different primary account (Gmail requires an alias to be added and
  // verified before it can be used in a From: header, which is exactly what
  // lib/gmail.js's assertAllowedSender() relies on for drafting/sending).
  // Checking only users.getProfile's primary emailAddress would incorrectly
  // reject that legitimate alias setup, so an account is accepted if EITHER
  // its primary mailbox OR one of its verified send-as identities is an
  // approved ProcessPilot sender.
  let mailbox='';
  let authorizedAlias=null;
  try{
    const profileRes=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers:{authorization:`Bearer ${tokens.access_token}`}});
    const profile=await profileRes.json();
    mailbox=String(profile.emailAddress||'').toLowerCase();
  }catch(e){
    console.error('Gmail profile verification failed', e.message);
    return respond(res,502,'Could not verify the connected Google mailbox identity.');
  }
  if(!ALLOWED_SENDERS.has(mailbox)){
    try{
      const sendAsRes=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs',{headers:{authorization:`Bearer ${tokens.access_token}`}});
      const sendAsData=await sendAsRes.json();
      const match=(sendAsData.sendAs||[]).find(s=>ALLOWED_SENDERS.has(String(s.sendAsEmail||'').toLowerCase())&&s.verificationStatus==='accepted');
      if(match)authorizedAlias=String(match.sendAsEmail).toLowerCase();
    }catch(e){
      console.error('Gmail send-as verification failed', e.message);
      // fall through -- authorizedAlias stays null, request is rejected below
    }
  }
  if(!ALLOWED_SENDERS.has(mailbox)&&!authorizedAlias)return respond(res,403,`The connected Google account (${mailbox||'unknown'}) is not an approved ProcessPilot mailbox and has no verified send-as alias matching one. Reconnect using an approved account, or verify the alias in Gmail settings first.`);

  try{
    await upsertIntegrationCredential('gmail_refresh_token',tokens.refresh_token,{scope:tokens.scope||null,token_type:tokens.token_type||null,mailbox,authorized_via:authorizedAlias?'send_as_alias':'primary_mailbox',authorized_alias:authorizedAlias});
    await setIntegrationStatus('gmail','ready','OAuth refresh token stored securely; Gmail API authorization is available.',{scope:tokens.scope||null,mailbox,authorized_alias:authorizedAlias});
  }catch(e){
    console.error('Gmail credential persistence failed', e.message);
    return respond(res,500,'Google authorization succeeded, but ProcessPilot could not store the Gmail authorization securely. Check the Supabase server configuration in Vercel.');
  }
  res.setHeader('Cache-Control','no-store');
  return respond(res,200,`<!doctype html><html><body style="font-family:system-ui;background:#07111f;color:#e8f7ff;padding:40px"><h1>Gmail connected to ProcessPilot</h1><p>The Google authorization was stored securely in the ProcessPilot backend.</p><p>External email sending remains approval-gated.</p><p>You may close this window.</p></body></html>`);
}
