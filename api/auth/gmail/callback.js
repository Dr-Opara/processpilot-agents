import {upsertIntegrationCredential,setIntegrationStatus,consumeOAuthState} from '../../../lib/supabase-server.js';

const ALLOWED_SENDERS=new Set(['eo@processpilottech.com','contracts@processpilottech.com']);

export default async function handler(req,res){
  const {code,error,state}=req.query;
  if(error)return res.status(400).send(`Gmail authorization failed: ${error}`);
  if(!code)return res.status(400).send('Missing Google authorization code.');

  // CSRF/state verification. Reject missing state outright; consumeOAuthState
  // atomically deletes the matching, unexpired row, so a mismatched,
  // expired, or already-used (replayed) state all fail identically -- no
  // row is found.
  if(!state)return res.status(400).send('Missing OAuth state parameter. Start the connection again from ProcessPilot.');
  let stateValid=false;
  try{
    stateValid=await consumeOAuthState('gmail', String(state));
  }catch(e){
    console.error('Gmail OAuth state verification failed', e.message);
    return res.status(503).send('ProcessPilot could not verify the OAuth request state. Try again shortly.');
  }
  if(!stateValid)return res.status(400).send('This authorization link is invalid, already used, or expired. Start the connection again from ProcessPilot.');

  const clientId=process.env.GMAIL_CLIENT_ID;
  const clientSecret=process.env.GMAIL_CLIENT_SECRET;
  if(!clientId||!clientSecret)return res.status(503).send('Gmail OAuth credentials are not configured in Vercel.');
  const redirectUri='https://processpilot-agents.vercel.app/api/auth/gmail/callback';
  const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,grant_type:'authorization_code',redirect_uri:redirectUri});
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  const tokens=await response.json();
  if(!response.ok)return res.status(400).send('Google did not issue Gmail authorization tokens.');
  if(!tokens.refresh_token)return res.status(400).send('Authorization succeeded but no refresh token was issued. Revoke the app grant and authorize again with consent.');

  // Identity check: the OAuth state proves the request came from this app's
  // own /start redirect, but not which Google account completed consent.
  // Reject any mailbox that isn't an approved ProcessPilot sender before
  // persisting anything, so the integration can't be silently rebound to an
  // unrelated account.
  let mailbox='';
  try{
    const profileRes=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers:{authorization:`Bearer ${tokens.access_token}`}});
    const profile=await profileRes.json();
    mailbox=String(profile.emailAddress||'').toLowerCase();
  }catch(e){
    console.error('Gmail profile verification failed', e.message);
    return res.status(502).send('Could not verify the connected Google mailbox identity.');
  }
  if(!ALLOWED_SENDERS.has(mailbox))return res.status(403).send(`The connected Google account (${mailbox||'unknown'}) is not an approved ProcessPilot mailbox. Reconnect using an approved account.`);

  try{
    await upsertIntegrationCredential('gmail_refresh_token',tokens.refresh_token,{scope:tokens.scope||null,token_type:tokens.token_type||null,mailbox});
    await setIntegrationStatus('gmail','ready','OAuth refresh token stored securely; Gmail API authorization is available.',{scope:tokens.scope||null,mailbox});
  }catch(e){
    console.error('Gmail credential persistence failed', e.message);
    return res.status(500).send('Google authorization succeeded, but ProcessPilot could not store the Gmail authorization securely. Check the Supabase server configuration in Vercel.');
  }
  res.setHeader('Cache-Control','no-store');
  res.status(200).send(`<!doctype html><html><body style="font-family:system-ui;background:#07111f;color:#e8f7ff;padding:40px"><h1>Gmail connected to ProcessPilot</h1><p>The Google authorization was stored securely in the ProcessPilot backend.</p><p>External email sending remains approval-gated.</p><p>You may close this window.</p></body></html>`);
}
