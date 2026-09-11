const BUCKET='processpilot-assets';
const OBJECT='command-center-reference.jpg';
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).end();
  try{
    const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!url||!key)throw new Error('Supabase server credentials are not configured');
    const r=await fetch(`${url}/storage/v1/object/${BUCKET}/${OBJECT}`,{headers:{apikey:key,authorization:`Bearer ${key}`}});
    if(!r.ok)throw new Error(`Native command center artwork unavailable (${r.status})`);
    const bytes=Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type','image/jpeg');
    res.setHeader('Content-Length',String(bytes.length));
    res.setHeader('Cache-Control','public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).send(bytes);
  }catch(e){console.error('Command center artwork failed',e.message);return res.status(503).json({error:e.message});}
}
