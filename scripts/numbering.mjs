import {parts,partsOf} from './phone-parts.mjs';
export const DEFAULT_PATTERN='119########';
export const DEFAULT_COUNTRY_CODE='55';
export function normalizeCountryCode(value=DEFAULT_COUNTRY_CODE) {
  const code=String(value).trim().replace(/^\+/,'');
  if(!/^\d{1,3}$/.test(code)) throw Error('DDI inválido: informe de 1 a 3 dígitos. Exemplo: 55.');
  return code;
}
export function parsePhone(value,countryCode=DEFAULT_COUNTRY_CODE) {
  const code=normalizeCountryCode(countryCode);
  if(typeof value!=='string' || !/^\+?[\d\s()\-]+$/.test(value.trim())) throw Error('Número inválido. Use apenas dígitos e formatação telefônica.');
  const raw=value.trim(), digits=raw.replace(/\D/g,'');
  const national=(raw.startsWith('+') || digits.length>11) && digits.startsWith(code)?digits.slice(code.length):digits;
  if(raw.startsWith('+') && !digits.startsWith(code)) throw Error('Número inválido: o DDI informado não corresponde ao campo DDI.');
  return {countryCode:code,national:normalizeNumber(national)};
}
export function formatNationalInput(value) {
  const n=String(value).replace(/\D/g,'').slice(0,11);
  if(!n) return '';
  if(n.length<2) return `(${n}`;
  const subscriber=n.slice(2), split=subscriber.length>8?5:4;
  return `(${n.slice(0,2)})${subscriber?' '+subscriber.slice(0,split):''}${subscriber.length>split?'-'+subscriber.slice(split):''}`;
}
const keyFor=(national,code)=>code+national;
export function phoneFields(national,code=DEFAULT_COUNTRY_CODE) {
  code=normalizeCountryCode(code);national=normalizeNumber(national);
  return {countryCode:code,areaCode:national.slice(0,2),localNumber:national.slice(2),nationalNumberNormalized:national,phoneNumber:`+${code} ${formatNumber(national)}`,phoneNumberNormalized:code+national,numberingVersion:2,numberPartsVersion:1};
}
export function normalizeNumber(value) {
  if(typeof value!=='string' || !/^[\d\s()\-]+$/.test(value)) throw Error('Número inválido. Use 10 ou 11 dígitos, com ou sem espaços, parênteses e hífens.');
  const normalized=value.replace(/[\s()\-]/g,'');
  if(!/^\d{10,11}$/.test(normalized)) throw Error('Número inválido: informe 10 ou 11 dígitos, incluindo o DDD fictício.');
  return normalized;
}
export function formatNumber(value) {
  const n=normalizeNumber(value);
  return `(${n.slice(0,2)}) ${n.slice(2,-4)}-${n.slice(-4)}`;
}
export function validatePattern(pattern) {
  if(typeof pattern!=='string' || !/^[\d#]{10,11}$/.test(pattern) || !pattern.includes('#')) throw Error('Padrão automático inválido: use 10 ou 11 posições, com dígitos fixos e pelo menos um #. Exemplo: 119########.');
  return pattern;
}
export function allocateNumber(used,pattern=DEFAULT_PATTERN,randomDigit=()=>crypto.getRandomValues(new Uint32Array(1))[0]%10,maxAttempts=256) {
  validatePattern(pattern);
  for(let attempt=0;attempt<maxAttempts;attempt++) {
    const candidate=pattern.replace(/#/g,()=>String(randomDigit()));
    if(!/^\d{10,11}$/.test(candidate)) throw Error('Gerador de números retornou um valor inválido.');
    if(!used.has(candidate)) return candidate;
  }
  throw Error(`Não foi possível gerar um número disponível após ${maxAttempts} tentativas. Informe um número manual ou amplie o padrão.`);
}
const countryOf=data=>normalizeCountryCode(data.countryCode??DEFAULT_COUNTRY_CODE);
const numberOf=data=>data.numberingVersion>=2 ? (data.nationalNumberNormalized || data.phoneNumberNormalized?.slice(countryOf(data).length)) : (data.phoneNumberNormalized || data.phoneNumber);
export function numberIndex(phones) {
  const index=new Map();
  for(const phone of phones) {
    if(phone.data.numberingVersion>=3){const value=parts(phone.data);if(value.phoneNumberNormalized!==phone.data.phoneNumberNormalized)throw Error('Numeração estruturada inconsistente.');if(index.has(value.phoneNumberNormalized)&&index.get(value.phoneNumberNormalized)!==phone.id)throw Error('Há números duplicados nos dados existentes.');index.set(value.phoneNumberNormalized,phone.id);continue;}
    const raw=numberOf(phone.data);
    if(!raw) continue;
    const n=normalizeNumber(raw),code=countryOf(phone.data),key=keyFor(n,code);
    if(phone.data.phoneNumber && parsePhone(phone.data.phoneNumber,code).national!==n) throw Error(`Numeração inconsistente no aparelho ${phone.name}. Corrija os dados preservados antes de continuar.`);
    if(phone.data.numberingVersion>=2 && phone.data.phoneNumberNormalized!==code+n) throw Error(`Numeração normalizada inconsistente no aparelho ${phone.name}.`);
    if(index.has(key) && index.get(key)!==phone.id) throw Error(`Há números duplicados nos dados existentes: +${code} ${formatNumber(n)}. Nenhum aparelho foi renumerado.`);
    index.set(key,phone.id);
  }
  return index;
}
// All adapters run inside a shared, server-enforced lock. A local Promise queue
// alone would not protect two different GM clients.
export function createNumberingService(adapter) {
  const authorize=()=>{if(!adapter.isGM()) throw Error('Somente o GM pode configurar aparelhos.');};
  async function migrateInside() {
    const phones=await adapter.list();
    const index=numberIndex(phones);
    const changes=[];
    for(const phone of phones) {
      if(phone.data.numberingVersion>=3)continue;
      const code=countryOf(phone.data);
      const used=new Set([...index.keys()].filter(key=>key.startsWith(code)).map(key=>key.slice(code.length)));
      const normalized=numberOf(phone.data)?normalizeNumber(numberOf(phone.data)):allocateNumber(used,adapter.pattern(),adapter.randomDigit);
      index.set(keyFor(normalized,code),phone.id);
      const patch={...phoneFields(normalized,code),numberPartsVersion:1,areaCode:normalized.slice(0,2),localNumber:normalized.slice(2)};
      if(Object.entries(patch).some(([key,value])=>phone.data[key]!==value)) changes.push({phone,patch});
    }
    // Validate the entire plan, then back up every changed document before writing.
    for(const {phone} of changes) await adapter.backup(phone,'number-migration');
    for(const {phone,patch} of changes) await adapter.patchNumber(phone,patch);
    return changes.length;
  }
  async function saveInside(id,input,sourceId) {
        await migrateInside();
        const phones=await adapter.list();
        let source;
        if(sourceId) {
          source=phones.find(p=>p.id===sourceId);
          if(!source) throw Error('Aparelho original não encontrado.');
          input=adapter.duplicateInput(source);
        }
        const existing=id?phones.find(p=>p.id===id):null;
        if(id&&!existing) throw Error('Aparelho não encontrado.');
        const index=numberIndex(phones);
        if(input.areaCode!==undefined||input.localNumber!==undefined||existing?.data.numberingVersion>=3){
          const old=existing?partsOf(existing.data):{},defaults=adapter.defaults?.()??{countryCode:'55',areaCode:'11'};
          const countryCode=input.countryCode??old.countryCode??defaults.countryCode,areaCode=input.areaCode??old.areaCode??defaults.areaCode;
          let localNumber=input.localNumber??old.localNumber;
          if(sourceId)localNumber='';
          if(localNumber===undefined&&input.phoneNumber){const raw=parsePhone(input.phoneNumber,countryCode).national;localNumber=raw.slice(String(areaCode).length);}
          let number;
          if(localNumber===undefined||String(localNumber).trim()===''){
            const pattern=adapter.pattern().slice(2);for(let attempt=0;attempt<256;attempt++){const candidate=pattern.replace(/#/g,()=>String(adapter.randomDigit?adapter.randomDigit():crypto.getRandomValues(new Uint32Array(1))[0]%10));number=parts({countryCode,areaCode,localNumber:candidate});if(!index.has(number.phoneNumberNormalized)||index.get(number.phoneNumberNormalized)===id)break;number=null;}if(!number)throw Error('Não foi possível gerar um número disponível.');
          }else number=parts({countryCode,areaCode,localNumber});
          if(index.has(number.phoneNumberNormalized)&&index.get(number.phoneNumberNormalized)!==id)throw Error('O número completo já pertence a outro aparelho.');
          const prepared=await adapter.prepare(existing,input,number,source);if(existing)await adapter.backup(existing,'phone-edit');return adapter.persist(existing,prepared,source?'duplicate':existing?'edit':'create');
        }
        const code=normalizeCountryCode(input.countryCode??existing?.data.countryCode??DEFAULT_COUNTRY_CODE);
        const raw=input.phoneNumber===undefined?numberOf(existing?.data ?? {}):input.phoneNumber;
        const used=new Set([...index].filter(([key,owner])=>owner!==id && key.startsWith(code)).map(([key])=>key.slice(code.length)));
        const normalized=typeof raw==='string' && raw.trim()?parsePhone(raw,code).national:allocateNumber(used,adapter.pattern(),adapter.randomDigit);
        const key=keyFor(normalized,code);
        if(index.has(key) && index.get(key)!==id) throw Error(`O número +${code} ${formatNumber(normalized)} já pertence a outro aparelho.`);
        const prepared=await adapter.prepare(existing,input,phoneFields(normalized,code),source);
        if(existing) await adapter.backup(existing,'phone-edit');
        return adapter.persist(existing,prepared,source?'duplicate':existing?'edit':'create');
  }
  const pendingCopies=new Map();
  return Object.freeze({
    async migrate(){authorize();return adapter.withLock(migrateInside);},
    async save(id,input){authorize();adapter.validateInput?.(input);return adapter.withLock(()=>saveInside(id,input));},
    async duplicate(sourceId){
      authorize();
      if(!sourceId) throw Error('Aparelho original não encontrado.');
      if(pendingCopies.has(sourceId)) throw Error('Duplicação em andamento. Aguarde.');
      pendingCopies.set(sourceId,true);
      try {return await adapter.withLock(()=>saveInside(null,null,sourceId));}
      finally {pendingCopies.delete(sourceId);}
    }
  });
}
