import {getIntegrationCredential} from '../../lib/supabase-server.js';

async function accessToken(){
  const refresh=await getIntegrationCredential('gmail_refresh_token');
  if(!refresh)throw new Error('Google authorization is not connected');
  const body=new URLSearchParams({client_id:process.env.GMAIL_CLIENT_ID,client_secret:process.env.GMAIL_CLIENT_SECRET,refresh_token:refresh,grant_type:'refresh_token'});
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  const j=await r.json();
  if(!r.ok)throw new Error('Google access token refresh failed');
  return j.access_token;
}
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).end();
  try{
    const token=await accessToken();
    const id='1JMDPgRgPh92lvvgDzPjmrZvRt3VL_f9L';
    const r=await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`,{headers:{authorization:`Bearer ${token}`}});
    if(!r.ok)throw new Error(`Drive artwork unavailable (${r.status})`);
    const bytes=Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type','image/jpeg');
    res.setHeader('Cache-Control','private, max-age=3600, stale-while-revalidate=86400');
    res.status(200).send(bytes);
  }catch(e){res.status(503).json({error:e.message,reauthorize:'/api/auth/gmail/start'});}
}
