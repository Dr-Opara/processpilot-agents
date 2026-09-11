import crypto from 'node:crypto';

const EXPECTED_SHA256='117f07c6b02489f901db0cf79009b14cb4e20442e53045020c9cb965ea322425';
const BUCKET='processpilot-assets';
const OBJECT='command-center-reference.jpg';

function config(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Supabase server credentials are not configured');return {url,key};}
async function ensureBucket(url,key){const headers={apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'};const check=await fetch(`${url}/storage/v1/bucket/${BUCKET}`,{headers});if(check.ok)return;const create=await fetch(`${url}/storage/v1/bucket`,{method:'POST',headers,body:JSON.stringify({id:BUCKET,name:BUCKET,public:false,file_size_limit:2097152,allowed_mime_types:['image/jpeg','image/png']})});if(!create.ok&&create.status!==409)throw new Error(`Unable to create asset bucket (${create.status})`);}
export const config={api:{bodyParser:false,responseLimit:false}};
export default async function handler(req,res){
  if(req.method!=='PUT')return res.status(405).json({error:'Method not allowed'});
  try{
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>1048576)return res.status(413).json({error:'Asset too large'});chunks.push(chunk);}
    const bytes=Buffer.concat(chunks);const digest=crypto.createHash('sha256').update(bytes).digest('hex');
    if(digest!==EXPECTED_SHA256)return res.status(403).json({error:'Payload digest not authorized'});
    const {url,key}=config();await ensureBucket(url,key);
    const upload=await fetch(`${url}/storage/v1/object/${BUCKET}/${OBJECT}`,{method:'POST',headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'image/png','x-upsert':'true'},body:bytes});
    if(!upload.ok){const detail=await upload.text();throw new Error(`Asset upload failed (${upload.status}): ${detail.slice(0,300)}`);}
    return res.status(200).json({ok:true,sha256:digest,size:bytes.length});
  }catch(e){console.error('Reference asset upload failed',e);return res.status(500).json({error:e.message});}
}
