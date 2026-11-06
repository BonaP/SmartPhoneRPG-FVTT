import {requireApp,requireDeviceAccess,isAppEnabled} from './apps.mjs';
import {parts} from './phone-parts.mjs';
import {imagePath} from './presentation.mjs';
const txt=(v,max=80)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('Texto inválido (até '+max+' caracteres).');return v.trim();};
export const emptyMessaging=()=>({schema:1,revision:0,contacts:{},conversations:{},processed:{},legacyImported:false});
const active=p=>p&&!p.archived&&!p.disabled&&!p.deletionPending;
export function applyMessaging(state,user,phones,request,{now=Date.now(),id=()=>crypto.randomUUID()}={}){
 if(!request||typeof request.id!=='string'||request.id.length>100)throw Error('Requisição inválida.');
 if(state.processed[request.id])return state;
 const phone=phones.get(request.from);requireDeviceAccess(phone,user);
 const {action,payload:p={}}=request;requireApp(phone,user,action.startsWith('contact-')?'contacts':'messages');
 if(action==='send-number'){
  const opened=applyMessaging(state,user,phones,{...request,id:request.id+'.open',action:'private-open',payload:{number:p.number}},{now,id});
  const target=[...phones.values()].find(x=>x.phoneNumberNormalized===String(p.number).replace(/\D/g,''));const conv=Object.values(opened.conversations).find(c=>!c.group&&c.members.includes(phone.id)&&c.members.includes(target.id));
  return applyMessaging(opened,user,phones,{...request,action:'message-send',payload:{conversation:conv.id,body:p.body}},{now,id});
 }
 const next=structuredClone(state),contacts=next.contacts[phone.id]??=[],convs=next.conversations;
 const resolve=value=>{const target=phones.get(value)??[...phones.values()].find(x=>x.phoneNumberNormalized===String(value).replace(/\D/g,''));if(!active(target)||!isAppEnabled(target,'messages'))throw Error('Não há destinatário disponível para este número.');return target;};
 if(action==='contact-save'){
  if(Object.keys(p).some(k=>!['id','name','countryCode','areaCode','localNumber','photo'].includes(k)))throw Error('Campos de contato inválidos.');
  const number=parts(p),name=txt(p.name||'NOME DO CONTATO'),photo=imagePath(p.photo||'');
  const previous=p.id?contacts.find(c=>c.id===p.id):null;if(p.id&&!previous)throw Error('Contato não encontrado.');
  if(contacts.some(c=>c.number===number.phoneNumberNormalized&&c.id!==previous?.id))throw Error('Este número já está salvo na agenda.');
  if(contacts.length>=200&&!previous)throw Error('Limite de 200 contatos por aparelho.');
  next.contacts[phone.id]=[...contacts.filter(c=>c.id!==previous?.id),{id:previous?.id??id(),name:user.isGM?name:(previous?.name??'NOME DO CONTATO'),aliases:{...previous?.aliases,[user.id]:name},photo,number:number.phoneNumberNormalized,...number}];
 }else if(action==='contact-delete'){
  if(!contacts.some(c=>c.id===p.id))throw Error('Contato não encontrado.');next.contacts[phone.id]=contacts.filter(c=>c.id!==p.id);
 }else if(action==='private-open'){
  const target=resolve(p.number);if(target.id===phone.id)throw Error('Escolha outro aparelho.');
  if(!contacts.some(c=>c.number===target.phoneNumberNormalized)&&!phone.contacts?.some(c=>c.id===target.id))throw Error('Adicione o número aos contatos primeiro.');
  let conv=Object.values(convs).find(c=>!c.group&&c.ever.includes(phone.id)&&c.ever.includes(target.id));
  if(!conv){conv={id:id(),group:false,name:'Conversa privada',members:[phone.id,target.id],ever:[phone.id,target.id],admin:phone.id,messages:[],read:{},createdAt:now};convs[conv.id]=conv;}
 }else if(action==='group-create'){
  const members=[...new Set([phone.id,...(p.members??[]).map(v=>resolve(v).id)])];if(members.length<3||members.length>50)throw Error('Grupo: de 3 a 50 aparelhos.');
  const conv={id:id(),group:true,name:txt(p.name),photo:imagePath(p.photo||''),members,ever:[...members],admin:phone.id,messages:[],read:{},createdAt:now};convs[conv.id]=conv;
 }else {
  const conv=convs[p.conversation];if(!conv||!conv.ever.includes(phone.id))throw Error('Conversa não autorizada.');
  if(action==='read'){
   const seq=Math.min(Number(p.through)||0,conv.messages.at(-1)?.seq??0);if(seq<0)throw Error('Leitura inválida.');conv.read[phone.id]=Math.max(conv.read[phone.id]??0,seq);
  }else {
   if(!conv.members.includes(phone.id))throw Error('Este aparelho não participa mais do grupo.');
   if(action==='message-send'){
    const body=txt(p.body,2000);if(conv.messages.length>=10000)throw Error('Limite de 10.000 mensagens por conversa atingido.');
    if(conv.messages.filter(m=>m.sender===phone.id&&now-m.at<60000).length>=20)throw Error('Limite de 20 mensagens por minuto.');
    const audience=conv.members.filter(key=>active(phones.get(key))&&isAppEnabled(phones.get(key),'messages'));
    if(audience.length<2)throw Error('Nenhum destinatário disponível.');
    const seq=(conv.sequence??conv.messages.at(-1)?.seq??0)+1;conv.sequence=seq;conv.messages.push({id:request.id,seq,sender:phone.id,senderName:phone.name,body,at:now,status:'delivered',audience});
   }else if(action==='group-edit'){
    if(!conv.group||(!user.isGM&&conv.admin!==phone.id))throw Error('Somente o administrador do grupo ou GM.');
    conv.name=txt(p.name??conv.name);conv.photo=imagePath(p.photo??conv.photo??'');
    if(p.members){const members=[...new Set(p.members.map(v=>conv.members.includes(v)?v:resolve(v).id))];if(!members.includes(conv.admin)||members.length<1||members.length>50)throw Error('Mantenha o administrador entre os participantes.');conv.members=members;conv.ever=[...new Set([...conv.ever,...members])];}
   }else if(action==='group-leave'){
    if(!conv.group)throw Error('Ação disponível somente em grupos.');conv.members=conv.members.filter(k=>k!==phone.id);if(conv.admin===phone.id)conv.admin=conv.members[0]??null;
   }else throw Error('Operação de mensagens inválida.');
  }
 }
 if(JSON.stringify(next).length>6000000)throw Error('Limite de 6 MB do histórico atingido. Nenhuma mensagem foi apagada.');
 next.revision++;next.processed[request.id]={user:user.id,at:now};return next;
}
export function messagingProjection(state,user,phones){
 const result={revision:state.revision,phones:{}};
 for(const phone of phones.values()){
  try{requireDeviceAccess(phone,user);}catch{continue;}
  const contacts=(state.contacts[phone.id]??[]).map(c=>{const {aliases,...record}=c;return {...record,name:aliases?.[user.id]??c.name};}),conversations=[];
  for(const conv of Object.values(state.conversations)){
   if(!conv.ever.includes(phone.id)||!isAppEnabled(phone,'messages'))continue;
   const messages=conv.messages.filter(m=>m.audience.includes(phone.id));
   const unread=messages.filter(m=>m.sender!==phone.id&&m.seq>(conv.read[phone.id]??0));
   const other=conv.members.find(k=>k!==phone.id),target=phones.get(other);
   const title=conv.group?conv.name:contacts.find(c=>c.number===target?.phoneNumberNormalized)?.name??target?.name??'Aparelho indisponível';
   conversations.push({id:conv.id,name:title,group:conv.group,photo:conv.photo??'',admin:conv.admin,active:conv.members.includes(phone.id),members:conv.members.map(k=>({id:k,name:phones.get(k)?.name??'Aparelho excluído',number:phones.get(k)?.phoneNumberNormalized??''})),messages:messages.map(({audience,...m})=>m),unread:unread.length,readThrough:conv.read[phone.id]??0,at:messages.at(-1)?.at??conv.createdAt,notifications:unread.map(m=>({id:m.id,phoneId:phone.id,type:'message',title, message:m.body.slice(0,120),at:new Date(m.at).toISOString(),conversation:conv.id,seq:m.seq,read:false}))});
  }
  conversations.sort((a,b)=>b.at-a.at);result.phones[phone.id]={contacts,conversations,notifications:conversations.flatMap(c=>c.notifications)};
 }
 return result;
}
export function migrateMessaging(state,phones,legacy=[]){
 if(state.legacyImported&&[...phones.keys()].every(id=>Object.hasOwn(state.contacts,id)))return state;const next=structuredClone(state);
 for(const phone of phones.values()){
  if(Object.hasOwn(next.contacts,phone.id))continue;
  if(phone.agendaCopySource&&state.contacts[phone.agendaCopySource]){next.contacts[phone.id]=structuredClone(state.contacts[phone.agendaCopySource]);continue;}
  const agenda=[];const add=(c,target,owner)=>{const number=c.phoneNumberNormalized??target?.phoneNumberNormalized??c.phoneNumber?.replace(/\D/g,'');if(!number)return;const existing=agenda.find(x=>x.number===number);if(existing){if(owner)existing.aliases[owner]=c.name||'NOME DO CONTATO';return;}
   const match=c.phoneNumber?.match(/^\+(\d+)\s*\((\d+)\)\s*([\d -]+)$/);const pp=target?{countryCode:target.countryCode??'55',areaCode:target.areaCode??target.nationalNumberNormalized?.slice(0,2),localNumber:target.localNumber??target.nationalNumberNormalized?.slice(2)}:match?{countryCode:match[1],areaCode:match[2],localNumber:match[3].replace(/\D/g,'')}:{};
   agenda.push({id:c.id,name:owner?'NOME DO CONTATO':c.name||'NOME DO CONTATO',aliases:owner?{[owner]:c.name||'NOME DO CONTATO'}:{},photo:'',number,...pp,phoneNumber:target?.phoneNumber??c.phoneNumber});};
  for(const c of phone.contacts??[])add(c,phones.get(c.id));for(const [owner,own] of Object.entries(phone.personalContacts??{}))for(const c of own)add(c,phones.get(c.id),owner);
  next.contacts[phone.id]??=agenda;
 }
 for(const m of state.legacyImported?[]:legacy){if(!phones.has(m.from)||!phones.has(m.to))continue;const key='legacy-'+[m.from,m.to].sort().join('-');const conv=next.conversations[key]??={id:key,group:false,name:'Conversa privada',members:[m.from,m.to],ever:[m.from,m.to],admin:m.from,messages:[],read:{},createdAt:m.at};if(conv.messages.some(x=>x.id===m.id))continue;conv.messages.push({id:m.id,seq:conv.messages.length+1,sender:m.from,senderName:phones.get(m.from).name,body:m.body,at:m.at,status:'delivered',audience:[m.from,m.to]});for(const k of conv.members)conv.read[k]=conv.messages.length;}
 next.legacyImported=true;next.revision++;return next;
}
