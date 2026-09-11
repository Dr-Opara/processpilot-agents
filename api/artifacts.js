import {db} from '../lib/db.js';
import {authorizeActor} from '../lib/auth.js';
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const {ok}=await authorizeActor(req,res);
  if(!ok)return res.status(401).json({error:'Sign in required'});
  try{
    res.setHeader('Cache-Control','no-store');
    const oppId=req.query?.opportunity_id;
    const filter=oppId?`&opportunity_id=eq.${encodeURIComponent(oppId)}`:'';
    const artifacts=await db(`artifacts?select=*${filter}&order=created_at.desc&limit=200`);
    return res.status(200).json({artifacts:artifacts||[]});
  }catch(e){return res.status(503).json({error:'Database unavailable',detail:e.message});}
}
