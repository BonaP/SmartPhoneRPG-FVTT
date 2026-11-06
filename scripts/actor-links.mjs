export function actorReference(data={}) {
  data??={};
  if(Object.hasOwn(data,'actorUuid')) return data.actorUuid || null;
  return data.actorId?`Actor.${data.actorId}`:null;
}
export function describeActorLink(data,actors) {
  const uuid=actorReference(data);
  if(!uuid) return {uuid:null,id:null,status:'unlinked',name:'Sem personagem vinculado',img:null};
  const id=typeof uuid==='string'?/^Actor\.([A-Za-z0-9]+)$/.exec(uuid)?.[1]:null;
  const actor=id?actors.get(id):null;
  if(!actor || actor.invalid || actor.pack || actor.parent) return {uuid,id:id??null,status:'missing',name:'Personagem excluído ou indisponível',img:null};
  return {uuid,id,status:'linked',name:actor.name??'Personagem sem nome',img:typeof actor.img==='string'&&!/^(?:javascript|vbscript):/i.test(actor.img)?actor.img:null,actor};
}
export function existingActorFields(data={}) {
  const uuid=actorReference(data);
  return {actorUuid:uuid,actorId:typeof uuid==='string'?/^Actor\.([A-Za-z0-9]+)$/.exec(uuid)?.[1]??null:null,actorLinkVersion:1};
}
export function prepareActorLink(input,previous,actors) {
  if(input.actorUuid===undefined && input.actorId===undefined) return existingActorFields(previous);
  const uuid=input.actorUuid!==undefined?(input.actorUuid || null):(input.actorId?`Actor.${input.actorId}`:null);
  if(uuid!==null && typeof uuid!=='string') throw Error('Referência de personagem inválida.');
  const description=describeActorLink({actorUuid:uuid},actors);
  if(input.actorUuid!==undefined && input.actorId!==undefined && (input.actorId||null)!==description.id) throw Error('As referências do personagem não correspondem.');
  // A dangling, unchanged reference is safe to preserve while editing other fields.
  if(uuid!==null && description.status!=='linked' && uuid!==actorReference(previous)) throw Error('Selecione um Actor válido do mundo ou a opção Sem personagem.');
  return {actorUuid:uuid,actorId:description.id,actorLinkVersion:1};
}
export function filterPhonesByActor(phones,filter,actors) {
  if(!filter || filter==='all') return phones;
  return phones.filter(phone=>{
    const link=describeActorLink(phone,actors);
    if(filter==='unlinked') return link.status==='unlinked';
    if(filter==='missing') return link.status==='missing';
    return link.uuid===filter;
  });
}
