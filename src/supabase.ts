const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = ''
    try {
      const body = await response.json()
      message = body?.msg || body?.message || body?.error_description || body?.error || ''
    } catch {
      message = await response.text()
    }
    throw new Error(message || `Supabase request failed (${response.status}).`)
  }
  if (response.status === 204) return undefined as T
  const text = await response.text()
  if (!text.trim()) return undefined as T
  return JSON.parse(text) as T
}

export async function supabaseAuthRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')
  const response = await fetch(`${supabaseUrl}/auth/v1/${path.replace(/^\//, '')}`, {
    ...init,
    headers: {
      apikey: supabasePublishableKey,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  return readResponse<T>(response)
}

export async function supabaseUserRequest<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.')
  let response: Response | undefined
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(`${supabaseUrl}/rest/v1/${path.replace(/^\//, '')}`, {
      ...init,
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })
    if (response.ok) return readResponse<T>(response)
    const errorText = await response.clone().text()
    if (!/JWT issued at future/i.test(errorText) || attempt === 2) return readResponse<T>(response)
    await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)))
  }
  return readResponse<T>(response!)
}

export async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Add the project URL and publishable key to .env.local.')
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path.replace(/^\//, '')}`, {
    ...init,
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${supabasePublishableKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  return readResponse<T>(response)
}

export type CloudAttachment={name:string;type:string;url:string;path:string}
function createAttachmentId(){
  return globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`
}
export async function uploadJobAttachment(file:File):Promise<CloudAttachment>{
  if(!isSupabaseConfigured)throw new Error('Supabase is not configured.')
  const token=sessionStorage.getItem('aa-cloud-access-token'),organizationId=sessionStorage.getItem('aa-organization-id')
  if(!token||!organizationId)throw new Error('Sign in again before uploading attachments.')
  if(file.size>50*1024*1024)throw new Error('Each picture or video must be smaller than 50 MB.')
  const extension=(file.name.split('.').pop()||'bin').replace(/[^a-z0-9]/gi,'').toLowerCase(),path=`${organizationId}/${createAttachmentId()}.${extension}`
  const response=await fetch(`${supabaseUrl}/storage/v1/object/job-attachments/${path}`,{method:'POST',headers:{apikey:supabasePublishableKey,Authorization:`Bearer ${token}`,'Content-Type':file.type,'x-upsert':'false'},body:file})
  await readResponse(response)
  const signed=await fetch(`${supabaseUrl}/storage/v1/object/sign/job-attachments/${path}`,{method:'POST',headers:{apikey:supabasePublishableKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:604800})})
  const result=await readResponse<{signedURL:string}>(signed),url=result.signedURL.startsWith('http')?result.signedURL:`${supabaseUrl}/storage/v1${result.signedURL}`
  return{name:file.name,type:file.type,url,path}
}

export async function signJobAttachment(path:string):Promise<string>{
  if(!isSupabaseConfigured)throw new Error('Supabase is not configured.')
  const token=sessionStorage.getItem('aa-cloud-access-token')
  if(!token)throw new Error('Sign in again before opening attachments.')
  const signed=await fetch(`${supabaseUrl}/storage/v1/object/sign/job-attachments/${path}`,{method:'POST',headers:{apikey:supabasePublishableKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:604800})})
  const result=await readResponse<{signedURL:string}>(signed)
  return result.signedURL.startsWith('http')?result.signedURL:`${supabaseUrl}/storage/v1${result.signedURL}`
}
