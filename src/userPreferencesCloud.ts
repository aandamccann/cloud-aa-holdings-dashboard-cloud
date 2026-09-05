import {supabaseUserRequest} from './supabase'

const prefixes=['aa-sidebar-pins-','aa-page-widgets-','aa-widget-layout-','aa-widget-owned-','aa-capital-widget-layout-','aa-capital-widget-sizes-','aa-capital-widget-lock-']
const context=()=>({token:sessionStorage.getItem('aa-cloud-access-token')||'',organizationId:sessionStorage.getItem('aa-organization-id')||'',userId:sessionStorage.getItem('aa-actor-id')||''})
const isPreference=(key:string)=>prefixes.some(prefix=>key.startsWith(prefix))
const parse=(raw:string)=>{try{return JSON.parse(raw)}catch{return raw}}
const localPreferences=()=>Object.keys(localStorage).filter(isPreference).map(key=>({key,value:parse(localStorage.getItem(key)||'null')}))

export async function hydrateUserPreferencesFromCloud(){
 const{token,organizationId,userId}=context();if(!token||!organizationId||!userId)return
 const rows=await supabaseUserRequest<any[]>(`user_preferences?organization_id=eq.${organizationId}&user_id=eq.${userId}&select=preference_key,preference_value`,token)
 rows.forEach(row=>localStorage.setItem(row.preference_key,JSON.stringify(row.preference_value)))
 if(rows.length){window.dispatchEvent(new Event('aa-pins-changed'));window.dispatchEvent(new Event('aa-layout-preferences-updated'))}
}

async function performSync(){
 const{token,organizationId,userId}=context();if(!token||!organizationId||!userId)return
 const local=localPreferences(),rows=await supabaseUserRequest<any[]>(`user_preferences?organization_id=eq.${organizationId}&user_id=eq.${userId}&select=id,preference_key`,token),localKeys=new Set(local.map(item=>item.key))
 for(const item of local){const existing=rows.find(row=>row.preference_key===item.key),body={organization_id:organizationId,user_id:userId,preference_key:item.key,preference_value:item.value,updated_at:new Date().toISOString()};if(existing)await supabaseUserRequest(`user_preferences?id=eq.${existing.id}`,token,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)});else await supabaseUserRequest('user_preferences',token,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)})}
 for(const row of rows.filter(row=>!localKeys.has(row.preference_key)))await supabaseUserRequest(`user_preferences?id=eq.${row.id}`,token,{method:'DELETE',headers:{Prefer:'return=minimal'}})
}

let active:Promise<void>|null=null,started=false
export async function syncUserPreferencesToCloud(){if(active)return active;active=performSync();try{await active}finally{active=null}}
export function startUserPreferencesCloudSync(){if(started)return;started=true;const nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem;let timer:number|undefined;const schedule=()=>{clearTimeout(timer);timer=window.setTimeout(()=>void syncUserPreferencesToCloud().catch(error=>window.dispatchEvent(new CustomEvent('aa-cloud-sync-error',{detail:error instanceof Error?error.message:'User preferences cloud sync failed.'}))),250)};Storage.prototype.setItem=function(key:string,value:string){nativeSet.call(this,key,value);if(this===localStorage&&isPreference(key))schedule()};Storage.prototype.removeItem=function(key:string){nativeRemove.call(this,key);if(this===localStorage&&isPreference(key))schedule()}}
