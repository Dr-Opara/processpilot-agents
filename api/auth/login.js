import {passwordLogin,setSessionCookies} from '../../lib/auth.js';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const {email,password}=req.body||{};
  if(!email||!password)return res.status(400).json({error:'Email and password are required'});
  try{
    const data=await passwordLogin(String(email).trim().toLowerCase(),String(password));
    setSessionCookies(res,{accessToken:data.access_token,refreshToken:data.refresh_token,expiresIn:data.expires_in});
    return res.status(200).json({ok:true,user:{id:data.user?.id,email:data.user?.email}});
  }catch(e){
    console.error('Login failed', e.message);
    // Deliberately generic -- do not confirm/deny whether an email exists.
    return res.status(401).json({error:'Invalid email or password'});
  }
}
