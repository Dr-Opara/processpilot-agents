export default function handler(req,res){
  const clientId=process.env.GMAIL_CLIENT_ID;
  if(!clientId)return res.status(503).json({error:'Google OAuth client is not configured'});
  const origin='https://processpilot-agents.vercel.app';
  const redirectUri=`${origin}/api/auth/gmail/callback`;
  const scope=[
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/drive.readonly'
  ].join(' ');
  const params=new URLSearchParams({
    client_id:clientId,
    redirect_uri:redirectUri,
    response_type:'code',
    access_type:'offline',
    prompt:'consent',
    include_granted_scopes:'true',
    scope
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
