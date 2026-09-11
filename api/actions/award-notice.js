import {db,createWork,insertEvent} from '../../lib/db.js';
function authorized(req){const s=process.env.PROCESSPILOT_RUN_SECRET;return Boolean(s&&req.headers.authorization===`Bearer ${s}`);}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!authorized(req))return res.status(401).json({error:'Unauthorized'});
  const {opportunity_id,note=''}=req.body||{};
  if(!opportunity_id)return res.status(400).json({error:'opportunity_id is required'});
  try{
    const rows=await db(`opportunities?id=eq.${encodeURIComponent(opportunity_id)}&select=*&limit=1`),opportunity=rows?.[0];
    if(!opportunity)return res.status(404).json({error:'Opportunity not found'});
    const existing=await db(`work_packets?opportunity_id=eq.${encodeURIComponent(opportunity_id)}&current_stage=in.(delivery,delivery_kickoff)&status=in.(queued,running,waiting_approval)&select=id&limit=1`);
    if(existing?.length)return res.status(409).json({error:'A contract-review or delivery work packet is already active for this opportunity'});
    const work=await createWork({opportunity_id,workflow_id:'award-to-delivery',current_agent_id:'contracts-reviewer',current_stage:'delivery',status:'queued',priority:75,input:{note,source:'award-notice'}});
    await db(`opportunities?id=eq.${encodeURIComponent(opportunity_id)}`,{method:'PATCH',body:JSON.stringify({status:'awarded'})});
    await insertEvent({opportunity_id,work_packet_id:work?.id||null,agent_id:'award-monitor',event_type:'award_notice_recorded',severity:'info',verified:true,source:'award-notice-api',message:`Award/contract notice recorded for ${opportunity.title}; contract review queued.`,metadata:{note}});
    return res.status(200).json({ok:true,work_packet:work});
  }catch(e){return res.status(500).json({ok:false,error:e.message});}
}
