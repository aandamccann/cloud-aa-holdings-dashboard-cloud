import {useState} from 'react';
import './employeePermissions.css';
import {persistLocalValue} from './localPersistence';

export type EmployeePermission={group:boolean,motors:boolean,carsales:boolean,rental:boolean,vending:boolean,floor:boolean,reports:boolean,tasks:boolean,library:boolean,rentalChecklistEdit:boolean,garageSettingsEdit:boolean};
export type EmployeePermissions=Record<string,EmployeePermission>;

export const defaultEmployeePermissions:EmployeePermissions={
 keith:{group:false,motors:true,carsales:false,rental:false,vending:false,floor:false,reports:true,tasks:true,library:true,rentalChecklistEdit:false,garageSettingsEdit:false},
 gary:{group:false,motors:false,carsales:true,rental:true,vending:false,floor:false,reports:true,tasks:true,library:true,rentalChecklistEdit:false,garageSettingsEdit:false},
 sandra:{group:false,motors:true,carsales:false,rental:true,vending:false,floor:false,reports:true,tasks:true,library:true,rentalChecklistEdit:false,garageSettingsEdit:false},
 ilona:{group:false,motors:false,carsales:false,rental:false,vending:true,floor:false,reports:true,tasks:true,library:true,rentalChecklistEdit:false,garageSettingsEdit:false},
 driver:{group:false,motors:false,carsales:false,rental:false,vending:true,floor:false,reports:false,tasks:true,library:false,rentalChecklistEdit:false,garageSettingsEdit:false},
 picker:{group:false,motors:false,carsales:false,rental:false,vending:true,floor:false,reports:false,tasks:true,library:false,rentalChecklistEdit:false,garageSettingsEdit:false},
 gavin:{group:false,motors:true,carsales:false,rental:false,vending:false,floor:false,reports:false,tasks:false,library:false,rentalChecklistEdit:false,garageSettingsEdit:false},
 auris:{group:false,motors:true,carsales:false,rental:false,vending:false,floor:false,reports:false,tasks:false,library:false,rentalChecklistEdit:false,garageSettingsEdit:false},
 mohammad:{group:false,motors:true,carsales:false,rental:false,vending:false,floor:false,reports:false,tasks:false,library:false,rentalChecklistEdit:false,garageSettingsEdit:false},
 jack:{group:false,motors:true,carsales:false,rental:false,vending:false,floor:false,reports:false,tasks:false,library:false,rentalChecklistEdit:false,garageSettingsEdit:false}
};

export function readEmployeePermissions():EmployeePermissions{
 try{return {...defaultEmployeePermissions,...JSON.parse(localStorage.getItem('aa-employee-permissions')||'{}')}}catch{return defaultEmployeePermissions}
}

const employees=[['keith','Keith'],['gary','Gary'],['sandra','Sandra'],['ilona','Ilona'],['driver','Driver'],['picker','Picker'],['gavin','Gavin'],['auris','Auris'],['mohammad','Mohammad'],['jack','Jack']];
const access=[['group','Holdings'],['motors','Garage'],['carsales','Car Sales'],['rental','Car Rental'],['vending','AI Vending'],['floor','Flooring'],['reports','Reports'],['tasks','Tasks'],['library','Widgets'],['rentalChecklistEdit','Safety checklist editor'],['garageSettingsEdit','Garage settings editor']];

export function EmployeePermissionsPanel(){
 const[permissions,setPermissions]=useState<EmployeePermissions>(readEmployeePermissions),[saved,setSaved]=useState(false);
 const toggle=(person:string,key:string)=>{setSaved(false);setPermissions(current=>({...current,[person]:{...current[person],[key]:!current[person][key as keyof EmployeePermission]}}))};
 const save=async()=>{await persistLocalValue('aa-employee-permissions',permissions);setSaved(true);setTimeout(()=>location.reload(),450)};
 return <article className="card"><h3>Roles & permissions for every company</h3><p>Aaron and Adam always have full Master access. Choose which companies and shared tools each employee can open.</p><div className="permissionTable companyPermissionTable"><div className="permissionHead"><b>Employee</b>{access.map(([,label])=><b key={label}>{label}</b>)}</div>{employees.map(([id,name])=><div className="permissionRow" key={id}><strong>{name}</strong>{access.map(([key])=><label className="switch" key={key}><input aria-label={`${name} ${key}`} type="checkbox" checked={!!permissions[id]?.[key as keyof EmployeePermission]} onChange={()=>toggle(id,key)}/><i/></label>)}</div>)}</div><small className="mobileHint">Changes take effect on the employee’s next sign-in. Removing a company hides all of its pages from that employee.</small><button className="primary" onClick={save}>{saved?'Saved':'Save role permissions'}</button></article>
}
