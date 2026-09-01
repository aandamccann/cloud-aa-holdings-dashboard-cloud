export const persistentKeys=[
 'aa-employee-permissions','aa-rental-safety-checks','aa-rental-fleet-vehicles','aa-rental-check-note-options','aa-rental-check-groups','aa-unified-work-items-v1','aa-completed-workshop-jobs','aa-completed-workshop-areas','aa-garage-management-jobs-v1',
 'aa-sidebar-pins-owner','aa-sidebar-pins-keith','aa-sidebar-pins-gary','aa-sidebar-pins-sandra',
 'aa-sidebar-pins-ilona','aa-sidebar-pins-driver','aa-sidebar-pins-picker','aa-sidebar-pins-gavin','aa-sidebar-pins-auris','aa-sidebar-pins-mohammad','aa-sidebar-pins-jack','aa-holdings-ideas-v1'
] as const;

export async function hydrateLocalPersistence(){
 await Promise.all(persistentKeys.map(async key=>{try{const response=await fetch(`/api/local-data/${encodeURIComponent(key)}`,{cache:'no-store'});if(!response.ok)return;const body=await response.json() as {value:unknown};if(body.value!==null&&body.value!==undefined)localStorage.setItem(key,JSON.stringify(body.value));else{const existing=localStorage.getItem(key);if(existing!==null)await persistLocalValue(key,JSON.parse(existing))}}catch{}}));
}

export async function persistLocalValue(key:typeof persistentKeys[number],value:unknown){
 localStorage.setItem(key,JSON.stringify(value));
 try{await fetch(`/api/local-data/${encodeURIComponent(key)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value})})}catch{}
}
