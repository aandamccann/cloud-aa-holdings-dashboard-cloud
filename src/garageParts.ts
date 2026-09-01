export type GaragePart={id:string;name:string;description:string;partNumber?:string;sku:string;unit:string;price:number;cost:number;stock:number;supplier:string};

export const garagePartsKey='aa-garage-parts-v1';
export const garageSuppliersKey='aa-garage-suppliers-v1';

export const defaultGarageParts:GaragePart[]=[
 {id:'part-oil-filter',name:'Oil filter',description:'Standard engine oil filter',sku:'OF-001',unit:'each',price:12.5,cost:0,stock:0,supplier:''},
 {id:'part-air-filter',name:'Air filter',description:'Engine air filter',sku:'AF-001',unit:'each',price:18,cost:0,stock:0,supplier:''},
 {id:'part-fuel-filter',name:'Fuel filter',description:'Fuel system filter',sku:'FF-001',unit:'each',price:28,cost:0,stock:0,supplier:''},
 {id:'part-engine-oil',name:'Engine oil 5W-30',description:'Fully synthetic engine oil',sku:'OIL-5W30',unit:'litre',price:11.5,cost:0,stock:0,supplier:''},
 {id:'part-front-pads',name:'Front brake pad set',description:'Front axle brake pads',sku:'BP-FRONT',unit:'set',price:64,cost:0,stock:0,supplier:''},
];

export const readGarageParts=():GaragePart[]=>{try{const saved=JSON.parse(localStorage.getItem(garagePartsKey)||'null');return Array.isArray(saved)?saved:defaultGarageParts}catch{return defaultGarageParts}};
export const saveGarageParts=(parts:GaragePart[])=>{localStorage.setItem(garagePartsKey,JSON.stringify(parts));window.dispatchEvent(new CustomEvent('aa-garage-parts-updated'))};
export const readGarageSuppliers=():string[]=>{try{const saved=JSON.parse(localStorage.getItem(garageSuppliersKey)||'[]'),fromParts=readGarageParts().map(part=>part.supplier).filter(Boolean);return Array.from(new Set([...(Array.isArray(saved)?saved:[]),...fromParts].map(value=>String(value).trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b))}catch{return[]}};
export const saveGarageSuppliers=(suppliers:string[])=>{localStorage.setItem(garageSuppliersKey,JSON.stringify(Array.from(new Set(suppliers.map(value=>value.trim()).filter(Boolean)))));window.dispatchEvent(new CustomEvent('aa-garage-suppliers-updated'))};
export const nextGaragePartSku=(partName='')=>{const used=new Set(readGarageParts().map(part=>part.sku.trim().toLowerCase()).filter(Boolean)),words=partName.trim().toUpperCase().match(/[A-Z0-9]+/g)||[],base=(words.length>1?words.map(word=>word[0]).join('').slice(0,4):words[0]?.slice(0,3))||'PRT';let number=1,partNumber='';do{partNumber=`${base}-${String(number++).padStart(3,'0')}`}while(used.has(partNumber.toLowerCase()));return partNumber};
export const saveGaragePart=(part:Omit<GaragePart,'id'>)=>{const parts=readGarageParts(),name=part.name.trim().toLowerCase(),sku=part.sku.trim().toLowerCase(),sameName=parts.find(item=>item.name.trim().toLowerCase()===name),sameSku=sku?parts.find(item=>item.sku.trim().toLowerCase()===sku):undefined;if(sameName)throw new Error(`A part named “${sameName.name}” already exists in the parts database.`);if(sameSku)throw new Error(`SKU “${part.sku.trim()}” is already used by “${sameSku.name}”.`);const saved:GaragePart={...part,id:`part-${Date.now()}-${Math.random()}`,name:part.name.trim(),sku:part.sku.trim()};saveGarageParts([...parts,saved]);return saved};
