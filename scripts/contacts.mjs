import {parsePhone,normalizeCountryCode} from './numbering.mjs';
export function contactDefaults(settings){
  let countryCode;try{countryCode=normalizeCountryCode(settings?.countryCode??'55');}catch{countryCode='55';}
  const areaCode=/^\d{1,5}$/.test(settings?.areaCode??'')?settings.areaCode:'11';return {countryCode,areaCode};
}
export function contactsFor(phone,user){
  const shared=Array.isArray(phone?.contacts)?phone.contacts:[];
  const own=Array.isArray(phone?.personalContacts?.[user?.id])?phone.personalContacts[user.id]:[];
  const map=new Map(shared.map(c=>[c.id,{...c,name:c.name||'NOME DO CONTATO'}]));
  for(const c of own)map.set(c.id,{...c,name:c.name||'NOME DO CONTATO'});return [...map.values()];
}
export function validateContactInput(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(k=>!['countryCode','phoneNumber','name'].includes(k)))throw Error('Contato inválido.');
  const {countryCode,national}=parsePhone(payload.phoneNumber,payload.countryCode);
  const name=payload.name===undefined||payload.name===''?'NOME DO CONTATO':payload.name;
  if(typeof name!=='string'||!name.trim()||name.length>80)throw Error('Apelido obrigatório, com até 80 caracteres.');
  return {number:countryCode+national,name:name.trim()};
}
export function contactPatch(phone,user,payload,phones){
  const input=validateContactInput(payload);
  if(!phones)return {};
  const target=phones.find(p=>p.phoneNumberNormalized===input.number&&!p.archived&&!p.disabled&&!p.deletionPending);
  if(!target||target.id===phone.id)throw Error('Número não encontrado ou indisponível para contato.');
  const own=Array.isArray(phone.personalContacts?.[user.id])?phone.personalContacts[user.id]:[];
  if(own.length>=200&&!own.some(c=>c.id===target.id))throw Error('Limite de 200 contatos pessoais por aparelho.');
  return {personalContacts:{...phone.personalContacts,[user.id]:[...own.filter(c=>c.id!==target.id),{id:target.id,name:input.name,phoneNumber:target.phoneNumber}]}};
}
