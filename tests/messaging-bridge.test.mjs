import {test} from 'node:test';import assert from 'node:assert/strict';
import {createMessagingBridge} from '../scripts/messaging-bridge.mjs';import {generateIdentity,unseal,seal} from '../scripts/messaging-crypto.mjs';import {parts} from '../scripts/phone-parts.mjs';import {ID} from '../scripts/core.mjs';
async function fixture(){
 const identities=new Map(),flags=new Map(),users=['gm','alice','bob','eve'].map(id=>({id,isGM:id==='gm',active:true,getFlag:(_,key)=>flags.get(id)?.[key],setFlag:async(_,key,value)=>{if(game.user.id!==id&&!game.user.isGM)throw Error('Native permission denied');flags.set(id,{...flags.get(id),[key]:structuredClone(value)});return value;}}));users.get=id=>users.find(u=>u.id===id);users.contents=users;
 const phones=new Map(['a','b'].map((id,i)=>[id,{id,name:id,users:[i?'bob':'alice'],contacts:[{id:i?'a':'b',name:'Contato'}],...parts({countryCode:'55',areaCode:'11',localNumber:i?'888888888':'999999999'})}]));const settings=new Map();globalThis.game={world:{id:'world1'},user:users[0],users,settings:{get:(_,key)=>structuredClone(settings.get(key)),set:async(_,key,value)=>{assert.equal(game.user.isGM,true);settings.set(key,structuredClone(value));}}};let tail=Promise.resolve();const numbering={withOperationalLock:task=>{const run=tail.then(()=>task(phones));tail=run.catch(()=>{});return run;},applyUserAction:async(_from,author,_action,payload)=>{if(author!=='alice'||payload.inject)throw Error('Recusado');}};
 const bridges=new Map();let refreshes=0;for(const user of users){identities.set(user.id,await generateIdentity());bridges.set(user.id,createMessagingBridge({numbering,isLeader:()=>game.user.id==='gm'&&users[0].active,getPhones:()=>phones,refresh:()=>refreshes++,onResult:()=>{},readVault:async()=>structuredClone(settings.get('messagingVault')),identityStore:async(_world,id)=>identities.get(id)}));}
 async function as(id,fn){game.user=users.get(id);return fn(bridges.get(id));}
 await as('gm',b=>b.start());for(const id of ['alice','bob','eve'])await as(id,b=>b.start());await as('gm',b=>b.sync());
 return {users,phones,settings,flags,identities,bridges,as,get refreshes(){return refreshes;}};
}
test('transporte nativo criptografado: offline, confirmação, reconexão, nenhum ChatMessage',async()=>{
 const f=await fixture();let chat=0;globalThis.CONFIG={ChatMessage:{documentClass:{create:()=>{chat++;throw Error('Chat proibido');}}}};
 f.users[0].active=false;const request=await f.as('alice',b=>b.request('a','send-number',{number:f.phones.get('b').phoneNumberNormalized,body:'Segredo do celular'}));assert.equal(request.pending,true);assert.ok(!JSON.stringify(f.flags.get('alice')).includes('Segredo do celular'));
 f.users[0].active=true;await f.as('gm',b=>b.sync());await f.as('bob',b=>b.updateView());const bob=f.bridges.get('bob').view;assert.equal(bob.phones.b.conversations[0].messages[0].body,'Segredo do celular');assert.equal(bob.phones.b.notifications.length,1);assert.equal(chat,0);assert.ok(!JSON.stringify(f.settings.get('messagingVault')).includes('Segredo do celular'));
 await f.as('gm',b=>b.sync());await f.as('bob',b=>b.sync());assert.equal(f.bridges.get('bob').view.phones.b.conversations[0].messages.length,1);assert.equal(f.bridges.get('eve').view.phones.a,undefined);
 const vault=f.settings.get('messagingVault');await assert.rejects(()=>unseal(vault.projections.bob,f.identities.get('eve').privateKey,'smartphone-rpg:world1:view:bob'));
});
test('transporte: autor nativo impede origem forjada, revogação durante fila e leitura alheia',async()=>{
 const f=await fixture();await assert.rejects(()=>f.as('eve',b=>b.request('a','private-open',{number:f.phones.get('b').phoneNumberNormalized})),/acesso/);
 // Eve writes only her own authenticated flags but claims Alice's phone in an encrypted envelope.
 const encrypted=await seal({id:'forged',from:'a',action:'group-create',payload:{name:'Forjado',members:['a','b']}},f.identities.get('gm').publicKey,'smartphone-rpg:world1:request:eve');f.flags.set('eve',{...f.flags.get('eve'),messagingOutbox:[{id:'forged',forGM:{gm:encrypted}}]});await f.as('gm',b=>b.sync());await f.as('eve',b=>b.updateView());assert.equal(f.bridges.get('eve').view.results.find(r=>r.requestId==='forged').success,false);
 await f.as('alice',b=>b.request('a','send-number',{number:f.phones.get('b').phoneNumberNormalized,body:'Revogada'}));f.phones.get('a').users=[];await f.as('gm',b=>b.sync());await f.as('bob',b=>b.updateView());assert.equal(f.bridges.get('bob').view.phones.b.conversations.length,0);
});
test('transporte: confirma contatos e visuais sem chat, serializa duas operações',async()=>{
 const f=await fixture();await f.as('alice',async b=>{await Promise.all([b.request('a','contact-save',{id:'b',name:'Amigo',countryCode:'55',areaCode:'11',localNumber:'888888888'}),b.request('a','visual',{action:'appearance',payload:{theme:'dark'}})]);});await f.as('gm',b=>b.sync());await f.as('alice',b=>b.updateView());assert.equal(f.bridges.get('alice').view.phones.a.contacts[0].name,'Amigo');assert.equal(f.bridges.get('alice').view.results.filter(r=>r.success).length,2);
});
test('transporte: exclusão limpa agenda e histórico; chave perdida não sobrescreve cofre',async()=>{
 const f=await fixture();await f.as('alice',b=>b.request('a','send-number',{number:f.phones.get('b').phoneNumberNormalized,body:'Apagar'}));await f.as('gm',b=>b.sync());await f.as('gm',b=>b.purgeDevice('a'));await f.as('bob',b=>b.updateView());assert.equal(f.bridges.get('bob').view.phones.b.conversations.length,0);
 const before=JSON.stringify(f.settings.get('messagingVault'));f.identities.set('gm',await generateIdentity());const other=createMessagingBridge({numbering:{},isLeader:()=>true,getPhones:()=>f.phones,refresh:()=>{},identityStore:async()=>f.identities.get('gm')});await assert.rejects(()=>other.start(),/outro navegador/);assert.equal(JSON.stringify(f.settings.get('messagingVault')),before);
});
