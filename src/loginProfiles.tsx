import {useState,type FormEvent} from 'react';
import {readEmployeePermissions,type EmployeePermission} from './employeePermissions';

type AccessRole='owner'|'keith'|'gary'|'sandra'|'ilona'|'driver'|'picker'|'gavin'|'auris'|'mohammad'|'jack';
type Profile={id:string,name:string,detail:string,access:AccessRole};
const profiles:Profile[]=[
 {id:'aaron',name:'Aaron',detail:'Owner / Master access',access:'owner'},
 {id:'adam',name:'Adam',detail:'Owner / Master access',access:'owner'},
 {id:'keith',name:'Keith',detail:'Garage · Workshop',access:'keith'},
 {id:'gary',name:'Gary',detail:'Car Sales & Car Rental',access:'gary'},
 {id:'sandra',name:'Sandra',detail:'Garage · Front of house',access:'sandra'},
 {id:'ilona',name:'Ilona',detail:'AI Vending · Manager',access:'ilona'},
 {id:'driver',name:'Driver',detail:'AI Vending · Refill routes',access:'driver'},
 {id:'picker',name:'Picker',detail:'AI Vending · Stock preparation',access:'picker'},
 {id:'gavin',name:'Gavin',detail:'Garage · Technician',access:'gavin'},
 {id:'auris',name:'Auris',detail:'Garage · Technician',access:'auris'},
 {id:'mohammad',name:'Mohammad',detail:'Garage · Technician',access:'mohammad'},
 {id:'jack',name:'Jack',detail:'Garage · Technician',access:'jack'}
];
const companies:{id:keyof EmployeePermission,name:string,detail:string,initial:string}[]=[
 {id:'group',name:'A and A Holdings',detail:'Master and group access',initial:'A'},
 {id:'motors',name:'Garage',detail:'Workshop and front of house',initial:'M'},
 {id:'carsales',name:'Car Sales',detail:'Vehicle sales and Japan stock',initial:'S'},
 {id:'rental',name:'Car Rental',detail:'Fleet and rental inspections',initial:'R'},
 {id:'vending',name:'AI Vending',detail:'Machines, stock and routes',initial:'V'},
 {id:'floor',name:'Global Floor & Wall Surfaces',detail:'Products, quotes and installations',initial:'F'}
];

export function Login({go}:{go:(role:any)=>void}){
 const[pending,setPending]=useState<Profile|null>(null),[code,setCode]=useState(''),[error,setError]=useState(''),[view,setView]=useState<'people'|'companies'>('people'),[openCompany,setOpenCompany]=useState<string|null>(null);
 const permissions=readEmployeePermissions();
 const companyPeople=(company:keyof EmployeePermission)=>profiles.filter(profile=>profile.access==='owner'||!!permissions[profile.id]?.[company]);
 const finish=(profile:Profile)=>{sessionStorage.setItem('aa-role',profile.access);sessionStorage.setItem('aa-actor',profile.name);sessionStorage.setItem('aa-actor-id',profile.id);go(profile.access)};
 const enter=(profile:Profile)=>{const security=JSON.parse(localStorage.getItem('aa-login-security')||'{}'),rule=security[profile.id]||security[profile.access];if(rule?.enabled&&rule?.passcode){setPending(profile);setCode('');setError('')}else finish(profile)};
 const unlock=(e:FormEvent)=>{e.preventDefault();if(!pending)return;const security=JSON.parse(localStorage.getItem('aa-login-security')||'{}'),rule=security[pending.id]||security[pending.access];if(code===rule?.passcode)finish(pending);else setError('Incorrect passcode. Please try again.')};
 return <div className="login"><div className="hero"><div className="brand"><i>A<span>&</span>A</i><div><b>A and A Holdings</b><small>Business intelligence</small></div></div><div><em>GROUP OPERATIONS</em><h1>One clear view.<br/>Three strong businesses.</h1><p>Monitor performance and act on what matters across Garage, AI Vending and Global Floor & Wall Surfaces.</p></div><small>Private management dashboard · Demo environment</small></div><div className="loginbox"><div><h2>Welcome back</h2><p>Open a profile by person or by company.</p><div className="loginViewToggle"><button className={view==='people'?'active':''} onClick={()=>setView('people')}>People</button><button className={view==='companies'?'active':''} onClick={()=>setView('companies')}>Companies</button></div>{view==='people'?<div className="loginPeople">{profiles.map(profile=><ProfileButton key={profile.id} profile={profile} enter={enter}/>)}</div>:<div className="loginCompanies">{companies.map(company=>{const people=companyPeople(company.id),open=openCompany===company.id;return <section key={company.id}><button className={`loginCompanyButton ${open?'open':''}`} onClick={()=>setOpenCompany(current=>current===company.id?null:company.id)}><i>{company.initial}</i><span><b>{company.name}</b><small>{company.detail} · {people.length} profiles</small></span><b>{open?'⌃':'⌄'}</b></button>{open&&<div className="companyProfileList">{people.map(profile=><ProfileButton key={`${company.id}-${profile.id}`} profile={profile} enter={enter}/>)}</div>}</section>})}</div>}</div></div>{pending&&<div className="passcodeOverlay"><form onSubmit={unlock}><button type="button" className="passClose" onClick={()=>setPending(null)}>×</button><div className="passIcon">{pending.name[0]}</div><h3>{pending.name}</h3><p>Enter your passcode to continue.</p><input required autoFocus inputMode="numeric" type="password" value={code} onChange={e=>setCode(e.target.value)} placeholder="Passcode"/><small className="passError">{error}</small><button className="primary" type="submit">Unlock dashboard</button></form></div>}</div>
}

function ProfileButton({profile,enter}:{profile:Profile,enter:(profile:Profile)=>void}){return <button className="loginProfileButton" onClick={()=>enter(profile)}><i>{profile.name[0]}</i><span><b>{profile.name}</b><small>{profile.detail}</small></span><b>›</b></button>}
