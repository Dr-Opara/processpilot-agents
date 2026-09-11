import fs from 'node:fs';
import path from 'node:path';

// Single place that reads data/governance.json so the runtime actually
// consults the declared policy instead of only re-implementing it ad hoc in
// each caller. Cached per warm invocation; a cold start re-reads the file.
let cache=null;
function rules(){
  if(!cache)cache=JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','governance.json'),'utf8'));
  return cache;
}

export function actionMode(actionKey){
  return rules().actions?.[actionKey]?.mode||'opara_approval';
}

// Fail-closed: an action key that isn't declared, or that isn't explicitly
// marked automatic/automatic_by_role, is treated as requiring approval.
export function requiresApproval(actionKey){
  const mode=actionMode(actionKey);
  return mode!=='automatic'&&mode!=='automatic_by_role';
}
