import {upsertIntegrationCredential,setIntegrationStatus} from '../../../lib/supabase-server.js';

export default async function handler(req,res){
  const {code,error}=req.query;
  if(error)return res.status(400).send(`Gmail authorization failed: ${error}`);
  if(!code)return res.status(400).send('Missing Google authorization code.');
  const clientId=process.env.GMAIL_CLIENT_ID;
  const clientSecret=process.env.GMAIL_CLIENT_SECRET;
  if(!clientId||!clientSecret)return res.status(503).send('Gmail OAuth credentials are not configured in Vercel.');
  const redirectUri='https://processpilot-agents.vercel.app/api/auth/gmail/callback';
  const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,grant_type:'authorization_code',redirect_uri:redirectUri});
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  const tokens=await response.json();
  if(!response.ok)return res.status(400).send('Google did not issue Gmail authorization tokens.');
  if(!tokens.refresh_token)return res.status(400).send('Authorization succeeded but no refresh token was issued. Revoke the app grant and authorize again with consent.');
  try{
    await upsertIntegrationCredential('gmail_refresh_token',tokens.refresh_token,{scope:tokens.scope||null,token_type:tokens.token_type||null});
    await setIntegrationStatus('gmail','ready','OAuth refresh token stored securely; Gmail API authorization is available.',{scope:tokens.scope||null});
  }catch(e){
    console.error('Gmail credential persistence failed',e);
    return res.status(500).send('Google authorization succeeded, but ProcessPilot could not store the Gmail authorization securely. Check the Supabase server configuration in Vercel.');
  }
  res.setHeader('Cache-Control','no-store');
  res.status(200).send(`<!doctype html><html><body style="font-family:system-ui;background:#07111f;color:#e8f7ff;padding:40px"><h1>Gmail connected to ProcessPilot</h1><p>The Google authorization was stored securely in the ProcessPilot backend.</p><p>External email sending remains approval-gated.</p><p>You may close this window.</p></body></html>`);
}
