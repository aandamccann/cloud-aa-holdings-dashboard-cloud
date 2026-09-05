export type GarageEmployeeAccess='workshop'|'front'|'technician';
export type GarageWorkingDay={enabled:boolean;start:string;end:string};
export type GarageWorkingHours=Record<'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday',GarageWorkingDay>;
export const defaultGarageWorkingHours=():GarageWorkingHours=>({monday:{enabled:true,start:'09:00',end:'18:00'},tuesday:{enabled:true,start:'09:00',end:'18:00'},wednesday:{enabled:true,start:'09:00',end:'18:00'},thursday:{enabled:true,start:'09:00',end:'18:00'},friday:{enabled:true,start:'09:00',end:'18:00'},saturday:{enabled:false,start:'09:00',end:'18:00'},sunday:{enabled:false,start:'09:00',end:'18:00'}});

export type GarageEmployee={
 id:string;
 name:string;
 jobTitle:string;
 phone:string;
 email:string;
 access:GarageEmployeeAccess;
 loginRole:'keith'|'sandra'|'gavin'|'auris'|'mohammad'|'jack';
 passcode:string;
 active:boolean;
 workingHours?:GarageWorkingHours;
};

export const garageEmployeesKey='aa-garage-employees-v1';

const defaults:GarageEmployee[]=[
 {id:'keith',name:'Keith',jobTitle:'Workshop manager',phone:'',email:'',access:'workshop',loginRole:'keith',passcode:'',active:true},
 {id:'sandra',name:'Sandra',jobTitle:'Front of house',phone:'',email:'',access:'front',loginRole:'sandra',passcode:'',active:true},
 {id:'gavin',name:'Gavin',jobTitle:'Technician',phone:'',email:'',access:'technician',loginRole:'gavin',passcode:'',active:true},
 {id:'auris',name:'Auris',jobTitle:'Technician',phone:'',email:'',access:'technician',loginRole:'auris',passcode:'',active:true},
 {id:'mohammad',name:'Mohammad',jobTitle:'Technician',phone:'',email:'',access:'technician',loginRole:'mohammad',passcode:'',active:true},
 {id:'jack',name:'Jack',jobTitle:'Technician',phone:'',email:'',access:'technician',loginRole:'jack',passcode:'',active:true}
];

export const readGarageEmployees=():GarageEmployee[]=>{
 try{const saved=JSON.parse(localStorage.getItem(garageEmployeesKey)||'null'),records=Array.isArray(saved)?saved:defaults;return records.map(employee=>({...employee,workingHours:{...defaultGarageWorkingHours(),...(employee.workingHours||{})}}))}catch{return defaults.map(employee=>({...employee,workingHours:defaultGarageWorkingHours()}))}
};

export const saveGarageEmployees=(employees:GarageEmployee[])=>{
 localStorage.setItem(garageEmployeesKey,JSON.stringify(employees));
 const security=(()=>{try{return JSON.parse(localStorage.getItem('aa-login-security')||'{}')}catch{return{}}})();
 employees.forEach(employee=>{security[employee.id]={enabled:!!employee.passcode,passcode:employee.passcode}});
 localStorage.setItem('aa-login-security',JSON.stringify(security));
 localStorage.setItem('aa-garage-mechanics',JSON.stringify(employees.filter(employee=>employee.access==='technician').map(employee=>({name:employee.name,active:employee.active}))));
 window.dispatchEvent(new Event('aa-garage-employees-updated'));
 window.dispatchEvent(new Event('aa-garage-mechanics-changed'));
};

export const employeeDetail=(employee:GarageEmployee)=>`Garage · ${employee.jobTitle||({workshop:'Workshop',front:'Front of house',technician:'Technician'} as const)[employee.access]}`;
