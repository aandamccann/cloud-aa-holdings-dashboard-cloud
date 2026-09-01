import {defineConfig,loadEnv,type Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

type RoutalStop={externalId:string;name:string;address:string;serviceMinutes?:number;notes?:string};
const json=(res:ServerResponse,status:number,body:unknown)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))};
const readBody=async(req:IncomingMessage)=>{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));return chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{}};

function routalConnector(apiKey:string,projectId:string):Plugin{
 const configured=()=>Boolean(apiKey&&projectId);
 const call=async(path:string,init?:RequestInit)=>{const url=new URL(`https://api.routal.com${path}`);url.searchParams.set('private_key',apiKey);const response=await fetch(url,{...init,headers:{'Content-Type':'application/json',...(init?.headers||{})}}),text=await response.text();let data:unknown=text;try{data=text?JSON.parse(text):null}catch{}if(!response.ok){const message=typeof data==='object'&&data&&'message' in data?String((data as {message:unknown}).message):`Routal returned ${response.status}`;throw new Error(message)}return data};
 const handler=async(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{if(!req.url?.startsWith('/api/routal/'))return next();try{
  if(req.method==='GET'&&req.url==='/api/routal/status')return json(res,200,{configured:configured()});
  if(req.method==='POST'&&req.url==='/api/routal/local-config'){
   const host=String(req.headers.host||'');
   if(!host.startsWith('localhost:')&&!host.startsWith('127.0.0.1:'))return json(res,403,{error:'Private setup is only available on the dashboard computer.'});
   const body=await readBody(req) as {apiKey?:string;projectId?:string},newKey=String(body.apiKey||'').trim(),newProject=String(body.projectId||'').trim();
   if(!newKey||/[\r\n]/.test(newKey)||!newProject||/[\r\n]/.test(newProject))return json(res,400,{error:'Enter both Routal values without spaces or line breaks.'});
   await writeFile('.env.local',`# Private local Routal settings. Never share this file.\nROUTAL_API_KEY=${newKey}\nROUTAL_PROJECT_ID=${newProject}\n`,'utf8');
   apiKey=newKey;projectId=newProject;
   return json(res,200,{ok:true});
  }
  if(!configured())return json(res,503,{error:'Routal is not configured on this server yet.'});
  if(req.method==='POST'&&req.url==='/api/routal/test-connection'){const data=await call(`/v2/vehicles?project_id=${encodeURIComponent(projectId)}`),vehicles=Array.isArray(data)?data.length:typeof data==='object'&&data&&'total' in data?Number((data as {total:unknown}).total):0;return json(res,200,{ok:true,vehicles})}
  if(req.method==='POST'&&req.url==='/api/routal/test-plan'){const body=await readBody(req) as {label?:string;executionDate?:string;stops?:RoutalStop[]},stops=(body.stops||[]).slice(0,100);if(!stops.length)return json(res,400,{error:'Select at least one machine.'});const executionDate=body.executionDate||new Date().toISOString().slice(0,10),plan=await call(`/v2/plan?project_id=${encodeURIComponent(projectId)}`,{method:'POST',body:JSON.stringify({label:body.label||`A&A Vending test ${executionDate}`,execution_date:executionDate})}) as {id?:string};if(!plan.id)throw new Error('Routal created the plan but did not return its reference.');const created=await call(`/v2/stops/geocode?plan_id=${encodeURIComponent(plan.id)}&project_id=${encodeURIComponent(projectId)}`,{method:'POST',body:JSON.stringify(stops.map(stop=>({external_id:stop.externalId,label:stop.name,address:stop.address,duration:(stop.serviceMinutes||18)*60,comments:stop.notes||'AI Vending refill'})))}) as unknown[];return json(res,200,{ok:true,planId:plan.id,stops:Array.isArray(created)?created.length:stops.length})}
  return json(res,404,{error:'Not found'});
 }catch(error){return json(res,502,{error:error instanceof Error?error.message:'Routal connection failed.'})}};
 return{name:'routal-server-connector',configureServer(server){server.middlewares.use(handler)},configurePreviewServer(server){server.middlewares.use(handler)}};
}

const persistentKeys=new Set([
 'aa-employee-permissions','aa-rental-safety-checks','aa-rental-fleet-vehicles','aa-rental-check-note-options','aa-rental-check-groups','aa-unified-work-items-v1','aa-completed-workshop-jobs','aa-completed-workshop-areas',
 'aa-sidebar-pins-owner','aa-sidebar-pins-keith','aa-sidebar-pins-gary','aa-sidebar-pins-sandra',
 'aa-sidebar-pins-ilona','aa-sidebar-pins-driver','aa-sidebar-pins-picker','aa-holdings-ideas-v1'
]);
function localDataStore():Plugin{
 const file=resolve(process.cwd(),'.local-dashboard-data.json');
 const read=async()=>{try{return JSON.parse(await readFile(file,'utf8')) as Record<string,unknown>}catch{return{}}};
 const write=async(data:Record<string,unknown>)=>{const temp=`${file}.tmp`;await writeFile(temp,JSON.stringify(data,null,2),'utf8');await rename(temp,file)};
 const handler=async(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{if(!req.url?.startsWith('/api/local-data/'))return next();const key=decodeURIComponent(req.url.slice('/api/local-data/'.length).split('?')[0]);if(!persistentKeys.has(key))return json(res,404,{error:'Unknown data key'});try{const data=await read();if(req.method==='GET')return json(res,200,{value:data[key]??null});if(req.method==='PUT'){const body=await readBody(req) as {value?:unknown};data[key]=body.value??null;await write(data);return json(res,200,{ok:true})}return json(res,405,{error:'Method not allowed'})}catch(error){return json(res,500,{error:error instanceof Error?error.message:'Local data storage failed'})}};
 return{name:'local-dashboard-data',configureServer(server){server.middlewares.use(handler)},configurePreviewServer(server){server.middlewares.use(handler)}};
}

function jobAttachmentStore():Plugin{
 const directory=resolve(process.cwd(),'.local-job-attachments'),types:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/heic':'heic','image/heif':'heif','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'};
 const handler=async(req:IncomingMessage,res:ServerResponse,next:()=>void)=>{if(!req.url?.startsWith('/api/job-attachments'))return next();try{
  if(req.method==='POST'&&req.url==='/api/job-attachments'){const body=await readBody(req) as {name?:string;type?:string;data?:string},type=String(body.type||''),extension=types[type],match=String(body.data||'').match(/^data:[^;]+;base64,(.+)$/);if(!extension||!match)return json(res,400,{error:'Choose a supported picture or video file.'});const buffer=Buffer.from(match[1],'base64');if(buffer.length>50*1024*1024)return json(res,413,{error:'Each picture or video must be smaller than 50 MB.'});await mkdir(directory,{recursive:true});const id=`${randomUUID()}.${extension}`;await writeFile(resolve(directory,id),buffer);return json(res,200,{name:String(body.name||'Attachment'),type,url:`/api/job-attachments/${id}`})}
  if(req.method==='GET'){const id=decodeURIComponent(req.url.slice('/api/job-attachments/'.length));if(!/^[a-f0-9-]+\.(jpg|png|webp|gif|heic|heif|mp4|webm|mov)$/.test(id))return json(res,404,{error:'Attachment not found'});const extension=id.split('.').pop()||'',mime=Object.entries(types).find(([,ext])=>ext===extension)?.[0]||'application/octet-stream',file=await readFile(resolve(directory,id));res.statusCode=200;res.setHeader('Content-Type',mime);res.setHeader('Cache-Control','private, max-age=3600');return res.end(file)}
  return json(res,405,{error:'Method not allowed'});
 }catch(error){return json(res,500,{error:error instanceof Error?error.message:'Attachment storage failed'})}};
 return{name:'local-job-attachments',configureServer(server){server.middlewares.use(handler)},configurePreviewServer(server){server.middlewares.use(handler)}};
}

export default defineConfig(({mode})=>{const env=loadEnv(mode,process.cwd(),'');return{plugins:[react(),jobAttachmentStore(),localDataStore(),routalConnector(env.ROUTAL_API_KEY||'',env.ROUTAL_PROJECT_ID||'')]}});
