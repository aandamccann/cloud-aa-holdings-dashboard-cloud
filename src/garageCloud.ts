import {supabaseUserRequest} from './supabase'

type CloudCustomer={id:string;legacy_source_id:string|null;name:string;company_name:string|null;email:string|null;phone:string|null;address:string|null}
type CloudVehicle={id:string;customer_id:string;legacy_source_id:string|null;registration:string;make:string;model:string;year:number|null;vin:string|null;notes:string|null}
const context=()=>({token:sessionStorage.getItem('aa-cloud-access-token')||'',organizationId:sessionStorage.getItem('aa-organization-id')||'',actorId:sessionStorage.getItem('aa-actor-id')||''})

export async function hydrateGarageCloudRecords(){
 const{token,organizationId}=context();if(!token||!organizationId)return
 const[customers,vehicles]=await Promise.all([
  supabaseUserRequest<CloudCustomer[]>(`customers?organization_id=eq.${organizationId}&select=id,legacy_source_id,name,company_name,email,phone,address`,token),
  supabaseUserRequest<CloudVehicle[]>(`vehicles?organization_id=eq.${organizationId}&select=id,customer_id,legacy_source_id,registration,make,model,year,vin,notes`,token),
 ])
 if(!customers.length&&!vehicles.length)return
 let local:any[]=[];try{local=JSON.parse(localStorage.getItem('aa-garage-customer-records-v1')||'[]')}catch{}
 const byLegacy=new Map(local.map(item=>[String(item.id),item])),customerIdMap=new Map<string,string>()
 const merged=customers.map(row=>{const localId=row.legacy_source_id||`cloud-customer-${row.id}`,existing:any=byLegacy.get(localId)||{};customerIdMap.set(row.id,localId);return{...existing,id:localId,name:row.name,firstName:existing.firstName||row.name.split(/\s+/)[0]||'',lastName:existing.lastName||row.name.split(/\s+/).slice(1).join(' '),company:row.company_name||'',email:row.email||'Not recorded',phone:row.phone||'',address:row.address||'Not recorded',vehicles:existing.vehicles||[]}})
 const cloudLegacyIds=new Set(merged.map(row=>String(row.id))),complete=[...merged,...local.filter(row=>!cloudLegacyIds.has(String(row.id)))]
 localStorage.setItem('aa-garage-customer-records-v1',JSON.stringify(complete))
 customers.forEach(row=>localStorage.setItem(`aa-garage-vehicles-${customerIdMap.get(row.id)}`,JSON.stringify(vehicles.filter(vehicle=>vehicle.customer_id===row.id).map(vehicle=>({id:vehicle.legacy_source_id||`cloud-vehicle-${vehicle.id}`,reg:vehicle.registration,make:vehicle.make,model:vehicle.model,year:vehicle.year||'',vin:vehicle.vin||'',notes:vehicle.notes||'',extraDetails:{}})))))
 window.dispatchEvent(new Event('aa-garage-customers-updated'));window.dispatchEvent(new Event('aa-garage-vehicles-updated'))
}

export async function saveGarageCustomerToCloud(customer:any){
 const{token,organizationId,actorId}=context();if(!token||!organizationId)return
 const legacyId=String(customer.id),cloudId=legacyId.startsWith('cloud-customer-')?legacyId.slice('cloud-customer-'.length):'',lookup=cloudId?`customers?organization_id=eq.${organizationId}&id=eq.${encodeURIComponent(cloudId)}&select=id`:`customers?organization_id=eq.${organizationId}&legacy_source_id=eq.${encodeURIComponent(legacyId)}&select=id`,rows=await supabaseUserRequest<{id:string}[]>(lookup,token),body={organization_id:organizationId,legacy_source_id:legacyId,customer_type:customer.company?'business':'personal',name:customer.name,company_name:customer.company||null,email:customer.email==='Not recorded'?null:customer.email||null,phone:customer.phone||null,address:customer.address==='Not recorded'?null:customer.address||null,created_by:actorId||null}
 if(rows[0])await supabaseUserRequest(`customers?id=eq.${rows[0].id}`,token,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)});else await supabaseUserRequest('customers',token,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)})
}

export async function saveGarageVehicleToCloud(ownerLegacyId:string,vehicle:any){
 const{token,organizationId}=context();if(!token||!organizationId)return
 const cloudId=ownerLegacyId.startsWith('cloud-customer-')?ownerLegacyId.slice('cloud-customer-'.length):'',lookup=cloudId?`customers?organization_id=eq.${organizationId}&id=eq.${encodeURIComponent(cloudId)}&select=id`:`customers?organization_id=eq.${organizationId}&legacy_source_id=eq.${encodeURIComponent(ownerLegacyId)}&select=id`,owners=await supabaseUserRequest<{id:string}[]>(lookup,token);if(!owners[0])throw new Error('Save the customer to the cloud before adding their vehicle.')
 const registration=String(vehicle.reg||'').trim().toUpperCase(),existing=await supabaseUserRequest<{id:string}[]>(`vehicles?organization_id=eq.${organizationId}&registration=eq.${encodeURIComponent(registration)}&select=id`,token),year=Number(vehicle.year),body={organization_id:organizationId,customer_id:owners[0].id,legacy_source_id:String(vehicle.id||`${ownerLegacyId}-${registration}`),registration,make:String(vehicle.make||'Unknown'),model:String(vehicle.model||vehicle.vehicle||'Unknown'),year:Number.isFinite(year)&&year>0?year:null,vin:vehicle.vin||null,notes:vehicle.notes||null}
 if(existing[0])await supabaseUserRequest(`vehicles?id=eq.${existing[0].id}`,token,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)});else await supabaseUserRequest('vehicles',token,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)})
}

export async function deleteGarageCustomerFromCloud(legacyId:string){const{token,organizationId}=context();if(token&&organizationId)await supabaseUserRequest(`customers?organization_id=eq.${organizationId}&legacy_source_id=eq.${encodeURIComponent(legacyId)}`,token,{method:'DELETE',headers:{Prefer:'return=minimal'}})}
export async function deleteGarageVehicleFromCloud(registration:string){const{token,organizationId}=context();if(token&&organizationId)await supabaseUserRequest(`vehicles?organization_id=eq.${organizationId}&registration=eq.${encodeURIComponent(registration.trim().toUpperCase())}`,token,{method:'DELETE',headers:{Prefer:'return=minimal'}})}

export async function syncLocalGarageCustomersToCloud(){
 let customers:any[]=[];try{customers=JSON.parse(localStorage.getItem('aa-garage-customer-records-v1')||'[]')}catch{}
 let jobs:any[]=[];try{jobs=JSON.parse(localStorage.getItem('aa-garage-management-jobs-v1')||'[]')}catch{}
 const knownNames=new Set(customers.map(customer=>String(customer.name||'').trim().toLowerCase())),legacyByName=new Map<string,any>()
 jobs.forEach(job=>{const name=String(job.customer||'').trim(),key=name.toLowerCase();if(!name||knownNames.has(key))return;const current=legacyByName.get(key)||{id:job.customerId||`legacy-job-customer-${key.replace(/[^a-z0-9]+/g,'-')}`,name,firstName:name.split(/\s+/)[0]||'',lastName:name.split(/\s+/).slice(1).join(' '),company:'',phone:job.phone||'',email:'Not recorded',address:'Not recorded',vehicles:[]};if(job.reg&&!current.vehicles.some((vehicle:any)=>String(vehicle.reg).toUpperCase()===String(job.reg).toUpperCase())){const vehicleName=String(job.vehicle||'').trim().split(/\s+/);current.vehicles.push({id:`legacy-job-vehicle-${String(job.reg).replace(/[^a-z0-9]/gi,'-').toLowerCase()}`,reg:job.reg,make:vehicleName.shift()||'Unknown',model:vehicleName.join(' ')||'Unknown'})}legacyByName.set(key,current)})
 const allCustomers=[...customers,...legacyByName.values()]
 for(const customer of allCustomers){
  await saveGarageCustomerToCloud(customer)
  let separate:any[]=[];try{separate=JSON.parse(localStorage.getItem(`aa-garage-vehicles-${customer.id}`)||'[]')}catch{}
  const vehicles=Array.from(new Map([...(customer.vehicles||[]),...separate].filter((vehicle:any)=>vehicle.reg).map((vehicle:any)=>[String(vehicle.reg).trim().toUpperCase(),vehicle])).values()) as any[]
  for(const vehicle of vehicles)await saveGarageVehicleToCloud(String(customer.id),vehicle)
 }
}

let cloudSyncStarted=false
export function startGarageCloudSync(){
 if(cloudSyncStarted)return;cloudSyncStarted=true
 let timer:number|undefined,pulling=false
 const report=(error:unknown)=>window.dispatchEvent(new CustomEvent('aa-cloud-sync-error',{detail:error instanceof Error?error.message:'Cloud sync failed.'})),sync=()=>{window.clearTimeout(timer);timer=window.setTimeout(()=>{void syncLocalGarageCustomersToCloud().catch(report)},150)},refresh=async()=>{if(pulling||document.visibilityState==='hidden')return;pulling=true;try{await hydrateGarageCloudRecords()}catch(error){report(error)}finally{pulling=false}}
 window.addEventListener('aa-garage-customers-updated',sync);window.addEventListener('aa-garage-vehicles-updated',sync);window.addEventListener('aa-garage-jobs-updated',sync)
 window.setInterval(()=>void refresh(),15000);window.addEventListener('focus',()=>void refresh());document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refresh()})
}
