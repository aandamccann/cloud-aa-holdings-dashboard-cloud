import {readGarageParts,readGarageSuppliers,saveGarageParts,saveGarageSuppliers,type GaragePart} from './garageParts'
import {supabaseUserRequest} from './supabase'

type CloudSupplier={id:string;name:string}
type CloudPart={id:string;part_number:string;name:string;description:string|null;supplier_id:string|null;cost_price:number;selling_price:number;vat_rate:number;stock_quantity:number}
const context=()=>({token:sessionStorage.getItem('aa-cloud-access-token')||'',organizationId:sessionStorage.getItem('aa-organization-id')||''})

export async function syncLocalGaragePartsToCloud(){
 const{token,organizationId}=context();if(!token||!organizationId)return
 const localParts=readGarageParts(),supplierNames=Array.from(new Set([...readGarageSuppliers(),...localParts.map(part=>part.supplier).filter(Boolean)]))
 let cloudSuppliers=await supabaseUserRequest<CloudSupplier[]>(`suppliers?organization_id=eq.${organizationId}&select=id,name`,token)
 for(const name of supplierNames){if(cloudSuppliers.some(row=>row.name.toLowerCase()===name.toLowerCase()))continue;const saved=await supabaseUserRequest<CloudSupplier[]>('suppliers?select=id,name',token,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({organization_id:organizationId,name})});cloudSuppliers=[...cloudSuppliers,...saved]}
 const supplierIds=new Map(cloudSuppliers.map(row=>[row.name.toLowerCase(),row.id])),cloudParts=await supabaseUserRequest<{id:string;part_number:string}[]>(`parts?organization_id=eq.${organizationId}&select=id,part_number`,token)
 for(const part of localParts){
  const existing=cloudParts.find(row=>row.part_number.toLowerCase()===part.sku.toLowerCase()),body={organization_id:organizationId,part_number:part.sku,name:part.name,description:part.description||null,supplier_id:part.supplier?supplierIds.get(part.supplier.toLowerCase())||null:null,cost_price:Number(part.cost)||0,selling_price:Number(part.price)||0,vat_rate:Number(part.vatRate)||0,stock_quantity:Number(part.stock)||0,active:true}
  if(existing)await supabaseUserRequest(`parts?id=eq.${existing.id}`,token,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)});else await supabaseUserRequest('parts',token,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)})
 }
}

export async function hydrateGaragePartsFromCloud(){
 const{token,organizationId}=context();if(!token||!organizationId)return
 const[suppliers,parts]=await Promise.all([supabaseUserRequest<CloudSupplier[]>(`suppliers?organization_id=eq.${organizationId}&select=id,name`,token),supabaseUserRequest<CloudPart[]>(`parts?organization_id=eq.${organizationId}&active=eq.true&select=id,part_number,name,description,supplier_id,cost_price,selling_price,vat_rate,stock_quantity`,token)])
 if(!suppliers.length&&!parts.length)return
 const supplierNames=new Map(suppliers.map(row=>[row.id,row.name])),localParts=readGarageParts(),cloudNumbers=new Set(parts.map(row=>row.part_number.toLowerCase())),merged:GaragePart[]=[...parts.map(row=>({id:`cloud-part-${row.id}`,name:row.name,description:row.description||'',partNumber:row.part_number,sku:row.part_number,unit:'each',price:Number(row.selling_price),cost:Number(row.cost_price),stock:Number(row.stock_quantity),supplier:row.supplier_id?supplierNames.get(row.supplier_id)||'':'',vatRate:Number(row.vat_rate)})),...localParts.filter(part=>!cloudNumbers.has(part.sku.toLowerCase()))]
 saveGarageSuppliers(Array.from(new Set([...suppliers.map(row=>row.name),...readGarageSuppliers()])))
 saveGarageParts(merged)
}

let started=false
export function startGaragePartsCloudSync(){if(started)return;started=true;let timer:number|undefined;const sync=()=>{clearTimeout(timer);timer=window.setTimeout(()=>void syncLocalGaragePartsToCloud().catch(error=>window.dispatchEvent(new CustomEvent('aa-cloud-sync-error',{detail:error instanceof Error?error.message:'Parts cloud sync failed.'}))),150)};window.addEventListener('aa-garage-parts-updated',sync);window.addEventListener('aa-garage-suppliers-updated',sync)}
