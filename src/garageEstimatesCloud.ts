import {supabaseUserRequest} from './supabase'

type LocalEstimate={id:string;type:string;customer:string;vehicle:string;jobs:any[];createdAt:string;consumablesWaste?:number;consumablesVatRate?:number;customerNote?:string;additionalInformation?:string;locked?:boolean;convertedToId?:string;invoiceId?:string}
const context=()=>({token:sessionStorage.getItem('aa-cloud-access-token')||'',organizationId:sessionStorage.getItem('aa-organization-id')||'',actorId:sessionStorage.getItem('aa-actor-id')||''})
const estimateKeys=()=>Object.keys(localStorage).filter(key=>key.startsWith('aa-garage-quotes-'))
const allLocalEstimates=()=>estimateKeys().flatMap(key=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]}catch{return[]}}) as LocalEstimate[]
const totals=(estimate:LocalEstimate)=>{let subtotal=Number(estimate.consumablesWaste)||0,vat=(Number(estimate.consumablesWaste)||0)*(Number(estimate.consumablesVatRate)||0)/100;for(const job of estimate.jobs||[]){const labour=Number(job.labourHours)*Number(job.labourRate);subtotal+=labour;vat+=labour*Number(job.labourVatRate||0)/100;for(const part of job.parts||[]){const net=Number(part.quantity||1)*Number(part.price||0);subtotal+=net;vat+=net*Number(part.vatRate||0)/100}}return{subtotal,vat,total:subtotal+vat}}

async function performGarageEstimateSync(){
 const{token,organizationId,actorId}=context();if(!token||!organizationId)return
 const[customers,vehicles,parts,existing]=await Promise.all([
  supabaseUserRequest<any[]>(`customers?organization_id=eq.${organizationId}&select=id,name`,token),supabaseUserRequest<any[]>(`vehicles?organization_id=eq.${organizationId}&select=id,customer_id,registration`,token),supabaseUserRequest<any[]>(`parts?organization_id=eq.${organizationId}&select=id,part_number,name,cost_price`,token),supabaseUserRequest<any[]>(`documents?organization_id=eq.${organizationId}&document_type=eq.estimate&select=id,document_number`,token),
 ])
 for(const estimate of allLocalEstimates()){
  const customer=customers.find(row=>String(row.name).trim().toLowerCase()===String(estimate.customer).trim().toLowerCase()),registration=String(estimate.vehicle||'').split(' · ')[0].trim().toUpperCase(),vehicle=vehicles.find(row=>row.customer_id===customer?.id&&String(row.registration).toUpperCase()===registration)
  if(!customer||!vehicle)continue
  const amount=totals(estimate),saved=existing.find(row=>row.document_number===estimate.id),notes=JSON.stringify({customerNote:estimate.customerNote||'',additionalInformation:estimate.additionalInformation||'',consumablesVatRate:estimate.consumablesVatRate||0,convertedToId:estimate.convertedToId||null,invoiceId:estimate.invoiceId||null})
  const body={organization_id:organizationId,document_type:'estimate',document_number:estimate.id,customer_id:customer.id,vehicle_id:vehicle.id,status:estimate.locked?'converted':'draft',notes,consumables:Number(estimate.consumablesWaste)||0,waste:0,subtotal:amount.subtotal,vat_total:amount.vat,total:amount.total,locked_at:estimate.locked?new Date().toISOString():null,created_by:actorId||null,created_at:estimate.createdAt||new Date().toISOString()}
  let documentId=saved?.id
  if(documentId){await supabaseUserRequest(`documents?id=eq.${documentId}`,token,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)});await supabaseUserRequest(`document_jobs?document_id=eq.${documentId}`,token,{method:'DELETE',headers:{Prefer:'return=minimal'}})}else{const rows=await supabaseUserRequest<{id:string}[]>('documents?select=id',token,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});documentId=rows[0].id;existing.push({id:documentId,document_number:estimate.id})}
  for(let position=0;position<(estimate.jobs||[]).length;position++){
   const job=estimate.jobs[position],jobRows=await supabaseUserRequest<{id:string}[]>('document_jobs?select=id',token,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({organization_id:organizationId,document_id:documentId,name:job.name,description:'',labour_hours:Number(job.labourHours),labour_rate:Number(job.labourRate)||0,labour_vat_rate:Number(job.labourVatRate)||0,position})}),documentJobId=jobRows[0].id
   const localParts=[...(job.parts||[]),...(job.partName?[{name:job.partName,quantity:job.partQuantity,price:job.partPrice,vatRate:0}]:[])]
   for(let partPosition=0;partPosition<localParts.length;partPosition++){const part=localParts[partPosition],catalogue=parts.find(row=>String(row.name).toLowerCase()===String(part.name).toLowerCase());await supabaseUserRequest('document_parts',token,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({organization_id:organizationId,document_job_id:documentJobId,part_id:catalogue?.id||null,part_number:catalogue?.part_number||null,name:part.name,quantity:Number(part.quantity)||1,unit_cost:Number(catalogue?.cost_price)||0,unit_price:Number(part.price)||0,vat_rate:Number(part.vatRate)||0,position:partPosition})})}
  }
 }
}

let activeSync:Promise<void>|null=null
export async function syncLocalGarageEstimatesToCloud(){
 if(activeSync)return activeSync
 activeSync=performGarageEstimateSync()
 try{await activeSync}finally{activeSync=null}
}

export async function hydrateGarageEstimatesFromCloud(){
 const{token,organizationId}=context();if(!token||!organizationId)return
 const[documents,jobs,documentParts,customers,vehicles]=await Promise.all([
  supabaseUserRequest<any[]>(`documents?organization_id=eq.${organizationId}&document_type=eq.estimate&select=*`,token),supabaseUserRequest<any[]>(`document_jobs?organization_id=eq.${organizationId}&select=*`,token),supabaseUserRequest<any[]>(`document_parts?organization_id=eq.${organizationId}&select=*`,token),supabaseUserRequest<any[]>(`customers?organization_id=eq.${organizationId}&select=id,name`,token),supabaseUserRequest<any[]>(`vehicles?organization_id=eq.${organizationId}&select=id,registration,make,model`,token),
 ]);if(!documents.length)return
 for(const document of documents){const customer=customers.find(row=>row.id===document.customer_id),vehicle=vehicles.find(row=>row.id===document.vehicle_id);if(!customer||!vehicle)continue;let meta:any={};try{meta=JSON.parse(document.notes||'{}')}catch{}const estimate:LocalEstimate={id:document.document_number,type:'quote',customer:customer.name,vehicle:`${vehicle.registration} · ${vehicle.make} ${vehicle.model}`,createdAt:document.created_at,consumablesWaste:Number(document.consumables)||0,consumablesVatRate:Number(meta.consumablesVatRate)||0,customerNote:meta.customerNote||'',additionalInformation:meta.additionalInformation||'',locked:document.status==='converted'||!!document.locked_at,convertedToId:meta.convertedToId||undefined,invoiceId:meta.invoiceId||undefined,jobs:jobs.filter(job=>job.document_id===document.id).sort((a,b)=>a.position-b.position).map(job=>({id:`cloud-job-${job.id}`,name:job.name,labourHours:Number(job.labour_hours),labourRate:Number(job.labour_rate),labourVatRate:Number(job.labour_vat_rate),partName:'',partQuantity:1,partPrice:0,parts:documentParts.filter(part=>part.document_job_id===job.id).sort((a,b)=>a.position-b.position).map(part=>({id:`cloud-part-line-${part.id}`,name:part.name,description:'',quantity:Number(part.quantity),price:Number(part.unit_price),vatRate:Number(part.vat_rate)}))}))};const key=`aa-garage-quotes-${customer.name}`;let local:LocalEstimate[]=[];try{local=JSON.parse(localStorage.getItem(key)||'[]')}catch{};localStorage.setItem(key,JSON.stringify([estimate,...local.filter(row=>row.id!==estimate.id)]))}
 window.dispatchEvent(new Event('aa-garage-estimates-updated'))
}

let started=false
export function startGarageEstimatesCloudSync(){if(started)return;started=true;const nativeSet=Storage.prototype.setItem;let timer:number|undefined;Storage.prototype.setItem=function(key:string,value:string){nativeSet.call(this,key,value);if(this===localStorage&&key.startsWith('aa-garage-quotes-')){clearTimeout(timer);timer=window.setTimeout(()=>void syncLocalGarageEstimatesToCloud().catch(error=>window.dispatchEvent(new CustomEvent('aa-cloud-sync-error',{detail:error instanceof Error?error.message:'Estimate cloud sync failed.'}))),200)}}}
