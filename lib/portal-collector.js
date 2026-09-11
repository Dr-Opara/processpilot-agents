import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {SOURCES,isAllowedOpportunity} from './sources.js';
import {db,findOpportunity,upsertOpportunity,ensureWorkPacket,insertEvent} from './db.js';
import {runAgentModel} from './ai.js';

function scout(){return JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','agents.json'),'utf8')).agents.find(a=>a.id==='opportunity-scout');}
function parseJson(s){try{return JSON.parse(s);}catch{const m=String(s).match(/\{[\s\S]*\}/);try{return m?JSON.parse(m[0]):null;}catch{return null;}}}
function absolute(base,href){try{return new URL(href,base).toString();}catch{return null;}}
function stripHtml(x=''){return String(x).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();}
function links(html,base){const out=[];const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;while((m=re.exec(html))){const url=absolute(base,m[1]);if(url)out.push({url,text:stripHtml(m[2])});}return out;}
function likelyOpportunityLink(source,l){const u=l.url.toLowerCase(),t=l.text.toLowerCase();if(source.code==='dc_ocp')return /solicitations\/(details|attachments)/.test(u)||/(rfp|rfq|solicitation|bid)/.test(t);if(source.code==='tx_esbd')return /(esbd|solicitation|bid|rfp|rfq)/.test(u+' '+t);if(source.code==='md_emma')return /(solicitation|bid|rfp|rfq|opportunit)/.test(u+' '+t);if(source.code==='va_eva')return /(opportunit|solicitation|vbo|rfp|rfq|bid)/.test(u+' '+t);return false;}
function stableId(source,url,title=''){return crypto.createHash('sha256').update(`${source.code}|${url}|${title}`).digest('hex').slice(0,40);}

async function fetchText(url){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(url,{redirect:'follow',signal:controller.signal,headers:{'user-agent':'Mozilla/5.0 (compatible; ProcessPilot/1.0; +https://processpilottech.com)'}});const text=await r.text();return {ok:r.ok,status:r.status,url:r.url,text:text.slice(0,500000),contentType:r.headers.get('content-type')||''};}finally{clearTimeout(timer);}}

async function normalizeFromPage(source,url,text){const plain=stripHtml(text).slice(0,40000);if(plain.length<80)return null;const ai=await runAgentModel({agent:scout(),input:{task:'Analyze this public procurement page. Return JSON only with keys is_opportunity,status,external_id,title,agency,description,solicitation_type,response_due_at,posted_at,jurisdiction,market,confidence. Only return is_opportunity=true for a specific solicitation or bid opportunity, not a search page, homepage, help page, award notice, forecast, or general vendor information. Federal work is prohibited. If status is clearly CLOSED, CANCELLED, or AWARDED, preserve that status.',source:{code:source.code,jurisdiction:source.jurisdiction,url},page_text:plain}});return parseJson(ai.output);}

async function setSourceResult(source,{success,error=null,records=0,mode='direct_public'}){const now=new Date().toISOString();await db(`source_registry?code=eq.${encodeURIComponent(source.code)}`,{method:'PATCH',body:JSON.stringify({last_checked_at:now,last_success_at:success?now:null,last_error:error,config:{collector_mode:mode,last_records:records,last_status:success?'success':'degraded'}})}).catch(()=>{});}

export async function collectPortal(source,{maxDetailPages=12}={}){
  const result={source:source.code,reachable:false,candidates:0,retrieved:0,ingested:0,duplicates:0,excluded:0,errors:[]};
  let root;
  try{root=await fetchText(source.url);}catch(e){result.errors.push(e.message);await setSourceResult(source,{success:false,error:e.message});return result;}
  result.reachable=root.ok;
  if(!root.ok){const error=`HTTP ${root.status}`;result.errors.push(error);await setSourceResult(source,{success:false,error});return result;}
  const candidates=links(root.text,root.url).filter(l=>likelyOpportunityLink(source,l));
  const unique=[...new Map(candidates.map(x=>[x.url,x])).values()].slice(0,maxDetailPages);
  result.candidates=unique.length;
  for(const candidate of unique){
    try{
      const page=await fetchText(candidate.url);
      if(!page.ok){result.errors.push(`HTTP ${page.status} for ${candidate.url}`);continue;}
      result.retrieved++;
      const x=await normalizeFromPage(source,page.url,page.text);if(!x?.is_opportunity||Number(x.confidence||0)<0.65)continue;
      const state=String(x.status||'OPEN').toUpperCase();if(['CLOSED','CANCELLED','AWARDED'].includes(state))continue;
      const item={external_id:String(x.external_id||stableId(source,page.url,x.title)),source_name:source.code,source_url:page.url,jurisdiction:x.jurisdiction||source.jurisdiction,agency:x.agency||null,title:x.title||candidate.text||'Untitled opportunity',description:x.description||null,solicitation_type:x.solicitation_type||'RFP',posted_at:x.posted_at||null,response_due_at:x.response_due_at||null,status:'discovered',risk_flags:[],metadata:{market:x.market||source.market||'state',collector:'direct_public',confidence:x.confidence}};
      if(!isAllowedOpportunity(item)){result.excluded++;continue;}
      if(await findOpportunity(source.code,item.external_id)){result.duplicates++;continue;}
      const saved=await upsertOpportunity(item);const work=await ensureWorkPacket({opportunityId:saved.id,input:{opportunity_id:saved.id,title:saved.title,source_url:saved.source_url,jurisdiction:saved.jurisdiction}});await insertEvent({opportunity_id:saved.id,work_packet_id:work?.id||null,agent_id:'opportunity-scout',event_type:'opportunity_ingested',severity:'info',message:`Portal opportunity ingested: ${saved.title}`,verified:true,source:source.code,metadata:{collector:'direct_public'}});result.ingested++;
    }catch(e){result.errors.push(e.message);}
  }
  // A portal is only "successful" if there was genuinely nothing to check
  // (zero candidate links found) or at least one candidate page was actually
  // retrieved. Root-page-reachable is not the same as successful retrieval --
  // if every candidate detail page failed, this must not be reported healthy.
  const success=result.candidates===0||result.retrieved>0;
  await setSourceResult(source,{success,records:result.ingested,error:success?(result.errors[0]||null):(result.errors[0]||'No candidate pages could be retrieved successfully')});
  return result;
}

export async function collectAllPortals(){const results=[];for(const source of SOURCES)results.push(await collectPortal(source));const ingested=results.reduce((n,x)=>n+x.ingested,0);await insertEvent({agent_id:'source-monitor',event_type:'portal_collection_completed',message:`Portal collection completed across ${results.length} approved state/local sources; ${ingested} new opportunities ingested.`,severity:results.some(x=>x.errors.length)?'warning':'info',verified:true,source:'portal-collector',metadata:{results}});return {ingested,results};}
