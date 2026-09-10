import {collectAllPortals} from '../../lib/portal-collector.js';
function authorized(req){const s=process.env.PROCESSPILOT_RUN_SECRET;return Boolean(s&&req.headers.authorization===`Bearer ${s}`);}
export default async function handler(req,res){if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});if(!authorized(req))return res.status(401).json({error:'Unauthorized'});try{return res.status(200).json({ok:true,...await collectAllPortals()});}catch(e){return res.status(500).json({ok:false,error:e.message});}}
