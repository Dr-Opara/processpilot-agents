function cfg(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Database not configured');return {url,key};}
export async function db(path,options={}){const {url,key}=cfg();const r=await fetch(`${url}/rest/v1/${path}`,{...options,headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json',prefer:'return=representation',...(options.headers||{})}});const text=await r.text();if(!r.ok)throw new Error(`DB ${r.status}: ${text.slice(0,500)}`);return text?JSON.parse(text):null;}
export const listOpportunities=(limit=100)=>db(`opportunities?select=*&order=created_at.desc&limit=${limit}`);
export const listApprovals=(limit=100)=>db(`approvals?select=*&order=created_at.desc&limit=${limit}`);
export const listEvents=(limit=100)=>db(`activity_events?select=*&verified=eq.true&order=created_at.desc&limit=${limit}`);
export const listWork=(limit=100)=>db(`work_packets?select=*&order=created_at.desc&limit=${limit}`);
export const listCompanyKnowledge=(limit=100)=>db(`company_knowledge?status=eq.approved&select=knowledge_key,category,title,content,approved_for_external_use,source_document&order=category,title&limit=${limit}`);
export const listDocumentTemplates=(category=null)=>db(`document_templates?status=eq.approved${category?`&category=eq.${encodeURIComponent(category)}`:''}&select=template_key,category,title,body,external_use_allowed,human_approval_required`);
export const listOutreachProspects=(limit=100)=>db(`outreach_prospects?select=*&order=created_at.desc&limit=${limit}`);
export const insertEvent=(event)=>db('activity_events',{method:'POST',body:JSON.stringify(event)});
export const createWork=(packet)=>db('work_packets',{method:'POST',body:JSON.stringify(packet)});
export const updateWork=(id,patch)=>db(`work_packets?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(patch)});
export const createArtifact=(artifact)=>db('artifacts',{method:'POST',body:JSON.stringify(artifact)});
export const createAgentRun=(run)=>db('agent_runs',{method:'POST',body:JSON.stringify(run)});
export const updateAgentRun=(id,patch)=>db(`agent_runs?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(patch)});
export const createApproval=(approval)=>db('approvals',{method:'POST',body:JSON.stringify(approval)});
export async function upsertOpportunity(opportunity){const rows=await db('opportunities?on_conflict=source_name,external_id',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(opportunity)});return rows?.[0]||null;}
export async function findOpportunity(sourceName,externalId){const rows=await db(`opportunities?source_name=eq.${encodeURIComponent(sourceName)}&external_id=eq.${encodeURIComponent(externalId)}&select=*&limit=1`);return rows?.[0]||null;}
export async function upsertOutreachProspect(prospect){const rows=await db('outreach_prospects?on_conflict=email',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(prospect)});return rows?.[0]||null;}
export async function ensureWorkPacket({opportunityId,workflowId='opportunity-intake',agentId='opportunity-analyst',stage='qualify',priority=50,input={}}){const existing=await db(`work_packets?opportunity_id=eq.${opportunityId}&workflow_id=eq.${encodeURIComponent(workflowId)}&status=in.(queued,running,waiting_input,waiting_approval)&select=*&limit=1`);if(existing?.length)return existing[0];const rows=await createWork({opportunity_id:opportunityId,workflow_id:workflowId,current_agent_id:agentId,current_stage:stage,status:'queued',priority,input});return rows?.[0]||null;}
