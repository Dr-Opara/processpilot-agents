import {createOAuthState} from '../../../lib/supabase-server.js';

export default async function handler(req,res){
  const clientId=process.env.GMAIL_CLIENT_ID;
  if(!clientId)return res.status(503).json({error:'Google OAuth client is not configured'});
  const origin='https://processpilot-agents.vercel.app';
  const redirectUri=`${origin}/api/auth/gmail/callback`;
  const scope=[
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.modify',
    // Read-only access to Gmail "Send As" settings, needed by the callback's
    // identity check to recognize an approved sender configured as a send-as
    // alias rather than the account's primary address. Does not grant the
    // ability to change any setting. drive.readonly was removed -- nothing
    // in this codebase uses the Drive API.
    'https://www.googleapis.com/auth/gmail.settings.basic'
  ].join(' ');
  let state;
  try{
    // Cryptographically random, single-use, 10-minute state token persisted
    // server-side; the callback must present it unchanged (see consumeOAuthState).
    state=await createOAuthState('gmail');
  }catch(e){
    console.error('Gmail OAuth state could not be stored', e.message);
    return res.status(503).json({error:'Gmail OAuth cannot be started securely right now. Try again shortly.'});
  }
  const params=new URLSearchParams({
    client_id:clientId,
    redirect_uri:redirectUri,
    response_type:'code',
    access_type:'offline',
    prompt:'consent',
    include_granted_scopes:'true',
    scope,
    state
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
