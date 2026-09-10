export const SOURCES=[
{code:'tx_esbd',jurisdiction:'TX',name:'Texas ESBD',url:'https://www.txsmartbuy.gov/esbd',market:'state'},
{code:'dc_ocp',jurisdiction:'DC',name:'DC Office of Contracting and Procurement',url:'https://ocp.dc.gov',market:'local'},
{code:'md_emma',jurisdiction:'MD',name:'Maryland eMMA',url:'https://emma.maryland.gov',market:'state'},
{code:'va_eva',jurisdiction:'VA',name:'Virginia eVA',url:'https://eva.virginia.gov',market:'state'}
];

export const ALLOWED_MARKETS=new Set(['state','local','private','commercial']);
export const DISALLOWED_MARKETS=new Set(['federal']);

export function isAllowedOpportunity(item={}){
  const market=String(item.market||item.contract_type||'').toLowerCase();
  const jurisdiction=String(item.jurisdiction||'').toUpperCase();
  const sourceName=String(item.source_name||item.source||'').toLowerCase();
  if(market==='federal'||jurisdiction==='FEDERAL')return false;
  if(sourceName.includes('sam.gov')||sourceName.includes('sam_gov'))return false;
  return !market||ALLOWED_MARKETS.has(market);
}

export function normalizeOpportunity(source,item){
  if(!isAllowedOpportunity({...item,market:item.market||source.market,jurisdiction:item.jurisdiction||source.jurisdiction,source_name:source.code}))return null;
  return {
    source_name:source.code,
    external_id:String(item.external_id||item.id||item.solicitation_number||item.url||''),
    source_url:item.url||source.url,
    jurisdiction:item.jurisdiction||source.jurisdiction,
    agency:item.agency||null,
    title:item.title||'Untitled opportunity',
    description:item.description||null,
    response_due_at:item.response_due_at||item.due_at||null,
    metadata:{...item,market:item.market||source.market||'state'}
  };
}
