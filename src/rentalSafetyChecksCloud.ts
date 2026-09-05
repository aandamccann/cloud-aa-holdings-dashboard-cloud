import {signJobAttachment,supabaseUserRequest} from './supabase'

const storageKey='aa-rental-safety-checks'
const context=()=>({token:sessionStorage.getItem('aa-cloud-access-token')||'',organizationId:sessionStorage.getItem('aa-organization-id')||'',actorId:sessionStorage.getItem('aa-actor-id')||''})
const readLocal=():any[]=>{try{const value=JSON.parse(localStorage.getItem(storageKey)||'[]');return Array.isArray(value)?value:[]}catch{return[]}}

async function refreshAttachmentUrls(record:any){
 const attachments=await Promise.all((record.attachments||[]).map(async(file:any)=>file.path?{...file,url:await signJobAttachment(file.path).catch(()=>file.url)}:file))
 return{...record,attachments}
}

export async function hydrateRentalSafetyChecksFromCloud(){
 const{token,organizationId}=context();if(!token||!organizationId)return
 const rows=await supabaseUserRequest<any[]>(`rental_safety_checks?organization_id=eq.${organizationId}&select=legacy_source_id,record&order=created_at.desc`,token)
 if(!rows.length)return
 const cloud=await Promise.all(rows.map(row=>refreshAttachmentUrls({...row.record,id:row.legacy_source_id}))),cloudIds=new Set(cloud.map(check=>String(check.id))),merged=[...cloud,...readLocal().filter(check=>!cloudIds.has(String(check.id)))]
 localStorage.setItem(storageKey,JSON.stringify(merged));window.dispatchEvent(new Event('aa-rental-safety-checks-updated'))
}

async function performSync(){
 const{token,organizationId,actorId}=context();if(!token||!organizationId)return
 const local=readLocal(),rows=await supabaseUserRequest<any[]>(`rental_safety_checks?organization_id=eq.${organizationId}&select=id,legacy_source_id`,token),localIds=new Set(local.map(check=>String(check.id)))
 for(const check of local){const existing=rows.find(row=>row.legacy_source_id===String(check.id)),body={organization_id:organizationId,legacy_source_id:String(check.id),pair_id:String(check.pairId||''),direction:check.direction,registration:check.reg||'',inspection_date:check.date||null,record:check,created_by:actorId||null,updated_at:new Date().toISOString()};if(existing)await supabaseUserRequest(`rental_safety_checks?id=eq.${existing.id}`,token,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)});else await supabaseUserRequest('rental_safety_checks',token,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)})}
 for(const row of rows.filter(row=>!localIds.has(String(row.legacy_source_id))))await supabaseUserRequest(`rental_safety_checks?id=eq.${row.id}`,token,{method:'DELETE',headers:{Prefer:'return=minimal'}})
}

let active:Promise<void>|null=null,started=false
export async function syncRentalSafetyChecksToCloud(){if(active)return active;active=performSync();try{await active}finally{active=null}}
export function startRentalSafetyChecksCloudSync(){if(started)return;started=true;const nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem;let timer:number|undefined;const schedule=()=>{clearTimeout(timer);timer=window.setTimeout(()=>void syncRentalSafetyChecksToCloud().catch(error=>window.dispatchEvent(new CustomEvent('aa-cloud-sync-error',{detail:error instanceof Error?error.message:'Rental safety checks cloud sync failed.'}))),200)};Storage.prototype.setItem=function(key:string,value:string){nativeSet.call(this,key,value);if(this===localStorage&&key===storageKey)schedule()};Storage.prototype.removeItem=function(key:string){nativeRemove.call(this,key);if(this===localStorage&&key===storageKey)schedule()}}
