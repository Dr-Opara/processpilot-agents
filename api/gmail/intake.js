import {scanGmailForRfps} from '../../lib/gmail-intake.js';
function auth(req){return process.env.PROCESSPILOT_RUN_SECRET&&req.headers.authorization===`Bearer ${process.env.PROCESSPILOT_RUN_SECRET}`;}
export default async function handler(req,res){if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});if(!auth(req))return res.status(401).json({error:'Unauthorized'});try{return res.status(200).json({ok:true,...await scanGmailForRfps({query:req.body?.query,limit:req.body?.limit||10})});}catch(e){return res.status(500).json({ok:false,error:e.message});}}
