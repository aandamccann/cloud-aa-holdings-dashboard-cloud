import { supabaseUserRequest } from './supabase';

export type GarageNumberType = 'quote' | 'job-card' | 'invoice';
const prefixes: Record<GarageNumberType, string> = { quote: 'EST', 'job-card': 'JC', invoice: 'INV' };
const counterKey = (type: GarageNumberType) => `aa-garage-number-${type}`;
const format = (type: GarageNumberType, number: number) => `${prefixes[type]}-${String(number).padStart(5, '0')}`;
export const peekNextGarageNumber = (type: GarageNumberType) => format(type, Number(localStorage.getItem(counterKey(type)) || 0) + 1);
export const nextGarageNumber = (type: GarageNumberType) => { const next = Number(localStorage.getItem(counterKey(type)) || 0) + 1; localStorage.setItem(counterKey(type), String(next)); return format(type, next); };

const cloudTypes:Record<GarageNumberType,'estimate'|'job_card'|'invoice'>={quote:'estimate','job-card':'job_card',invoice:'invoice'};

export async function reserveGarageNumber(type:GarageNumberType){
 const token=sessionStorage.getItem('aa-cloud-access-token');
 if(!token)throw new Error('Your session has expired. Sign in again before saving this document.');
 const number=await supabaseUserRequest<string>('rpc/reserve_garage_document_number',token,{method:'POST',body:JSON.stringify({p_document_type:cloudTypes[type]})});
 if(!number||typeof number!=='string')throw new Error('Supabase did not return a document number. Your draft has not been cleared.');
 const sequence=Number(number.split('-').pop()||0);if(sequence>Number(localStorage.getItem(counterKey(type))||0))localStorage.setItem(counterKey(type),String(sequence));
 return number;
}
