import {test} from 'node:test';import assert from 'node:assert/strict';
import {emptyMessaging,applyMessaging,messagingProjection,migrateMessaging} from '../scripts/messaging.mjs';
import {parts,partsOf,code} from '../scripts/phone-parts.mjs';
import {notificationCount,createPhoneBadge} from '../scripts/phone-badge.mjs';
import {renderAgenda,renderMessenger} from '../scripts/messaging-view.mjs';
import {generateIdentity,seal,unseal} from '../scripts/messaging-crypto.mjs';
const alice={id:'alice'},bob={id:'bob'},eve={id:'eve'},gm={id:'gm',isGM:true};
function fixture(){let n=0;const phones=new Map(['a','b','c','d'].map((id,i)=>[id,{id,name:'Telefone '+id,users:[i===0?'alice':i===1?'bob':i===2?'carol':'eve'],contacts:[],...parts({countryCode:'55',areaCode:'11',localNumber:'98765432'+i})}]));let state=emptyMessaging();const act=(user,from,action,payload={},requestId='request'+(++n))=>state=applyMessaging(state,user,phones,{id:requestId,from,action,payload},{now:1000+n,id:()=>String(++n)});const agenda=(from,to,name='Contato')=>act(gm,from,'contact-save',{name,...partsOf(phones.get(to))});const group=()=>{act(alice,'a','group-create',{name:'Equipe',members:['b','c']});return Object.keys(state.conversations)[0];};return {phones,act,agenda,group,get state(){return state;},view:(u)=>messagingProjection(state,u,phones)};}
test('números estruturados internacionais: zeros, diferentes DDI/DDD e limites',()=>{
 const a=parts({countryCode:'+001',areaCode:'0012',localNumber:'000-123'});assert.equal(a.phoneNumberNormalized,'0010012000123');assert.equal(a.localNumber,'000123');assert.notEqual(parts({...a,areaCode:'0013'}).phoneNumberNormalized,a.phoneNumberNormalized);assert.throws(()=>parts({...a,localNumber:'12'}));assert.throws(()=>code('x',5,'DDD'));assert.throws(()=>parts({...a,areaCode:'123456'}));
});
test('agenda por aparelho: criar desconhecido, editar, pesquisar/renderizar, duplicado e excluir',()=>{
 const f=fixture();f.act(alice,'a','contact-save',{name:'<script>Amigo</script>',countryCode:'44',areaCode:'020',localNumber:'000-1234',photo:'icons/svg/mystery-man.svg'});const contact=f.view(alice).phones.a.contacts[0];assert.equal(contact.number,'440200001234');assert.equal(f.view(bob).phones.b.contacts.length,0);
 assert.throws(()=>f.act(alice,'a','contact-save',{...partsOf(contact),name:'Duplicado'}),/salvo/);f.act(alice,'a','contact-save',{id:contact.id,...partsOf(contact),name:'Novo nome',photo:''});assert.equal(f.view(alice).phones.a.contacts.length,1);
 const html=renderAgenda(f.view(alice).phones.a.contacts,{countryCode:'55',areaCode:'11'},{editing:true,query:'Novo'});assert.ok(html.includes('Adicionar contato'));assert.ok(html.includes('Cancelar'));f.act(alice,'a','contact-delete',{id:contact.id});assert.equal(f.view(alice).phones.a.contacts.length,0);
});
test('agenda acompanha transferência, permite GM, recusa outro usuário e desconhecido não entrega',()=>{
 const f=fixture();f.agenda('a','b','Amigo');assert.throws(()=>f.act(eve,'a','contact-delete',{id:'b'}));f.phones.get('a').users=['bob'];assert.equal(f.view(bob).phones.a.contacts[0].name,'Amigo');assert.equal(f.view(alice).phones.a,undefined);
 f.act(bob,'a','contact-save',{name:'Ausente',countryCode:'99',areaCode:'1',localNumber:'123'});assert.throws(()=>f.act(bob,'a','private-open',{number:'991123'}),/destinatário/);assert.equal(Object.keys(f.state.conversations).length,0);
});
test('privado: balões, remetente, histórico persistente, leitura e resposta sem agenda recíproca',()=>{
 const f=fixture();f.agenda('a','b');f.act(alice,'a','send-number',{number:f.phones.get('b').phoneNumberNormalized,body:'Olá'});const conv=Object.values(f.state.conversations)[0];assert.equal(conv.messages[0].sender,'a');assert.equal(f.view(bob).phones.b.notifications.length,1);f.act(bob,'b','read',{conversation:conv.id,through:1});assert.equal(f.view(bob).phones.b.notifications.length,0);
 f.act(bob,'b','message-send',{conversation:conv.id,body:'Resposta'});assert.equal(conv.messages.length,1);assert.equal(f.view(alice).phones.a.conversations[0].messages.length,2);assert.equal(f.view(alice).phones.a.notifications.length,1);
 const state=JSON.parse(JSON.stringify(f.state)),reloaded=messagingProjection(state,bob,f.phones);assert.equal(reloaded.phones.b.conversations[0].messages[1].body,'Resposta');assert.ok(renderMessenger(reloaded.phones.b,conv.id,f.phones.get('b')).includes('srpg-bubble'));
});
test('grupo: três aparelhos com NPC, criador administrador e entrega idempotente',()=>{
 const f=fixture();f.phones.get('c').actorUuid='Actor.npc';const id=f.group();assert.deepEqual(f.state.conversations[id].members,['a','b','c']);f.act(alice,'a','message-send',{conversation:id,body:'Equipe!'},'same');f.act(alice,'a','message-send',{conversation:id,body:'Equipe!'},'same');assert.equal(f.state.conversations[id].messages.length,1);assert.equal(f.view(bob).phones.b.notifications.length,1);assert.equal(f.view(gm).phones.c.notifications.length,1);assert.equal(f.view(eve).phones.d.conversations.length,0);
 f.act(gm,'c','message-send',{conversation:id,body:'NPC respondeu'});assert.equal(f.view(alice).phones.a.conversations[0].messages.at(-1).sender,'c');
});
test('grupo: administrador edita, membro comum não; remoção e entrada sem retroativo',()=>{
 const f=fixture(),id=f.group();f.act(alice,'a','message-send',{conversation:id,body:'Antes'});assert.throws(()=>f.act(bob,'b','group-edit',{conversation:id,name:'Invadido'}),/administrador/);
 f.act(alice,'a','group-edit',{conversation:id,name:'Nova equipe',members:['a','b','d']});f.act(alice,'a','message-send',{conversation:id,body:'Depois'});
 assert.deepEqual(f.view(eve).phones.d.conversations[0].messages.map(m=>m.body),['Depois']);assert.deepEqual(f.view(gm).phones.c.conversations[0].messages.map(m=>m.body),['Antes']);assert.throws(()=>f.act(gm,'c','message-send',{conversation:id,body:'Não'}),/participa/);
 f.act(bob,'b','group-leave',{conversation:id});assert.equal(f.view(bob).phones.b.conversations[0].active,false);f.act(alice,'a','group-leave',{conversation:id});assert.equal(f.state.conversations[id].admin,'d');
});
test('segurança: sem acesso, app desabilitado, aparelho arquivado e leitura alheia',()=>{
 const f=fixture(),id=f.group();assert.throws(()=>f.act(eve,'a','message-send',{conversation:id,body:'Forjado'}));assert.throws(()=>f.act(eve,'d','read',{conversation:id,through:100}));f.phones.get('a').enabledApps=['contacts'];assert.throws(()=>f.act(alice,'a','message-send',{conversation:id,body:'Bloqueado'}));f.phones.get('b').archived=true;assert.equal(f.view(bob).phones.b,undefined);assert.throws(()=>f.act(bob,'b','message-send',{conversation:id,body:'Arquivado'}));
});
test('notificações: múltiplos aparelhos, contagem sem duplicatas, zero e 99+',()=>{
 const f=fixture(),id=f.group();f.phones.get('c').users=['bob'];f.act(alice,'a','message-send',{conversation:id,body:'Nova'});assert.equal(notificationCount(f.view(bob),['b','c']),2);assert.equal(notificationCount(f.view(bob),['b','b']),1);f.act(bob,'b','read',{conversation:id,through:1});assert.equal(notificationCount(f.view(bob),['b','c']),1);
});
test('badge real: recebimento com janela fechada, vibração transitória e movimento reduzido',()=>{
 let view={phones:{b:{notifications:[]}}},badge,button={classList:{add:k=>button.ring=k,remove:()=>button.ring=null},querySelector:()=>badge,append:n=>badge=n,setAttribute:()=>{},offsetWidth:1};globalThis.document={querySelector:()=>button,createElement:()=>({setAttribute:()=>{}})};let reduced=false;globalThis.matchMedia=()=>({matches:reduced});const update=createPhoneBadge({getView:()=>view,getIds:()=>['b']});update();assert.equal(badge.hidden,true);view.phones.b.notifications=[{id:'m1'}];update();assert.equal(badge.textContent,'1');assert.equal(button.ring,'srpg-tool-ring');reduced=true;button.ring=null;view.phones.b.notifications.push({id:'m2'});update();assert.equal(button.ring,null);view.phones.b.notifications=Array.from({length:101},(_,i)=>({id:String(i)}));update();assert.equal(badge.textContent,'99+');
});
test('migração de agenda/histórico é idempotente e preserva dados de aparelhos',()=>{
 const f=fixture();f.phones.get('a').contacts=[{id:'b',name:'Nome antigo'}];const before=JSON.stringify([...f.phones]);const state=migrateMessaging(emptyMessaging(),f.phones,[{id:'old1',from:'a',to:'b',body:'Antiga',at:1}]);assert.equal(state.contacts.a[0].name,'Nome antigo');assert.equal(Object.values(state.conversations)[0].messages[0].body,'Antiga');assert.equal(migrateMessaging(state,f.phones),state);assert.equal(JSON.stringify([...f.phones]),before);
});
test('criptografia real: só destinatário abre, adulteração e outro contexto são recusados',async()=>{
 const a=await generateIdentity(),b=await generateIdentity(),envelope=await seal({body:'Segredo'},a.publicKey,'world:view:a');assert.ok(!JSON.stringify(envelope).includes('Segredo'));assert.deepEqual(await unseal(envelope,a.privateKey,'world:view:a'),{body:'Segredo'});await assert.rejects(()=>unseal(envelope,b.privateKey,'world:view:a'));await assert.rejects(()=>unseal(envelope,a.privateKey,'other-world:view:a'));await assert.rejects(()=>unseal({...envelope,data:envelope.data.slice(0,-8)+'AAAAAAAA'},a.privateKey,'world:view:a'));assert.equal(a.privateKey.extractable,false);
});
test('agenda compartilhada do aparelho mantém apelidos pessoais isolados e acompanha transferência',()=>{
 const f=fixture();f.phones.get('a').users=['alice','bob'];f.act(alice,'a','contact-save',{name:'Amigo',countryCode:'55',areaCode:'11',localNumber:'987654321'});const contact=f.view(alice).phones.a.contacts[0];assert.equal(contact.name,'Amigo');assert.equal(f.view(bob).phones.a.contacts[0].name,'NOME DO CONTATO');f.act(bob,'a','contact-save',{id:contact.id,name:'Chefe',countryCode:'55',areaCode:'11',localNumber:'987654321'});assert.equal(f.view(alice).phones.a.contacts[0].name,'Amigo');assert.equal(f.view(bob).phones.a.contacts[0].name,'Chefe');assert.equal(f.view(bob).phones.a.contacts[0].aliases,undefined);
});
test('migração de agenda em duplicação copia contatos sem compartilhar arrays ou histórico',()=>{
 const f=fixture();f.agenda('a','b','Pessoal');const migrated=migrateMessaging(f.state,f.phones);const clone={...f.phones.get('a'),id:'copy',agendaCopySource:'a'};f.phones.set('copy',clone);const next=migrateMessaging(migrated,f.phones);assert.deepEqual(next.contacts.copy,next.contacts.a);next.contacts.copy[0].name='Mudou';assert.equal(next.contacts.a[0].name,'Pessoal');assert.equal(messagingProjection(next,alice,f.phones).phones.copy.conversations.length,0);
});
