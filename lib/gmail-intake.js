import fs from 'node:fs';
import path from 'node:path';
import {searchMessages,getMessage,messageText} from './gmail.js';
import {runAgentModel} from './ai.js';
import {upsertOpportunity,ensureWorkPacket,insertEvent,findOpportunity,db} from './db.js';
import {isAllowedOpportunity} from './sources.js';

function scout(){return JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','agents.json'),'utf8')).agents.find(a=>a.id==='opportunity-scout');}
function parse(s){try{return JSON.parse(s);}catch{const m=String(s).match(/\{[\s\S]*\}/);try{return m?JSON.parse(m[0]):null;}catch{return null;}}}

export async function scanGmailForRfps({query='newer_than:14d (RFP OR RFQ OR solicitation OR "request for proposal" OR "bid opportunity")',limit=10}={}){
  const found=await searchMessages(query,Math.min(Number(limit||10),20));
  const results=[];
  for(const ref of found.messages||[]){
    const existing=await findOpportunity('gmail_rfp',ref.id);
    if(existing){results.push({message_id:ref.id,status:'duplicate'});continue;}
    const mail=messageText(await getMessage(ref.id));
    if(!mail.subject&&!mail.body)continue;
    const ai=await runAgentModel({agent:scout(),input:{task:'Determine whether this email is a real state, local, private, or commercial contracting opportunity relevant for procurement review. Federal opportunities are prohibited. Return JSON only with keys is_opportunity,market,jurisdiction,agency,title,description,solicitation_type,source_url,response_due_at,confidence,reason. Do not invent missing values.',email:{subject:mail.subject,from:mail.from,date:mail.date,body:mail.body}}});
    const x=parse(ai.output);
    if(!x?.is_opportunity||Number(x.confidence||0)<0.6){results.push({message_id:ref.id,status:'not_opportunity'});continue;}
    const item={external_id:ref.id,source_name:'gmail_rfp',source_url:x.source_url||`gmail-message:${ref.id}`,jurisdiction:x.jurisdiction||'PRIVATE',agency:x.agency||null,title:x.title||mail.subject,description:x.description||null,solicitation_type:x.solicitation_type||'RFP',response_due_at:x.response_due_at||null,status:'discovered',risk_flags:[],metadata:{market:x.market||'private',gmail_thread_id:mail.threadId,source_sender:mail.from,intake:'gmail-ai-classified',classification_confidence:x.confidence,classification_reason:x.reason}};
    if(!isAllowedOpportunity(item)){results.push({message_id:ref.id,status:'excluded_scope'});continue;}
    const saved=await upsertOpportunity(item);
    const work=await ensureWorkPacket({opportunityId:saved.id,input:{opportunity_id:saved.id,title:saved.title,source_url:saved.source_url,jurisdiction:saved.jurisdiction}});
    await insertEvent({opportunity_id:saved.id,work_packet_id:work?.id||null,agent_id:'opportunity-scout',event_type:'opportunity_ingested',severity:'info',message:`RFP email ingested: ${saved.title}`,verified:true,source:'gmail_rfp',metadata:{message_id:ref.id}});
    results.push({message_id:ref.id,status:'ingested',opportunity_id:saved.id});
  }
  const ingested=results.filter(r=>r.status==='ingested').length;
  await db('integration_status?integration_key=eq.procurement_feeds',{method:'PATCH',body:JSON.stringify({status:'ready',detail:'Gmail RFP intake is operational; portal-specific collectors report health independently.',last_checked_at:new Date().toISOString(),metadata:{gmail_checked:(found.messages||[]).length,gmail_ingested:ingested}})}).catch(()=>{});
  return {checked:(found.messages||[]).length,ingested,results};
}
