import {signJobAttachment,supabaseUserRequest} from './supabase'

const storageKey='aa-completed-workshop-jobs'
const context=()=>({token:sessionStorage.getItem('aa-cloud-access-token')||'',organizationId:sessionStorage.getItem('aa-organization-id')||'',actorId:sessionStorage.getItem('aa-actor-id')||''})
const readLocal=():any[]=>{try{const value=JSON.parse(localStorage.getItem(storageKey)||'[]');return Array.isArray(value)?value:[]}catch{return[]}}

async function refreshAttachmentUrls(record:any){
 const attachments=await Promise.all((record.attachments||[]).map(async(file:any)=>file.path?{...file,url:await signJobAttachment(file.path).catch(()=>file.url)}:file))
 return{...record,attachments}
}

export async function hydrateCompletedJobsFromCloud(){
 const{token,organizationId}=context();if(!token||!organizationId)return
 const rows=await supabaseUserRequest<any[]>(`completed_jobs?organization_id=eq.${organizationId}&select=legacy_source_id,record&order=created_at.desc`,token)
 if(!rows.length)return
 const cloud=await Promise.all(rows.map(row=>refreshAttachmentUrls({...row.record,id:row.legacy_source_id}))),cloudIds=new Set(cloud.map(job=>String(job.id))),merged=[...cloud,...readLocal().filter(job=>!cloudIds.has(String(job.id)))]
 localStorage.setItem(storageKey,JSON.stringify(merged));window.dispatchEvent(new Event('aa-completed-jobs-updated'))
}

async function performSync(){
 const{token,organizationId,actorId}=context();if(!token||!organizationId)return
 const local=readLocal(),rows=await supabaseUserRequest<any[]>(`completed_jobs?organization_id=eq.${organizationId}&select=id,legacy_source_id`,token),localIds=new Set(local.map(job=>String(job.id)))
 for(const job of local){const existing=rows.find(row=>row.legacy_source_id===String(job.id)),body={organization_id:organizationId,legacy_source_id:String(job.id),record:job,created_by:actorId||null,updated_at:new Date().toISOString()};if(existing)await supabaseUserRequest(`completed_jobs?id=eq.${existing.id}`,token,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)});else await supabaseUserRequest('completed_jobs',token,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)})}
 for(const row of rows.filter(row=>!localIds.has(String(row.legacy_source_id))))await supabaseUserRequest(`completed_jobs?id=eq.${row.id}`,token,{method:'DELETE',headers:{Prefer:'return=minimal'}})
}

let active:Promise<void>|null=null,started=false
export async function syncCompletedJobsToCloud(){if(active)return active;active=performSync();try{await active}finally{active=null}}
export function startCompletedJobsCloudSync(){if(started)return;started=true;const nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem;let timer:number|undefined;const schedule=()=>{clearTimeout(timer);timer=window.setTimeout(()=>void syncCompletedJobsToCloud().catch(error=>window.dispatchEvent(new CustomEvent('aa-cloud-sync-error',{detail:error instanceof Error?error.message:'Completed jobs cloud sync failed.'}))),200)};Storage.prototype.setItem=function(key:string,value:string){nativeSet.call(this,key,value);if(this===localStorage&&key===storageKey)schedule()};Storage.prototype.removeItem=function(key:string){nativeRemove.call(this,key);if(this===localStorage&&key===storageKey)schedule()}}
