import {parts} from './phone-parts.mjs';
import {escapeHTML as esc} from './core.mjs';
import {numberIndex,parsePhone} from './numbering.mjs';

export function assertDeviceIds(phones,registry=[]) {
  const seen=new Set();
  for(const phone of phones) {
    if(typeof phone.id!=='string'||!phone.id||seen.has(phone.id)) throw Error('ID de aparelho ausente ou duplicado. Nenhum ID foi alterado.');
    seen.add(phone.id);
    for(const key of ['id','_id']) if(phone.data?.[key]!==undefined && phone.data[key]!==phone.id) throw Error('ID interno inconsistente no cadastro. Nenhum ID foi alterado.');
  }
  if(new Set(registry).size!==registry.length) throw Error('Há IDs duplicados no registro de aparelhos. Nenhum ID foi alterado.');
}
export function assertImmutableInput(input) {
  if(!input || typeof input!=='object') throw Error('Dados de aparelho inválidos.');
  if(Object.keys(input).some(key=>['id','_id','uuid','deviceId'].includes(key)||key.includes('.')||['flags','data','ownership'].includes(key))) throw Error('O ID interno e os documentos do aparelho não podem ser alterados pela requisição.');
}
export function assertRestorable(phone,phones) {
  assertDeviceIds(phones);
  const data=phone.data;
  if(data.kind!=='phone'||!Array.isArray(data.users)||!Array.isArray(data.contacts)||!data.permissions||typeof data.permissions!=='object'||!data.phoneNumberNormalized||!data.phoneNumber) throw Error('Dados do aparelho inválidos para restauração.');
  numberIndex(phones);
  if(data.numberingVersion>=3){if(parts(data).phoneNumberNormalized!==data.phoneNumberNormalized)throw Error('Número inconsistente.');return;}
  const number=parsePhone(data.phoneNumber,data.countryCode);
  if(number.countryCode+number.national!==data.phoneNumberNormalized) throw Error('Número inconsistente. Restauração cancelada.');
}
export function invalidateSessions(data) {
  const patch={accessEpoch:Number.isSafeInteger(data.accessEpoch)?data.accessEpoch+1:1};
  for(const key of ['sessions','unlockSessions','unlockedUsers','unlockTokens']) if(Object.hasOwn(data,key)) patch[key]=Array.isArray(data[key])?[]:{};
  return patch;
}
export function deletionContent(phone,actors) {
  return `<p>Excluir o aparelho <strong>${esc(phone.name)}</strong>?</p><p>A exclusão é permanente. Não será possível recuperar nenhuma informação deste celular posteriormente.</p>`;
}
export async function confirmDeletion(phone,actors,Dialog) {
  const result=await Dialog.wait({window:{title:'Excluir definitivamente'},classes:['srpg-delete-dialog'],modal:true,content:deletionContent(phone,actors),buttons:[
    {action:'cancel',label:'Cancelar',type:'button',default:true,callback:()=>({cancelled:true})},
    {action:'delete',label:'Excluir',callback:()=>({confirmationName:phone.name})}
  ],rejectClose:false});
  return result?.confirmationName??null;
}

// Foundry has no transaction spanning Journals, settings and ChatMessages.
// Persist a minimal intent first; every destructive step is idempotent and
// can be resumed after a failure, including a failure after the phone is gone.
export function createLifecycleService(adapter) {
  const authorize=()=>{if(!adapter.isGM()) throw Error('Somente o GM pode administrar aparelhos.');};
  const state=async()=>{
    const raw=await adapter.readState();
    if(!raw || typeof raw!=='object' || Array.isArray(raw)) throw Error('Diário de auditoria inválido. Nenhuma operação foi iniciada.');
    const ledger={audit:[],retiredIds:[],deletions:{},...raw};
    if(!Array.isArray(ledger.audit)||!Array.isArray(ledger.retiredIds)||!ledger.deletions||typeof ledger.deletions!=='object'||Array.isArray(ledger.deletions)) throw Error('Diário de auditoria inválido. Nenhuma operação foi iniciada.');
    return ledger;
  };
  const record=(operation,phone)=>({operation,deviceId:phone.id??null,name:phone.name??'',number:phone.data?.phoneNumber??'',userId:adapter.userId(),at:new Date().toISOString(),result:'pending',token:adapter.token()});
  async function audited(operation,phone,task) {
    authorize();
    let ledger=await state();const entry=record(operation,phone);
    ledger.audit.push(entry);await adapter.writeState(ledger);
    try {
      const result=await task();
      entry.result='success';entry.deviceId??=result?.id??null;
      await adapter.writeState(ledger);return result;
    } catch(error) {
      entry.result='failed';
      try {await adapter.writeState(ledger);}catch {/* The durable pending intent remains diagnostic. */}
      throw error;
    }
  }
  async function eraseInside(id,ledger) {
    const job=ledger.deletions[id];
    const stage=async value=>{authorize();job.stage=value;await adapter.writeState(ledger);};
    try {
      await stage('disable');await adapter.disable(id);
      await stage('associated-data');await adapter.purgeAssociated(id);
      await stage('device');await adapter.erase(id);
      await stage('registry');await adapter.unregister(id);
      await stage('verify');await adapter.verifyErased(id);
      job.result='success';job.stage='complete';
      const entry=ledger.audit.find(e=>e.token===job.token);if(entry) entry.result='success';
      await adapter.writeState(ledger);
      await adapter.afterDelete?.(id);
      return true;
    } catch(error) {
      job.result='pending';job.lastError='storage-error';
      const entry=ledger.audit.find(e=>e.token===job.token);if(entry) entry.result='failed';
      try {await adapter.writeState(ledger);}catch {/* Last persisted stage is enough to retry. */}
      throw Error(`Exclusão interrompida: ${id} (${job.stage}). Use Retomar exclusões interrompidas.`,{cause:error});
    }
  }
  return Object.freeze({audited,
    inspect:async()=>{authorize();const phones=await adapter.list();assertDeviceIds(phones);return state();},
    remove:async(id,confirmationName)=>{
      authorize();
      return adapter.withLock(async()=>{
        authorize();const ledger=await state();const phone=(await adapter.list()).find(p=>p.id===id);
        const pending=ledger.deletions[id]?.result==='pending'?ledger.deletions[id]:null;
        if(!phone&&!pending) throw Error('Aparelho não encontrado ou já excluído.');
        if(typeof confirmationName!=='string'||confirmationName!==(phone?.name??pending.name)) throw Error('O nome informado não corresponde ao aparelho. Exclusão cancelada.');
        if(!pending) {
          const entry=record('delete',phone);
          ledger.audit.push(entry);ledger.deletions[id]={...entry,stage:'intent'};
          if(!ledger.retiredIds.includes(id)) ledger.retiredIds.push(id);
          await adapter.writeState(ledger);
        }
        return eraseInside(id,ledger);
      });
    },
    resume:async()=>{
      authorize();return adapter.withLock(async()=>{
        authorize();const ledger=await state();let count=0;
        for(const [id,job] of Object.entries(ledger.deletions)) if(job.result==='pending') {await eraseInside(id,ledger);count++;}
        return count;
      });
    },
    retiredIds:async()=>new Set((await state()).retiredIds)
  });
}
