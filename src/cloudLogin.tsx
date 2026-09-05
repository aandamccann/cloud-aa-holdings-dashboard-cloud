import {useEffect, useState, type FormEvent} from 'react'
import {isSupabaseConfigured, supabaseAuthRequest, supabaseUserRequest} from './supabase'
import {hydrateGarageCloudRecords,startGarageCloudSync,syncLocalGarageCustomersToCloud} from './garageCloud'
import {hydrateGaragePartsFromCloud,startGaragePartsCloudSync,syncLocalGaragePartsToCloud} from './garagePartsCloud'
import {hydrateGarageEstimatesFromCloud,startGarageEstimatesCloudSync,syncLocalGarageEstimatesToCloud} from './garageEstimatesCloud'
import {hydrateGarageJobCardsFromCloud,startGarageJobCardsCloudSync,syncLocalGarageJobCardsToCloud} from './garageJobCardsCloud'
import {startGarageTimersCloudSync,syncGarageTimersToCloud} from './garageTimersCloud'
import {hydrateGarageChecklistsFromCloud,queueGarageChecklistSync,startGarageChecklistsCloudSync} from './garageChecklistsCloud'
import {hydrateGarageInvoicesFromCloud,startGarageInvoicesCloudSync,syncGarageInvoicesToCloud} from './garageInvoicesCloud'
import {hydrateGarageSettingsFromCloud,startGarageSettingsCloudSync,syncGarageSettingsToCloud} from './garageSettingsCloud'
import {hydrateCompletedJobsFromCloud,startCompletedJobsCloudSync,syncCompletedJobsToCloud} from './completedJobsCloud'
import {hydrateRentalSafetyChecksFromCloud,startRentalSafetyChecksCloudSync,syncRentalSafetyChecksToCloud} from './rentalSafetyChecksCloud'
import {hydrateUserPreferencesFromCloud,startUserPreferencesCloudSync,syncUserPreferencesToCloud} from './userPreferencesCloud'
import './cloudLogin.css'

type AuthResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  user: {id: string; email?: string}
}

type ProfileRow = {id: string; full_name: string; email: string | null}
type MembershipRow = {organization_id: string; role: 'owner'|'manager'|'front_of_house'|'technician'|'staff'; active: boolean}

const applicationRole = (role: MembershipRow['role']) => {
  if (role === 'owner') return 'owner'
  if (role === 'manager') return 'keith'
  if (role === 'front_of_house') return 'sandra'
  return role === 'technician' ? 'gavin' : 'owner'
}

export function CloudLogin({go}:{go:(role:any)=>void}) {
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [error,setError]=useState('')
  const [submitting,setSubmitting]=useState(false)

  useEffect(()=>{
    sessionStorage.removeItem('aa-cloud-access-token')
    sessionStorage.removeItem('aa-cloud-refresh-token')
    sessionStorage.removeItem('aa-organization-id')
  },[])

  const signIn=async(event:FormEvent)=>{
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try{
      const auth=await supabaseAuthRequest<AuthResponse>('token?grant_type=password',{
        method:'POST',
        body:JSON.stringify({email:email.trim(),password}),
      })
      const [profiles,memberships]=await Promise.all([
        supabaseUserRequest<ProfileRow[]>(`profiles?id=eq.${encodeURIComponent(auth.user.id)}&select=id,full_name,email`,auth.access_token),
        supabaseUserRequest<MembershipRow[]>(`organization_members?user_id=eq.${encodeURIComponent(auth.user.id)}&active=eq.true&select=organization_id,role,active`,auth.access_token),
      ])
      const membership=memberships[0]
      if(!membership) throw new Error('This account does not have active access to an A&A organisation.')
      const profile=profiles[0]
      const role=applicationRole(membership.role)
      sessionStorage.setItem('aa-cloud-access-token',auth.access_token)
      sessionStorage.setItem('aa-cloud-refresh-token',auth.refresh_token)
      sessionStorage.setItem('aa-cloud-token-expires-at',String(Date.now()+auth.expires_in*1000))
      sessionStorage.setItem('aa-organization-id',membership.organization_id)
      sessionStorage.setItem('aa-role',role)
      sessionStorage.setItem('aa-actor',profile?.full_name||auth.user.email||'A&A user')
      sessionStorage.setItem('aa-actor-id',auth.user.id)
      await hydrateGarageCloudRecords()
      await syncLocalGarageCustomersToCloud()
      startGarageCloudSync()
      await hydrateGaragePartsFromCloud()
      await syncLocalGaragePartsToCloud()
      startGaragePartsCloudSync()
      await hydrateGarageEstimatesFromCloud()
      await syncLocalGarageEstimatesToCloud()
      startGarageEstimatesCloudSync()
      await hydrateGarageJobCardsFromCloud()
      await syncLocalGarageJobCardsToCloud()
      startGarageJobCardsCloudSync()
      await syncGarageTimersToCloud()
      startGarageTimersCloudSync()
      await hydrateGarageChecklistsFromCloud()
      await queueGarageChecklistSync()
      startGarageChecklistsCloudSync()
      await hydrateGarageInvoicesFromCloud()
      await syncGarageInvoicesToCloud()
      startGarageInvoicesCloudSync()
      await hydrateGarageSettingsFromCloud()
      await syncGarageSettingsToCloud()
      startGarageSettingsCloudSync()
      await hydrateCompletedJobsFromCloud()
      await syncCompletedJobsToCloud()
      startCompletedJobsCloudSync()
      await hydrateRentalSafetyChecksFromCloud()
      await syncRentalSafetyChecksToCloud()
      startRentalSafetyChecksCloudSync()
      await hydrateUserPreferencesFromCloud()
      await syncUserPreferencesToCloud()
      startUserPreferencesCloudSync()
      go(role)
    }catch(reason){
      setError(reason instanceof Error?reason.message:'The dashboard could not sign you in.')
    }finally{
      setSubmitting(false)
    }
  }

  return <div className="login cloudLogin"><div className="hero"><div className="brand"><i>A<span>&</span>A</i><div><b>A and A Holdings</b><small>Business intelligence</small></div></div><div><em>SECURE CLOUD ACCESS</em><h1>One clear view.<br/>Three strong businesses.</h1><p>Sign in with your individual A&A Holdings account.</p></div><small>Private management dashboard</small></div><div className="loginbox"><form className="cloudLoginForm" onSubmit={signIn}><div><h2>Welcome back</h2><p>Use your A&A dashboard email and password.</p></div><label><span>Email address <b>*</b></span><input required type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} placeholder="name@company.ie"/></label><label><span>Password <b>*</b></span><input required type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} placeholder="Password"/></label>{error&&<p className="cloudLoginError" role="alert">{error}</p>}<button className="primary" type="submit" disabled={submitting||!isSupabaseConfigured}>{submitting?'Signing in…':'Sign in to dashboard'}</button>{!isSupabaseConfigured&&<p className="cloudLoginError">The cloud connection has not been configured.</p>}</form></div></div>
}
