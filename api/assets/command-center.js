import fs from 'node:fs';
import path from 'node:path';

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).end();
  try{
    const root=process.cwd();
    const parts=['webp01.b64','webp02.b64','webp03.b64'].map(name=>fs.readFileSync(path.join(root,'data','reference',name),'utf8').trim());
    const bytes=Buffer.from(parts.join(''),'base64');
    if(bytes.length<25000)throw new Error('Embedded command-center artwork is incomplete');
    res.setHeader('Content-Type','image/webp');
    res.setHeader('Content-Length',String(bytes.length));
    res.setHeader('Cache-Control','public, max-age=86400, s-maxage=604800, immutable');
    return res.status(200).send(bytes);
  }catch(e){
    console.error('Embedded command center artwork failed',e);
    return res.status(500).json({error:'Command-center artwork unavailable'});
  }
}
