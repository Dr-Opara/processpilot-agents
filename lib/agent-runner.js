import fs from 'node:fs';
import path from 'node:path';
import {runAgentModel} from './ai.js';
import {db,createAgentRun,updateAgentRun,createArtifact,createApproval,insertEvent,updateWork} from './db.js';

function registry(){return JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','agents.json'),'utf8')).agents;}
function byId(id){const a=registry().find(x=>x.id===id);if(!a)throw new Error(`Unknown agent ${id}`);return a;}
function parseJson(text){try{return JSON.parse(text);}catch{return {summary:text};}}

const STAGES={
  qualify:['opportunity-analyst','fit-scorer','bid-no-bid'],
  capture:['agency-researcher','incumbent-researcher','partner-researcher','capture-analyst','deadline-monitor'],
  proposal:['requirements-analyst','compliance-matrix','registration-analyst','past-performance','proposal-writer','technical-writer','executive-writer','proposal-reviewer','clause-analyst','pricing-analyst','margin-reviewer'],
  delivery:['contracts-reviewer','delivery-manager','performance-analyst']
};

async function loadOpportunity(id){const rows=await db(`opportunities?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);return rows?.[0]||null;}
async function loadArtifacts(opportunityId){return db(`artifacts?opportunity_id=eq.${encodeURIComponent(opportunityId)}&select=artifact_type,title,content,status,created_at&order=created_at.asc`);}
async function recordEvent(agentId,eventType,message,{opportunityId,workPacketId,severity='info',metadata={}}={}){await insertEvent({agent_id:agentId,event_type:eventType,message,severity,verified:true,source:'agent-runtime',opportunity_id:opportunityId||null,work_packet_id:workPacketId||null,metadata});}

function promptFor(agent,opportunity,artifacts){return {
  opportunity,
  prior_artifacts:artifacts,
  required_output:{format:'json',fields:['summary','findings','recommendation','risks','next_actions']},
  instructions:'Use only evidence present in the opportunity and prior artifacts. If evidence is missing, say so. Do not invent capabilities, past performance, pricing, certifications, deadlines, contacts, or submission facts.'
};}

async function executeAgent(agentId,packet,opportunity){const agent=byId(agentId);const artifacts=await loadArtifacts(opportunity.id);const runs=await createAgentRun({work_packet_id:packet.id,opportunity_id:opportunity.id,agent_id:agent.id,department:agent.department,status:'running',input:{stage:packet.current_stage,opportunity_id:opportunity.id},started_at:new Date().toISOString()});const run=runs?.[0];await updateWork(packet.id,{status:'running',current_agent_id:agent.id,started_at:packet.started_at||new Date().toISOString()});await recordEvent(agent.id,'agent_started',`${agent.name} started work on ${opportunity.title}.`,{opportunityId:opportunity.id,workPacketId:packet.id});try{const result=await runAgentModel({agent,input:promptFor(agent,opportunity,artifacts)});const parsed=parseJson(result.output);await createArtifact({opportunity_id:opportunity.id,work_packet_id:packet.id,agent_run_id:run?.id||null,artifact_type:agent.id,title:`${agent.name} output`,content:parsed,status:'draft'});if(run?.id)await updateAgentRun(run.id,{status:'completed',model:result.model,output:parsed,completed_at:new Date().toISOString()});await recordEvent(agent.id,'agent_completed',`${agent.name} completed its assigned analysis.`,{opportunityId:opportunity.id,workPacketId:packet.id,metadata:{model:result.model}});return parsed;}catch(e){if(run?.id)await updateAgentRun(run.id,{status:'failed',output:{error:e.message},completed_at:new Date().toISOString()});await updateWork(packet.id,{status:'failed',error:e.message});await recordEvent(agent.id,'agent_failed',`${agent.name} failed: ${e.message}`,{opportunityId:opportunity.id,workPacketId:packet.id,severity:'error'});throw e;}}

async function qualificationDecision(packet,opportunity){const artifacts=await loadArtifacts(opportunity.id);const bid=artifacts.filter(a=>a.artifact_type==='bid-no-bid').at(-1)?.content||{};const fit=artifacts.filter(a=>a.artifact_type==='fit-scorer').at(-1)?.content||{};const summary=bid.summary||bid.recommendation||'Qualification analysis completed.';const existing=await db(`approvals?work_packet_id=eq.${packet.id}&approval_type=eq.pursuit_decision&status=eq.pending&select=id&limit=1`);if(!existing?.length)await createApproval({opportunity_id:opportunity.id,work_packet_id:packet.id,requested_by_agent_id:'executive-brief',approval_type:'pursuit_decision',title:`Pursuit decision: ${opportunity.title}`,summary,payload:{fit,decision:bid},status:'pending'});await updateWork(packet.id,{status:'waiting_approval',current_agent_id:'executive-brief',current_stage:'pursuit_review',output:{qualification_complete:true}});await db(`opportunities?id=eq.${opportunity.id}`,{method:'PATCH',body:JSON.stringify({status:'pursuit_review'})});await recordEvent('executive-brief','approval_requested',`Chief of Staff review requested for ${opportunity.title}.`,{opportunityId:opportunity.id,workPacketId:packet.id,severity:'warning'});}

export async function runWorkPacket(packet){const opportunity=await loadOpportunity(packet.opportunity_id);if(!opportunity)throw new Error('Opportunity not found');const stage=packet.current_stage||'qualify';const sequence=STAGES[stage]||[];if(!sequence.length)throw new Error(`Unsupported stage ${stage}`);for(const agentId of sequence)await executeAgent(agentId,packet,opportunity);if(stage==='qualify'){await qualificationDecision(packet,opportunity);return {status:'waiting_approval'};}await updateWork(packet.id,{status:'completed',completed_at:new Date().toISOString(),output:{stage_complete:stage}});await recordEvent(sequence.at(-1),'stage_completed',`${stage} stage completed for ${opportunity.title}.`,{opportunityId:opportunity.id,workPacketId:packet.id,severity:'success'});return {status:'completed'};}

export async function runQueuedWork(limit=1){const packets=await db(`work_packets?status=eq.queued&select=*&order=priority.desc,created_at.asc&limit=${limit}`);const results=[];for(const packet of packets||[]){try{results.push({id:packet.id,...await runWorkPacket(packet)});}catch(e){results.push({id:packet.id,status:'failed',error:e.message});}}return results;}
