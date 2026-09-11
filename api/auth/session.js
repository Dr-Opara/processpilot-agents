import {getSessionUser,setSessionCookies} from '../../lib/auth.js';

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  res.setHeader('Cache-Control','no-store');
  try{
    const session=await getSessionUser(req);
    if(!session)return res.status(200).json({authenticated:false});
    if(session.refreshed)setSessionCookies(res,session.refreshed);
    return res.status(200).json({authenticated:true,user:{id:session.user.id,email:session.user.email}});
  }catch(e){
    // Supabase Auth not configured, or a transient error -- report as
    // unauthenticated rather than leaking configuration state.
    return res.status(200).json({authenticated:false});
  }
}
