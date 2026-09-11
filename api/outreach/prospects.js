import {upsertOutreachProspect,listOutreachProspects,insertEvent} from '../../lib/db.js';
import {authorizeActor} from '../../lib/auth.js';
function validPublicUrl(url){try{const u=new URL(url);return ['http:','https:'].includes(u.protocol);}catch{return false;}}
export default async function handler(req,res){
  const {ok,actor}=await authorizeActor(req,res);
  if(!ok)return res.status(401).json({error:'Unauthorized'});
  if(req.method==='GET'){res.setHeader('Cache-Control','no-store');return res.status(200).json({prospects:await listOutreachProspects(Math.min(Number(req.query?.limit||100),200))});}
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const b=req.body||{};if(!b.organization||!b.email||!b.source_url||!b.relevance_reason)return res.status(400).json({error:'organization, email, source_url and relevance_reason are required'});if(!validPublicUrl(b.source_url))return res.status(400).json({error:'source_url must be a public http(s) URL'});if(!/^\S+@\S+\.\S+$/.test(String(b.email)))return res.status(400).json({error:'Invalid email'});
  const prospect=await upsertOutreachProspect({organization:b.organization,contact_name:b.contact_name||null,contact_title:b.contact_title||null,email:String(b.email).toLowerCase(),source_url:b.source_url,source_type:'public_web',relevance_reason:b.relevance_reason,market:b.market||'commercial',status:'qualified',metadata:{verified_public_source:Boolean(b.verified_public_source),added_by:actor.type==='owner'?actor.email:'automation'}});
  await insertEvent({agent_id:'outreach-agent',event_type:'outreach_prospect_added',message:`Qualified public-contact prospect added: ${b.organization}.`,severity:'info',verified:true,source:'outreach-prospect-api',metadata:{prospect_id:prospect?.id,source_url:b.source_url}});
  return res.status(201).json({ok:true,prospect});
}
