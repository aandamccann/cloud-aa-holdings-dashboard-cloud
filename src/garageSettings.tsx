import { useEffect, useState } from 'react';
import { Settings, ShieldAlert, Save, Search, Wrench, PackagePlus, Trash2 } from 'lucide-react';
import {nextGaragePartSku,readGarageParts,readGarageSuppliers,saveGaragePart,saveGarageParts,saveGarageSuppliers,type GaragePart} from './garageParts';
import './garageSettings.css';

export type GarageRates = {
  vatRate: number;
  vatRates: number[];
  labourRate: number;
  consumablesDefault: number;
  wasteDefault: number;
  quoteCustomerNote: string;
};

export const garageRatesKey = 'aa-garage-rates-v1';
export const readGarageRates = (): GarageRates => {
  try {
    const stored = JSON.parse(localStorage.getItem(garageRatesKey) || '{}');
    const consumablesMigrationKey = 'aa-garage-consumables-default-12-v1';
    if (!localStorage.getItem(consumablesMigrationKey)) {
      stored.consumablesDefault = 12;
      localStorage.setItem(garageRatesKey, JSON.stringify(stored));
      localStorage.setItem(consumablesMigrationKey, 'true');
    }
    const vatRate = Number(stored.vatRate ?? 13.5);
    const vatRates = Array.from(new Set([vatRate, ...(Array.isArray(stored.vatRates) ? stored.vatRates.map(Number) : [13.5, 23])])).filter(value => Number.isFinite(value) && value >= 0);
    return { labourRate: 100, consumablesDefault: 12, wasteDefault: 0, quoteCustomerNote: '', ...stored, vatRate, vatRates };
  } catch {
    return { vatRate: 13.5, vatRates: [13.5, 23], labourRate: 100, consumablesDefault: 12, wasteDefault: 0, quoteCustomerNote: '' };
  }
};

type SavedCustomJob = { id: string; name: string; hours: number; labourRate: number; parts: string[]; createdAt: string };
const readCustomJobs = (): SavedCustomJob[] => {
  try { return JSON.parse(localStorage.getItem('aa-garage-custom-jobs') || '[]'); }
  catch { return []; }
};

const installProtectedGarageEdits = () => {
  if (typeof document === 'undefined') return;
  const install = () => document.querySelectorAll<HTMLElement>('.universalWidget:has(.gms) > .universalWidgetTools').forEach(tools => {
    if (tools.querySelector('[data-action="garage-protected-edit"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = 'garage-protected-edit';
    button.title = 'Edit protected garage settings';
    button.setAttribute('aria-label', 'Edit protected garage settings');
    button.textContent = '✎';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if ((sessionStorage.getItem('aa-role') || 'owner') !== 'owner') {
        alert('Only the main account can edit this.');
        return;
      }
      window.dispatchEvent(new CustomEvent('aa-navigate', { detail: { biz: 'motors', page: 'garage-settings' } }));
    });
    tools.appendChild(button);
  });
  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
  queueMicrotask(install);
};
installProtectedGarageEdits();

export function GarageSettings() {
  const mainAccount = (sessionStorage.getItem('aa-role') || 'owner') === 'owner';
  const [rates, setRates] = useState(readGarageRates);
  const [activeTab, setActiveTab] = useState<'rates' | 'custom-jobs' | 'parts'>('rates');
  const [customJobs, setCustomJobs] = useState<SavedCustomJob[]>(readCustomJobs);
  const [customJobQuery, setCustomJobQuery] = useState('');
  const [parts, setParts] = useState<GaragePart[]>(readGarageParts);
  const [partQuery, setPartQuery] = useState('');
  const [suppliers,setSuppliers]=useState<string[]>(readGarageSuppliers);
  const [newSupplier,setNewSupplier]=useState('');
  const [partDraft, setPartDraft] = useState(()=>({name:'',description:'',sku:'',unit:'each',price:0,cost:0,markup:0,stock:0,supplier:''}));
  const [partNumberEdited,setPartNumberEdited]=useState(false);
  const [priceBasis,setPriceBasis]=useState<'cost'|'selling'>('cost');
  const [newVatRate, setNewVatRate] = useState('');
  const [message, setMessage] = useState(mainAccount ? '' : 'Only the main account can edit these settings.');
  useEffect(() => { const heading = document.querySelector('main>header h1'); if (heading) heading.textContent = 'Garage settings'; }, []);
  useEffect(() => { const refresh = () => setCustomJobs(readCustomJobs()); window.addEventListener('aa-garage-custom-jobs-updated', refresh); return () => window.removeEventListener('aa-garage-custom-jobs-updated', refresh); }, []);
  useEffect(()=>{if(activeTab!=='parts')return;const form=document.querySelector<HTMLElement>('.partDatabaseForm'),button=form?.querySelector<HTMLButtonElement>('button');if(button)button.disabled=!mainAccount||!partDraft.name.trim()||!partDraft.sku.trim()||!partDraft.supplier.trim()||partDraft.cost<=0||partDraft.price<=0},[activeTab,mainAccount,partDraft]);
  const change = (field: keyof GarageRates, value: number) => setRates(current => ({ ...current, [field]: value }));
  const save = () => {
    if (!mainAccount) {
      setMessage('Only the main account can edit these settings.');
      return;
    }
    localStorage.setItem(garageRatesKey, JSON.stringify(rates));
    window.dispatchEvent(new CustomEvent('aa-garage-rates-updated'));
    setMessage('Garage rates saved. New job cards will use these amounts.');
  };
  const addVatRate = () => {
    const value = Number(newVatRate);
    if (!mainAccount || !Number.isFinite(value) || value < 0) return;
    setRates(current => ({ ...current, vatRates: Array.from(new Set([...current.vatRates, value])) }));
    setNewVatRate('');
  };
  const filteredCustomJobs = customJobs.filter(job => [job.name, ...(job.parts || [])].join(' ').toLowerCase().includes(customJobQuery.toLowerCase()));
  const filteredParts=parts.filter(part=>[part.name,part.description,part.sku,part.supplier].join(' ').toLowerCase().includes(partQuery.toLowerCase()));
  const addPart=()=>{if(!mainAccount){setMessage('Only the main account can edit these settings.');return}if(!partDraft.name.trim()){setMessage('Enter a part name before saving.');return}if(!partDraft.sku.trim()){setMessage('Enter a part number before saving.');return}if(!partDraft.supplier.trim()){setMessage('Enter a supplier before saving.');return}if(partDraft.cost<=0){setMessage('Enter a cost price greater than zero before saving.');return}if(partDraft.price<=0){setMessage('Enter a selling price greater than zero before saving.');return}try{saveGaragePart(partDraft);setParts(readGarageParts());setPartDraft({name:'',description:'',sku:'',unit:'each',price:0,cost:0,markup:0,stock:0,supplier:''});setPartNumberEdited(false);setMessage('Part saved to the shared Garage parts database.')}catch(error){setMessage(error instanceof Error?error.message:'That part could not be saved.')}};
  const removePart=(id:string)=>{if(!mainAccount){setMessage('Only the main account can edit these settings.');return}const next=parts.filter(part=>part.id!==id);setParts(next);saveGarageParts(next);setMessage('Part removed from the shared Garage parts database.')};
  const addSupplier=()=>{const supplier=newSupplier.trim();if(!mainAccount||!supplier)return;if(suppliers.some(value=>value.toLowerCase()===supplier.toLowerCase())){setMessage('That supplier is already saved.');return}const next=[...suppliers,supplier].sort((a,b)=>a.localeCompare(b));setSuppliers(next);saveGarageSuppliers(next);setNewSupplier('');setMessage(`${supplier} added to the Supplier dropdown.`)};
  const removeSupplier=(supplier:string)=>{if(!mainAccount)return;const next=suppliers.filter(value=>value!==supplier);setSuppliers(next);saveGarageSuppliers(next);setMessage(`${supplier} removed from the Supplier dropdown.`)};
  useEffect(()=>{if(activeTab!=='parts')return;const section=document.querySelector<HTMLElement>('.partsDatabase'),list=section?.querySelector('.partsDatabaseList'),supplierInput=section?.querySelector<HTMLInputElement>('.partDatabaseForm label:nth-of-type(4) input');if(!section||!list||!supplierInput)return;section.querySelector('.supplierSettingsManager')?.remove();const manager=document.createElement('section'),heading=document.createElement('h4'),row=document.createElement('div'),input=document.createElement('input'),add=document.createElement('button'),choices=document.createElement('div');manager.className='supplierSettingsManager';heading.textContent='Suppliers';input.placeholder='Enter a supplier name';input.setAttribute('aria-label','New supplier name');input.value=newSupplier;input.oninput=event=>setNewSupplier((event.target as HTMLInputElement).value);add.type='button';add.textContent='Add supplier';add.disabled=!mainAccount||!newSupplier.trim();add.onclick=addSupplier;choices.className='supplierSettingsChoices';suppliers.forEach(supplier=>{const chip=document.createElement('span'),remove=document.createElement('button');chip.textContent=supplier;remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`Remove supplier ${supplier}`);remove.disabled=!mainAccount;remove.onclick=()=>removeSupplier(supplier);chip.appendChild(remove);choices.appendChild(chip)});row.append(input,add);manager.append(heading,row,choices);section.insertBefore(manager,list);const label=supplierInput.closest('label');label?.querySelector('.supplierDropdownMenu')?.remove();const menu=document.createElement('div');menu.className='supplierDropdownMenu';const render=()=>{menu.replaceChildren();const query=supplierInput.value.trim().toLowerCase();suppliers.filter(value=>value.toLowerCase().includes(query)).forEach(value=>{const option=document.createElement('button');option.type='button';option.textContent=value;option.onclick=()=>{supplierInput.value=value;supplierInput.dispatchEvent(new Event('input',{bubbles:true}));menu.hidden=true};menu.appendChild(option)});menu.hidden=!menu.childElementCount};supplierInput.onfocus=render;supplierInput.oninput=render;label?.appendChild(menu)},[activeTab,suppliers,newSupplier,mainAccount]);
  return <div className="garageSettingsPage">
    <header><Settings/><div><em>GARAGE SETTINGS</em><h2>Garage configuration</h2><p>Rates, default amounts and reusable custom jobs in one protected place.</p></div></header>
    {!mainAccount && <div className="garageSettingsNotice"><ShieldAlert/>Only the main account can edit these settings. You can view the current amounts.</div>}
    <nav className="garageSettingsTabs" aria-label="Garage settings sections">
      <button className={activeTab === 'rates' ? 'active' : ''} type="button" onClick={() => setActiveTab('rates')}><Settings/>Rates &amp; defaults</button>
      <button className={activeTab === 'custom-jobs' ? 'active' : ''} type="button" onClick={() => setActiveTab('custom-jobs')}><Wrench/>Custom jobs</button>
      <button className={activeTab === 'parts' ? 'active' : ''} type="button" onClick={() => setActiveTab('parts')}><PackagePlus/>Parts database</button>
    </nav>
    {activeTab === 'rates' && <section>
      <h3>Job card rates</h3>
      <div className="garageSettingsGrid">
        <div className="vatRatesSetting"><strong>VAT rates</strong><p>The primary rate is selected automatically on new prices.</p><div className="vatRateChoices">{rates.vatRates.map(rate => <button disabled={!mainAccount} className={rate === rates.vatRate ? 'primary' : ''} type="button" key={rate} onClick={() => change('vatRate', rate)}>{rate}%{rate === rates.vatRate && <small>Primary</small>}</button>)}</div><label><span>Add another VAT rate %</span><span className="vatRateAdd"><input disabled={!mainAccount} type="number" min="0" step="0.1" value={newVatRate} onChange={event => setNewVatRate(event.target.value)} placeholder="For example 9"/><button disabled={!mainAccount || newVatRate === ''} type="button" onClick={addVatRate}>+ Add rate</button></span></label></div>
        <label><span>Default labour rate per hour €</span><input disabled={!mainAccount} type="number" min="0" step="0.01" value={rates.labourRate} onChange={event => change('labourRate', +event.target.value)}/></label>
        <label><span>Default Consumables &amp; Waste charge €</span><input disabled={!mainAccount} type="number" min="0" step="0.01" value={rates.consumablesDefault} onChange={event => change('consumablesDefault', +event.target.value)}/></label>
        <label className="quoteCustomerNoteSetting"><span>Default customer note on every Quote</span><textarea disabled={!mainAccount} value={rates.quoteCustomerNote} onChange={event => setRates(current => ({ ...current, quoteCustomerNote: event.target.value }))} placeholder="Enter the standard instructions or notes shown at the bottom of every customer Quote"/></label>
      </div>
      <button type="button" disabled={!mainAccount} onClick={save}><Save/>Save garage settings</button>
      {message && <p className="garageSettingsMessage">{message}</p>}
    </section>}
    {activeTab === 'custom-jobs' && <section className="customJobsDatabase">
      <div className="customJobsHeading"><div><h3>Custom jobs database</h3><p>{customJobs.length} reusable jobs saved</p></div><label className="calendarFilter"><Search/><input aria-label="Search and filter custom jobs" value={customJobQuery} onChange={event => setCustomJobQuery(event.target.value)} placeholder="Search and filter custom jobs"/>{customJobQuery && <button type="button" onClick={() => setCustomJobQuery('')}>Clear</button>}</label></div>
      <div className="customJobsList">{filteredCustomJobs.map(job => <article key={job.id}><div><strong>{job.name}</strong><small>{job.parts?.length ? job.parts.join(', ') : 'No parts saved'}</small></div><span><b>{job.hours} labour hours</b><small>€{Number(job.labourRate || 0).toFixed(2)} per hour</small></span><time>{job.createdAt ? new Date(job.createdAt).toLocaleDateString('en-IE') : 'Saved job'}</time></article>)}{!filteredCustomJobs.length && <p className="customJobsEmpty">{customJobQuery ? 'No custom jobs match that search.' : 'No custom jobs have been saved yet.'}</p>}</div>
    </section>}
    {activeTab === 'parts' && <section className="partsDatabase">
      <div className="partsDatabaseHeading"><div><h3>Parts database</h3><p>{parts.length} parts available to Quotes, Job Cards and Invoices</p></div><label className="calendarFilter"><Search/><input aria-label="Search and filter parts database" value={partQuery} onChange={event=>setPartQuery(event.target.value)} placeholder="Search and filter parts"/>{partQuery&&<button type="button" onClick={()=>setPartQuery('')}>Clear</button>}</label></div>
      <div className="partDatabaseForm"><h4>Add a part</h4><label><span>Part name</span><input required disabled={!mainAccount} value={partDraft.name} onChange={event=>{const name=event.target.value;setPartDraft({...partDraft,name,sku:partNumberEdited?partDraft.sku:nextGaragePartSku(name)})}}/></label><label><span>Part number</span><input required disabled={!mainAccount} value={partDraft.sku} onChange={event=>{setPartNumberEdited(true);setPartDraft({...partDraft,sku:event.target.value})}}/></label><label><span>Description</span><input disabled={!mainAccount} value={partDraft.description} onChange={event=>setPartDraft({...partDraft,description:event.target.value})}/></label><label><span>Supplier</span><input required disabled={!mainAccount} value={partDraft.supplier} onChange={event=>setPartDraft({...partDraft,supplier:event.target.value})}/></label><label><span>Unit</span><input disabled={!mainAccount} value={partDraft.unit} onChange={event=>setPartDraft({...partDraft,unit:event.target.value})}/></label><label><span>Cost price €</span><input required disabled={!mainAccount} type="number" min="0.01" step="0.01" value={partDraft.cost} onChange={event=>{const cost=+event.target.value;setPriceBasis('cost');setPartDraft({...partDraft,cost,price:Number((cost*(1+partDraft.markup/100)).toFixed(2))})}}/></label><label><span>Markup %</span><input disabled={!mainAccount} type="number" min="0" step="0.1" value={partDraft.markup} onChange={event=>{const markup=+event.target.value,factor=1+markup/100;setPartDraft(priceBasis==='selling'?{...partDraft,markup,cost:Number((partDraft.price/factor).toFixed(2))}:{...partDraft,markup,price:Number((partDraft.cost*factor).toFixed(2))})}}/></label><label><span>Selling price €</span><input required disabled={!mainAccount} type="number" min="0.01" step="0.01" value={partDraft.price} onChange={event=>{const price=+event.target.value,factor=1+partDraft.markup/100;setPriceBasis('selling');setPartDraft({...partDraft,price,cost:Number((price/factor).toFixed(2))})}}/></label><label><span>Stock quantity</span><input disabled={!mainAccount} type="number" min="0" step="0.01" value={partDraft.stock} onChange={event=>setPartDraft({...partDraft,stock:+event.target.value})}/></label><button type="button" disabled={!mainAccount||!partDraft.name.trim()||!partDraft.sku.trim()||!partDraft.supplier.trim()||partDraft.cost<=0||partDraft.price<=0} onClick={addPart}><PackagePlus/>Save part</button></div>
      <div className="partsDatabaseList">{filteredParts.map(part=><article key={part.id}><div><strong>{part.name}</strong><small>{part.description||'No description'}{part.sku?` · ${part.sku}`:''}</small></div><span><b>€{part.price.toFixed(2)} +</b><small>Cost €{part.cost.toFixed(2)}</small></span><span><b>{part.stock} {part.unit}</b><small>{part.supplier||'No supplier'}</small></span><button type="button" disabled={!mainAccount} onClick={()=>removePart(part.id)} aria-label={`Remove ${part.name}`}><Trash2/></button></article>)}{!filteredParts.length&&<p className="customJobsEmpty">No parts match that search.</p>}</div>
      {message&&<p className="garageSettingsMessage">{message}</p>}
    </section>}
  </div>;
}
