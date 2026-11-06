import {filterPhonesByActor} from './actor-links.mjs';

const fold=value=>String(value??'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
export function filterDevices(phones,{query='',actor='all',status='active'}={},actors) {
  const needle=fold(query).trim();
  const digits=needle.replace(/\D/g,'');
  const numberQuery=digits && /^[+\d\s()\-]+$/.test(needle);
  return filterPhonesByActor(phones,actor,actors).filter(phone=>
    (status==='all'||(status==='archived'?phone.archived===true:phone.archived!==true)) &&
    (!needle || fold(phone.name).includes(needle) || fold(phone.nickname).includes(needle) ||
      (numberQuery && String(phone.phoneNumberNormalized??phone.phoneNumber??'').replace(/\D/g,'').includes(digits)))
  );
}

// The authorized save service clones the source data under the shared lock.
export function duplicateInput(phone) {
  const data=phone.data??{};
  return {name:`${String(phone.name).slice(0,72)} - Cópia`,countryCode:data.countryCode,
    ...(data.numberingVersion>=3?{areaCode:data.areaCode,localNumber:''}:{}),phoneNumber:''};
}

export function archivePatch(data,archived,userId,at=new Date().toISOString()) {
  if(typeof archived!=='boolean') throw Error('Situação de arquivamento inválida.');
  if((data.archived===true)===archived) return null;
  return {archived,archiveAudit:[...(Array.isArray(data.archiveAudit)?data.archiveAudit:[]),
    {operation:archived?'archive':'restore',at,userId}]};
}
