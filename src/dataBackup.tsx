import {useMemo, useState} from 'react'
import {Download, ShieldCheck, UploadCloud} from 'lucide-react'
import {supabaseUserRequest} from './supabase'
import './dataBackup.css'

const excludedExact = new Set([
  'aa-login-security',
  'aa-cloud-access-token',
  'aa-cloud-refresh-token',
  'aa-cloud-token-expires-at',
])

const excludedPrefixes = [
  'aa-universal-layout-',
  'aa-widget-layout-',
  'aa-sidebar-pins-',
  'aa-garage-visible-workspaces-',
]

const shouldExport = (key:string) => key.startsWith('aa-')
  && !excludedExact.has(key)
  && !excludedPrefixes.some(prefix=>key.startsWith(prefix))

const readValue = (key:string) => {
  const raw=localStorage.getItem(key)
  if(raw===null)return null
  try{return JSON.parse(raw)}catch{return raw}
}

const recordCount = (value:unknown) => Array.isArray(value) ? value.length : value && typeof value === 'object' ? 1 : value === null ? 0 : 1

type LocalCustomer={id:string;name?:string;firstName?:string;lastName?:string;company?:string;phone?:string;email?:string;address?:string;vehicles?:LocalVehicle[]}
type LocalVehicle={id?:string;reg?:string;make?:string;model?:string;year?:string|number;vin?:string;notes?:string}
type PlannedVehicle={ownerLegacyId:string;legacyId:string;vehicle:LocalVehicle}

const migrationRecords=()=>{
  let customers:LocalCustomer[]=[]
  try{const value=JSON.parse(localStorage.getItem('aa-garage-customer-records-v1')||'[]');customers=Array.isArray(value)?value:[]}catch{}
  const vehicles:PlannedVehicle[]=[]
  customers.forEach(customer=>(customer.vehicles||[]).forEach((vehicle,index)=>vehicles.push({ownerLegacyId:String(customer.id),legacyId:String(vehicle.id||`${customer.id}-${vehicle.reg||index}`),vehicle})))
  for(let index=0;index<localStorage.length;index++){
    const key=localStorage.key(index)
    if(!key?.startsWith('aa-garage-vehicles-'))continue
    const ownerLegacyId=key.slice('aa-garage-vehicles-'.length)
    try{const values=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(values))values.forEach((vehicle:LocalVehicle,vehicleIndex:number)=>vehicles.push({ownerLegacyId,legacyId:String(vehicle.id||`${ownerLegacyId}-${vehicle.reg||vehicleIndex}`),vehicle}))}catch{}
  }
  const uniqueVehicles=Array.from(new Map(vehicles.map(record=>[`${record.ownerLegacyId}:${record.legacyId}`,record])).values())
  return{customers,vehicles:uniqueVehicles}
}

export function DataBackup(){
  const [message,setMessage]=useState('')
  const [checking,setChecking]=useState(false)
  const [uploading,setUploading]=useState(false)
  const [preview,setPreview]=useState<{customers:number;vehicles:number;existingCustomers:number;existingVehicles:number}|null>(null)
  const inventory=useMemo(()=>{
    const rows:{key:string;records:number}[]=[]
    for(let index=0;index<localStorage.length;index++){
      const key=localStorage.key(index)
      if(key&&shouldExport(key))rows.push({key,records:recordCount(readValue(key))})
    }
    return rows.sort((a,b)=>a.key.localeCompare(b.key))
  },[])
  const totalRecords=inventory.reduce((sum,row)=>sum+row.records,0)
  const plan=migrationRecords()
  const download=()=>{
    const records:Record<string,unknown>={}
    inventory.forEach(({key})=>{records[key]=readValue(key)})
    const backup={
      format:'aa-holdings-browser-backup',
      version:1,
      exportedAt:new Date().toISOString(),
      organizationId:sessionStorage.getItem('aa-organization-id'),
      exportedBy:sessionStorage.getItem('aa-actor-id'),
      keyCount:inventory.length,
      records,
    }
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob)
    const link=document.createElement('a')
    link.href=url
    link.download=`aa-holdings-private-backup-${new Date().toISOString().slice(0,10)}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setMessage(`Private backup created with ${inventory.length} data groups and ${totalRecords} stored records.`)
  }
  const checkCloud=async()=>{
    const token=sessionStorage.getItem('aa-cloud-access-token')
    const organizationId=sessionStorage.getItem('aa-organization-id')
    if(!token||!organizationId){setMessage('Sign out and sign in again before checking the cloud migration.');return}
    setChecking(true);setMessage('')
    try{
      const [customers,vehicles]=await Promise.all([
        supabaseUserRequest<{id:string}[]>(`customers?organization_id=eq.${organizationId}&select=id`,token),
        supabaseUserRequest<{id:string}[]>(`vehicles?organization_id=eq.${organizationId}&select=id`,token),
      ])
      setPreview({customers:plan.customers.length,vehicles:plan.vehicles.length,existingCustomers:customers.length,existingVehicles:vehicles.length})
      setMessage('Migration preview is ready. Review the totals before uploading anything.')
    }catch(reason){setMessage(reason instanceof Error?reason.message:'The migration preview could not be loaded.')}
    finally{setChecking(false)}
  }
  const migrateCustomersAndVehicles=async()=>{
    if(!preview||!window.confirm(`Upload up to ${preview.customers} customers and ${preview.vehicles} vehicles to the protected A&A Holdings Supabase database? Existing migrated records will be skipped.`))return
    const token=sessionStorage.getItem('aa-cloud-access-token')
    const organizationId=sessionStorage.getItem('aa-organization-id')
    const actorId=sessionStorage.getItem('aa-actor-id')
    if(!token||!organizationId){setMessage('Sign out and sign in again before migrating.');return}
    setUploading(true);setMessage('Uploading customers and vehicles…')
    try{
      const cloudCustomers=await supabaseUserRequest<{id:string;legacy_source_id:string|null}[]>(`customers?organization_id=eq.${organizationId}&select=id,legacy_source_id`,token)
      const customerIds=new Map(cloudCustomers.filter(row=>row.legacy_source_id).map(row=>[String(row.legacy_source_id),row.id]))
      let customersAdded=0,vehiclesAdded=0,vehiclesSkipped=0
      for(const customer of plan.customers){
        const legacyId=String(customer.id)
        if(customerIds.has(legacyId))continue
        const name=(customer.name||[customer.firstName,customer.lastName].filter(Boolean).join(' ')||customer.company||'Customer').trim()
        const saved=await supabaseUserRequest<{id:string}[]>('customers?select=id',token,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({organization_id:organizationId,legacy_source_id:legacyId,customer_type:customer.company?'business':'personal',name,company_name:customer.company||null,email:customer.email||null,phone:customer.phone||null,address:customer.address||null,created_by:actorId||null})})
        customerIds.set(legacyId,saved[0].id);customersAdded++
      }
      const cloudVehicles=await supabaseUserRequest<{legacy_source_id:string|null;registration:string}[]>(`vehicles?organization_id=eq.${organizationId}&select=legacy_source_id,registration`,token)
      const vehicleLegacyIds=new Set(cloudVehicles.map(row=>row.legacy_source_id).filter(Boolean))
      const registrations=new Set(cloudVehicles.map(row=>row.registration.trim().toUpperCase()))
      for(const record of plan.vehicles){
        const customerId=customerIds.get(record.ownerLegacyId),registration=(record.vehicle.reg||'').trim().toUpperCase()
        if(!customerId||!registration||vehicleLegacyIds.has(record.legacyId)||registrations.has(registration)){vehiclesSkipped++;continue}
        const year=Number(record.vehicle.year)
        await supabaseUserRequest('vehicles',token,{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({organization_id:organizationId,customer_id:customerId,legacy_source_id:record.legacyId,registration,make:record.vehicle.make?.trim()||'Unknown',model:record.vehicle.model?.trim()||'Unknown',year:Number.isFinite(year)&&year>0?year:null,vin:record.vehicle.vin||null,notes:record.vehicle.notes||null})})
        vehicleLegacyIds.add(record.legacyId);registrations.add(registration);vehiclesAdded++
      }
      setMessage(`Cloud migration complete: ${customersAdded} customers and ${vehiclesAdded} vehicles added${vehiclesSkipped?`; ${vehiclesSkipped} vehicle records skipped because they were missing an owner/registration or already existed.`:'.'}`)
      setPreview(null)
    }catch(reason){setMessage(reason instanceof Error?`Migration stopped safely: ${reason.message}`:'Migration stopped safely. No local records were removed.')}
    finally{setUploading(false)}
  }
  return <section className="dataBackupSettings"><header><ShieldCheck/><div><h3>Cloud migration &amp; private backup</h3><p>Create a safety copy of the records held in this browser before they are migrated to Supabase.</p></div></header><div className="dataBackupWarning"><strong>Keep this file private</strong><span>The backup can contain customer, vehicle, employee and financial information. Do not email it unnecessarily and never commit it to GitHub.</span></div><div className="dataBackupSummary"><article><b>{inventory.length}</b><span>Data groups</span></article><article><b>{totalRecords}</b><span>Stored records</span></article><article><b>{excludedExact.size}</b><span>Credential fields excluded</span></article></div><button type="button" className="downloadPrivateBackup" onClick={download}><Download/>Download private backup</button><section className="cloudMigrationPanel"><div><UploadCloud/><span><strong>Customers &amp; vehicles</strong><small>{plan.customers.length} local customers · {plan.vehicles.length} local vehicles</small></span></div><button type="button" onClick={checkCloud} disabled={checking||uploading}>{checking?'Checking…':'Prepare cloud migration'}</button>{preview&&<div className="cloudMigrationPreview"><strong>Migration preview</strong><span>Browser: {preview.customers} customers and {preview.vehicles} vehicles</span><span>Already in cloud: {preview.existingCustomers} customers and {preview.existingVehicles} vehicles</span><button type="button" onClick={migrateCustomersAndVehicles} disabled={uploading}>{uploading?'Uploading…':`Upload customers & vehicles`}</button></div>}</section>{message&&<p className="dataBackupSuccess" role="status">{message}</p>}<details><summary>View data groups included</summary><div className="dataBackupInventory">{inventory.map(row=><span key={row.key}><code>{row.key}</code><b>{row.records}</b></span>)}</div></details></section>
}
