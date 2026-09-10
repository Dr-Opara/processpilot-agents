export const SOURCES=[
{code:'tx_esbd',jurisdiction:'TX',name:'Texas ESBD',url:'https://www.txsmartbuy.gov/esbd'},
{code:'dc_ocp',jurisdiction:'DC',name:'DC Office of Contracting and Procurement',url:'https://ocp.dc.gov'},
{code:'md_emma',jurisdiction:'MD',name:'Maryland eMMA',url:'https://emma.maryland.gov'},
{code:'va_eva',jurisdiction:'VA',name:'Virginia eVA',url:'https://eva.virginia.gov'},
{code:'sam_gov',jurisdiction:'FEDERAL',name:'SAM.gov Contract Opportunities',url:'https://sam.gov/content/opportunities'}];
export function normalizeOpportunity(source,item){return {source_name:source.code,external_id:String(item.external_id||item.id||item.solicitation_number||item.url||''),source_url:item.url||source.url,jurisdiction:item.jurisdiction||source.jurisdiction,agency:item.agency||null,title:item.title||'Untitled opportunity',description:item.description||null,response_due_at:item.response_due_at||item.due_at||null,metadata:item};}
