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
  res.setHeader('Cache-Control','no-store');
  res.status(200).send(`<!doctype html><html><body style="font-family:system-ui;background:#07111f;color:#e8f7ff;padding:40px"><h1>Gmail authorization successful</h1><p>Google issued the ProcessPilot Gmail authorization.</p><p>For security, the refresh token is not displayed in this page or written to GitHub. Complete the secure Vercel secret-storage step before enabling Gmail runtime.</p><p>You may close this window.</p></body></html>`);
}
