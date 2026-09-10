import fs from 'node:fs';
import path from 'node:path';

function read(name){
  return JSON.parse(fs.readFileSync(path.join(process.cwd(),'data',name),'utf8'));
}

export default function handler(req,res){
  const agents=read('agents.json').agents;
  const integrations={
    openai:Boolean(process.env.OPENAI_API_KEY||process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN),
    database:Boolean(process.env.DATABASE_URL||(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)),
    gmail:Boolean(process.env.GMAIL_CLIENT_ID&&process.env.GMAIL_CLIENT_SECRET&&process.env.GMAIL_REFRESH_TOKEN),
    procurementFeeds:Boolean(process.env.PROCUREMENT_FEEDS_CONNECTED)
  };
  const researchReady=integrations.openai&&integrations.database&&integrations.procurementFeeds;
  const draftingReady=integrations.openai&&integrations.database;
  const communicationReady=draftingReady&&integrations.gmail;
  const departments={
    'Opportunity Intelligence':researchReady?'ready':'waiting',
    'Procurement Operations':researchReady?'ready':'waiting',
    'Vendor Research':researchReady?'ready':'waiting',
    'Proposal Studio':draftingReady?'ready':'waiting',
    'Compliance & Risk':draftingReady?'ready':'waiting',
    'Pricing & Finance':draftingReady?'ready':'waiting',
    'Outreach':communicationReady?'ready':'waiting',
    'Contracts & Delivery':draftingReady?'ready':'waiting',
    'Executive Operations':draftingReady?'ready':'waiting'
  };
  const readyAgents=agents.filter(a=>departments[a.department]==='ready').length;
  res.setHeader('Cache-Control','no-store');
  res.status(200).json({mode:'live-readiness',generatedAt:new Date().toISOString(),integrations,departments,readyAgents,blockedAgents:agents.length-readyAgents,queueDepth:0,approvals:[],events:[],progress:{found:0,qualified:0,proposals:0,submitted:0,awards:0},notice:'No execution is fabricated. Counts remain zero until persistent workflow integrations record verified work.'});
}
