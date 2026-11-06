import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {normalizeNumber,formatNumber,allocateNumber} from '../scripts/numbering.mjs';
import {createFoundryNumbering,LOCK_ID} from '../scripts/foundry-numbering.mjs';
import {layoutFor,moveApp,requireApp} from '../scripts/apps.mjs';
import {DEFAULT_APPEARANCE} from '../scripts/presentation.mjs';
const ID='smartphone-rpg', clone=value=>structuredClone(value);
class Collection extends Array {get(id){return this.find(x=>x.id===id)}has(id){return !!this.get(id)}}
function fixture(snapshot) {
  let next=0;
  const state=snapshot??{docs:{control:{_id:'control',name:'Controle',pages:[],ownership:{default:0,gm:3},flags:{[ID]:{numberLockAnchor:true,data:{kind:'number-ledger'}}}}},settings:{devices:[],numberLockParent:'control',numberPattern:'119########'}};
  const readFlag=(data,key)=>data.flags?.[ID]?.[key];
  function assign(target,key,value){const parts=key.split('.');let at=target;for(const part of parts.slice(0,-1)) at=at[part]??={};const last=parts.at(-1);if(value instanceof foundry.data.operators.ForcedDeletion)delete at[last];else at[last]=clone(value);}
  class Doc {
    constructor(data){Object.assign(this,clone(data));this.id=this._id;}
    getFlag(_,key){return readFlag(this,key)}
    toObject(){const {_id,name,flags,pages,ownership,_stats}=this;return clone({_id,name,flags,pages,ownership,_stats});}
    async update(patch){patch._id=this.id;await new Promise(resolve=>setImmediate(resolve));for(const [key,value]of Object.entries(patch))assign(state.docs[this.id],key,value);return new Doc(state.docs[this.id]);}
    async setFlag(_,key,value){return this.update({[`flags.${ID}.${key}`]:value})}
    async unsetFlag(_,key){delete state.docs[this.id].flags[ID][key];return new Doc(state.docs[this.id]);}
    async delete(){delete state.docs[this.id];return this;}
    async createEmbeddedDocuments(_,pages,options){
      assert.equal(options.keepId,true);
      await new Promise(resolve=>setImmediate(resolve));
      const stored=state.docs[this.id];
      // Emulate the v14 server's serialized embedded-collection ID check.
      for(const page of pages)if(stored.pages.some(p=>p._id===page._id))throw Error('embedded _id already exists');
      stored.pages.push(...clone(pages));return pages.map(p=>({...p,id:p._id,delete:async()=>{stored.pages=stored.pages.filter(existing=>existing._id!==p._id);}}));
    }
    async deleteEmbeddedDocuments(_,ids){for(const id of ids)if(!this.pages.some(p=>p._id===id))throw Error(`undefined id [${id}] does not exist in the EmbeddedCollection collection.`);state.docs[this.id].pages=state.docs[this.id].pages.filter(p=>!ids.includes(p._id));}
  }
  const Journal={database:{get:async()=>Object.values(state.docs).map(d=>new Doc(d))},create:async input=>{
    let id;do{id='new'+(++next)}while(state.docs[id]);
    state.docs[id]={...clone(input),_id:id,pages:[],_stats:{createdBy:'gm'}};return new Doc(state.docs[id]);
  }};
  globalThis.game={world:{id:'test'},user:{id:'gm',isGM:true,active:true},users:Collection.from([{id:'gm',isGM:true,active:true},{id:'alice',isGM:false}]),actors:Collection.from(['superhero','npc','vehicle','challenge','minions'].map((type,index)=>({id:`actor${index+1}`,uuid:`Actor.actor${index+1}`,name:`Personagem ${index+1}`,img:'icons/svg/mystery-man.svg',type}))),settings:{get:(_,key)=>clone(state.settings[key]),set:async(_,key,value)=>{state.settings[key]=clone(value);return value}}};
  game.journal={get:id=>state.docs[id]?new Doc(state.docs[id]):undefined};
  globalThis.foundry={documents:{JournalEntry:Journal},data:{operators:{ForcedDeletion:class{}}},utils:{deepClone:clone,equals:(a,b)=>JSON.stringify(a)===JSON.stringify(b),randomID:()=>Math.random().toString(36).slice(2)}};
  globalThis.CONFIG={Setting:{documentClass:{database:{get:async(_,{query})=>{const value=state.settings[query.key.slice(ID.length+1)];return value===undefined?[]:[{value:clone(value)}]}}}}};
  state.messages??={};
  class Message {
    constructor(data){Object.assign(this,clone(data));this.id=this._id;}
    getFlag(_,key){return readFlag(this,key)}
    async delete(){delete state.messages[this.id];return this;}
  }
  CONFIG.ChatMessage={documentClass:{database:{get:async()=>Object.values(state.messages).map(data=>new Message(data))}}};
  const events=[];globalThis.Hooks={callAll:(...args)=>events.push(args)};
  const service=createFoundryNumbering({isLeader:()=>true});
  const phones=()=>Object.values(state.docs).filter(d=>readFlag(d,'data')?.kind==='phone');
  const data=doc=>doc.flags[ID].data;
  const create=phoneNumber=>service.save(null,{name:'Pessoal',actorId:'actor1',users:['alice'],contacts:[],phoneNumber});
  return {state,service,phones,data,create,Journal,Message,Doc,events};
}

test('visual: GM valida layout do jogador, persiste por aparelho e transferência não altera configurações',async()=>{
  const f=fixture(),first=await f.create('11999999999'),second=await f.create('21999999999');
  const layout=moveApp(layoutFor(f.data(first)),'messages',10);
  const saved=await f.service.applyUserAction(first.id,'alice','layout',{layout},'req-layout');
  assert.deepEqual(f.data(saved).appLayout,layout);assert.equal(f.data(f.state.docs[second.id]).appLayout,undefined);
  await f.service.setActorLink(first.id,'Actor.actor2');assert.deepEqual(f.data(f.state.docs[first.id]).appLayout,layout);
  const reloaded=fixture(JSON.parse(JSON.stringify(f.state)));
  assert.deepEqual(reloaded.data(reloaded.state.docs[first.id]).appLayout,layout);assert.equal(reloaded.data(reloaded.state.docs[first.id]).phoneNumberNormalized,f.data(first).phoneNumberNormalized);
});
test('visual: dois usuários autorizados compartilham o layout e entrada manipulada é recusada',async()=>{
  const f=fixture(),doc=await f.create('11999999999');game.users.push({id:'bob',isGM:false});
  await f.service.save(doc.id,{users:['alice','bob']});
  const layout=moveApp(layoutFor(f.data(doc)),'contacts',11);
  await f.service.applyUserAction(doc.id,'bob','layout',{layout});
  assert.deepEqual(f.data(f.state.docs[doc.id]).appLayout,layout);
  const before=clone(f.state.docs[doc.id]);
  for(const [action,payload]of [['layout',{layout:[...layout.slice(0,3),'contacts',...layout.slice(4)]}],['layout',{layout,users:['eve']}],['appearance',{...DEFAULT_APPEARANCE,enabledApps:['calls']}],['enableApps',{enabledApps:['calls']}]])await assert.rejects(()=>f.service.applyUserAction(doc.id,'alice',action,payload));
  assert.deepEqual(f.state.docs[doc.id],before);
  await f.service.save(doc.id,{users:[]});await assert.rejects(()=>f.service.applyUserAction(doc.id,'alice','layout',{layout}),/acesso/);
});
test('visual: personalização salva ambos os papéis, cores e tema sem alterar dados administrativos',async()=>{
  const f=fixture(),doc=await f.create('11999999999');
  const value={...DEFAULT_APPEARANCE,primaryColor:'#223344',accentColor:'#ff8844',theme:'light',homeWallpaper:'assets/home.png',lockWallpaper:'assets/lock.webp'};
  const saved=await f.service.applyUserAction(doc.id,'alice','appearance',value,'visual-1');
  assert.deepEqual(f.data(saved).personalization,value);assert.equal(saved.id,doc.id);assert.equal(f.data(saved).phoneNumberNormalized,f.data(doc).phoneNumberNormalized);assert.deepEqual(f.data(saved).users,['alice']);
  const count=Object.keys(f.state.docs).length;await f.service.applyUserAction(doc.id,'alice','appearance',value,'visual-1');assert.equal(Object.keys(f.state.docs).length,count);
  await f.service.setArchived(doc.id,true);await assert.rejects(()=>f.service.applyUserAction(doc.id,'alice','appearance',value),/acesso/);
  const restored=await f.service.setArchived(doc.id,false);assert.deepEqual(f.data(restored).personalization,value);
  await f.service.applyUserAction(doc.id,'alice','appearance',{...DEFAULT_APPEARANCE});assert.deepEqual(f.data(f.state.docs[doc.id]).personalization,DEFAULT_APPEARANCE);
});
test('apps: só GM altera disponibilidade, seleção persiste e apps desabilitados são recusados',async()=>{
  const f=fixture(),doc=await f.create('11999999999');
  const saved=await f.service.save(doc.id,{enabledApps:['contacts']});assert.deepEqual(f.data(saved).enabledApps,['contacts','personalization']);
  assert.throws(()=>requireApp({...f.data(saved),id:doc.id},game.users.get('alice'),'messages'),/desabilitado/);
  assert.throws(()=>requireApp(f.data(saved),game.user,'calendar'),/desabilitado/);
  game.user=game.users.get('alice');await assert.rejects(()=>f.service.save(doc.id,{enabledApps:['messages']}),/Somente/);
  await assert.rejects(()=>f.service.applyUserAction(doc.id,'alice','appearance',DEFAULT_APPEARANCE),/Somente o GM/);
  game.user=game.users.get('gm');await assert.rejects(()=>f.service.save(doc.id,{enabledApps:['forged']}),/inválida/);
});
test('notificações: GM adiciona registros reais e leitura é persistida por usuário',async()=>{
  const f=fixture(),doc=await f.create('11999999999');
  const saved=await f.service.addNotification(doc.id,{title:'Aviso',message:'Teste de integração',source:'test'}),note=f.data(saved).notifications[0];
  await f.service.applyUserAction(doc.id,'alice','notification-read',{id:note.id},'read-1');
  game.user=game.users.get('alice');assert.equal(f.service.listNotifications(doc.id)[0].read,true);
  await assert.rejects(()=>f.service.addNotification(doc.id,{title:'forjado',message:'x'}),/Somente/);
  game.user={id:'eve',isGM:false};assert.throws(()=>f.service.listNotifications(doc.id),/acesso/);
});
test('relógio do mundo: inicialização é única e a âncora sobrevive à reconstrução da sessão',async()=>{
  const f=fixture();const first=await f.service.initializeClock(),second=await f.service.initializeClock();assert.deepEqual(second,first);
  const reloaded=fixture(JSON.parse(JSON.stringify(f.state)));assert.deepEqual(await reloaded.service.initializeClock(),first);
  game.user=game.users.get('alice');await assert.rejects(()=>reloaded.service.initializeClock(),/Somente/);
});
test('layout: duplicação recebe grade própria sem propagar organização automaticamente',async()=>{
  const f=fixture(),doc=await f.create('11999999999');const layout=moveApp(layoutFor(f.data(doc)),'messages',11);
  await f.service.applyUserAction(doc.id,'alice','layout',{layout});
  const copy=await f.service.duplicate(doc.id);assert.equal(f.data(copy).appLayout,undefined);assert.notDeepEqual(layoutFor(f.data(copy)),layout);
  assert.deepEqual(f.data(f.state.docs[doc.id]).appLayout,layout);
});

test('arquivo: metadado _id acrescentado por Document.update não faz parte dos flags verificados',async()=>{
  const f=fixture(),doc=await f.create('11999999999');
  const archived=await f.service.setArchived(doc.id,true);
  assert.equal(archived.id,doc.id);assert.equal(f.data(archived).archived,true);
  const restored=await f.service.setArchived(doc.id,false);
  assert.equal(restored.id,doc.id);assert.equal(f.data(restored).archived,false);
  assert.equal(f.data(restored).phoneNumberNormalized,f.data(doc).phoneNumberNormalized);
});

test('inicialização: migrações e mensagens do mesmo cliente aguardam a gravação atual',async()=>{
  const f=fixture();let release,entered;
  const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
  const create=f.Journal.create;
  f.Journal.create=async input=>{if(input.flags?.[ID]?.data?.kind==='phone'){entered();await gate;}return create(input);};
  const writing=f.create('11999999999');await started;
  let delivered=false;
  const all=Promise.allSettled([writing,f.service.migrate(),f.service.migrateActors(),f.service.withOperationalLock(async()=>{delivered=true;})]);
  await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
  release();const results=await all;
  assert.equal(results.filter(result=>result.status==='fulfilled').length,4);
  assert.equal(delivered,true);assert.equal(f.state.docs.control.pages.length,0);
});

test('exclusão: ativo vinculado é removido com dados associados, sem alterar Actor/outros aparelhos',async()=>{
  const f=fixture(),phone=await f.create('11999999999'),other=await f.create('21999999999');
  Object.assign(f.data(f.state.docs[phone.id]),{pin:'SEGREDO-PIN',history:['HISTORICO-PRIVADO'],sessions:['session']});
  await f.service.save(phone.id,{name:'Pessoal'});
  const others=clone(f.state.docs[other.id]),actors=clone([...game.actors]);
  const message=(id,data)=>{f.state.messages[id]={_id:id,flags:{[ID]:{data}},content:'privado'};};
  message('request',{kind:'request',from:phone.id,to:other.id});
  message('delivery',{kind:'delivery',requestId:'request',from:phone.id,to:other.id});
  message('rejected',{kind:'rejected',requestId:'request'});
  message('unrelated',{kind:'delivery',from:other.id,to:'third'});
  assert.equal(await f.service.deletePhone(phone.id,'Pessoal'),true);
  assert.equal(f.state.docs[phone.id],undefined);assert.ok(!f.state.settings.devices.includes(phone.id));
  assert.deepEqual(f.state.docs[other.id],others);assert.deepEqual([...game.actors],actors);
  assert.deepEqual(Object.keys(f.state.messages),['unrelated']);
  assert.ok(!Object.values(f.state.docs).some(doc=>f.data(doc)?.kind==='backup'&&f.data(doc).source===phone.id));
  const ledger=await f.service.inspectIntegrity(),entry=ledger.audit.find(e=>e.operation==='delete');
  for(const key of ['operation','deviceId','name','number','userId','at','result']) assert.ok(Object.hasOwn(entry,key));
  assert.equal(entry.result,'success');assert.equal(entry.deviceId,phone.id);assert.equal(entry.userId,'gm');
  assert.ok(ledger.retiredIds.includes(phone.id));
  assert.ok(!JSON.stringify(ledger).includes('SEGREDO-PIN'));assert.ok(!JSON.stringify(ledger).includes('HISTORICO-PRIVADO'));
  assert.ok(f.events.some(([event,data])=>event==='smartphoneRPGDeviceDeleted'&&data.id===phone.id));
  await assert.rejects(()=>f.service.deletePhone(phone.id,'Pessoal'),/já excluído/);
  assert.equal((await f.create('11999999999')).id!==phone.id,true);
});

test('exclusão: arquivado removido e persistência simulada após reconstruir a sessão',async()=>{
  const f=fixture(),doc=await f.create('11999999999');await f.service.setArchived(doc.id,true);
  await f.service.deletePhone(doc.id,'Pessoal');
  const reloaded=fixture(JSON.parse(JSON.stringify(f.state)));
  assert.equal(reloaded.phones().length,0);assert.ok(!reloaded.state.settings.devices.includes(doc.id));
  assert.ok((await reloaded.service.inspectIntegrity()).retiredIds.includes(doc.id));
  const created=await reloaded.create('11999999999');assert.notEqual(created.id,doc.id);
});

test('exclusão: nome incorreto e jogador não alteram armazenamento',async()=>{
  const f=fixture(),doc=await f.create('11999999999'),before=clone(f.state);
  await assert.rejects(()=>f.service.deletePhone(doc.id,'errado'),/não corresponde/);
  assert.deepEqual(f.state,before);
  game.user={id:'alice',isGM:false};
  for(const action of [()=>f.service.deletePhone(doc.id,'Pessoal'),()=>f.service.resumeDeletions(),()=>f.service.inspectIntegrity()]) await assert.rejects(action,/Somente/);
  assert.deepEqual(f.state,before);
});

test('exclusão: falha na limpeza bloqueia uso e edição e pode ser retomada sem dados privados no log',async()=>{
  const f=fixture(),doc=await f.create('11999999999');
  f.state.messages.bad={_id:'bad',flags:{[ID]:{data:{kind:'request',from:doc.id,to:'other'}}}};
  const remove=f.Message.prototype.delete;f.Message.prototype.delete=async()=>{throw Error('falha simulada');};
  await assert.rejects(()=>f.service.deletePhone(doc.id,'Pessoal'),/interrompida.*associated-data/);
  assert.equal(f.data(f.state.docs[doc.id]).deletionPending,true);
  assert.deepEqual(f.state.docs[doc.id].ownership,{default:0,gm:3,alice:0});
  await assert.rejects(()=>f.service.save(doc.id,{name:'Editado'}),/em exclusão/);
  await assert.rejects(()=>f.service.duplicate(doc.id),/em exclusão/);
  const ledger=await f.service.inspectIntegrity();assert.equal(ledger.deletions[doc.id].result,'pending');
  assert.equal(ledger.deletions[doc.id].stage,'associated-data');assert.equal(ledger.audit.at(-1).result,'failed');
  f.Message.prototype.delete=remove;
  const reloaded=fixture(clone(f.state));assert.equal(await reloaded.service.resumeDeletions(),1);
  assert.equal(reloaded.phones().length,0);assert.deepEqual(reloaded.state.messages,{});
  assert.equal(await reloaded.service.resumeDeletions(),0);
});

test('exclusão: falha após apagar o diário é diagnosticada e retomada sem recriar aparelho',async()=>{
  const f=fixture(),doc=await f.create('11999999999');
  const set=game.settings.set;let failed=false;
  game.settings.set=async(ns,key,value)=>{if(key==='devices'&&!value.includes(doc.id)&&!failed){failed=true;throw Error('setting indisponível');}return set(ns,key,value);};
  await assert.rejects(()=>f.service.deletePhone(doc.id,'Pessoal'),/interrompida.*registry/);
  assert.equal(f.state.docs[doc.id],undefined);assert.ok(f.state.settings.devices.includes(doc.id));
  game.settings.set=set;
  assert.equal(await f.service.resumeDeletions(),1);assert.ok(!f.state.settings.devices.includes(doc.id));
  assert.equal((await f.service.inspectIntegrity()).deletions[doc.id].result,'success');
});

test('exclusão: falha no registro inicial não começa a apagar ou desativar',async()=>{
  const f=fixture(),doc=await f.create('11999999999'),before=clone(f.state);
  const setFlag=f.Doc.prototype.setFlag;
  f.Doc.prototype.setFlag=async function(ns,key,value){if(key==='lifecycle') throw Error('auditoria indisponível');return setFlag.call(this,ns,key,value);};
  await assert.rejects(()=>f.service.deletePhone(doc.id,'Pessoal'),/auditoria indisponível/);
  assert.deepEqual(f.state,before);
});

test('exclusão: falha na confirmação final da auditoria mantém diagnóstico e permite retomada',async()=>{
  const f=fixture(),doc=await f.create('11999999999');
  const setFlag=f.Doc.prototype.setFlag;let failed=false;
  f.Doc.prototype.setFlag=async function(ns,key,value){
    if(key==='lifecycle'&&value.deletions[doc.id]?.result==='success'&&!failed){failed=true;throw Error('commit indisponível');}
    return setFlag.call(this,ns,key,value);
  };
  await assert.rejects(()=>f.service.deletePhone(doc.id,'Pessoal'),/interrompida/);
  assert.equal(f.state.docs[doc.id],undefined);
  assert.equal((await f.service.inspectIntegrity()).deletions[doc.id].result,'pending');
  assert.equal(await f.service.resumeDeletions(),1);
  assert.equal((await f.service.inspectIntegrity()).deletions[doc.id].result,'success');
});

test('auditoria: diário exclusivo de GM não contém configurações, PIN nem sessões',async()=>{
  const f=fixture(),doc=await f.create('11999999999');
  Object.assign(f.data(f.state.docs[doc.id]),{pin:'PIN-PRIVADO',sessions:['TOKEN-PRIVADO']});
  await f.service.save(doc.id,{name:'Editado'});
  const ledger=Object.values(f.state.docs).find(doc=>doc.flags[ID].lifecycleLedger);
  assert.deepEqual(ledger.ownership,{default:0,gm:3,alice:0});
  assert.ok(!JSON.stringify(ledger).includes('PIN-PRIVADO'));assert.ok(!JSON.stringify(ledger).includes('TOKEN-PRIVADO'));
  ledger.ownership.alice=2;
  await assert.rejects(()=>f.service.save(doc.id,{name:'Não gravar'}),/exclusivo dos GMs/);
  assert.equal(f.state.docs[doc.id].name,'Editado');
});

test('exclusão: aparelho que hospeda o bloqueio perde dados sem quebrar a numeração',async()=>{
  const f=fixture(),doc=await f.create('11999999999');
  f.state.docs[doc.id].flags[ID].numberLockAnchor=true;
  f.data(f.state.docs[doc.id]).pin='PIN-DO-ANTIGO';
  delete f.state.docs.control;f.state.settings.numberLockParent=doc.id;
  await f.service.deletePhone(doc.id,'Pessoal');
  const ledger=f.state.docs[doc.id];assert.equal(f.data(ledger),undefined);
  assert.equal(ledger.flags[ID].numberLockAnchor,true);assert.equal(ledger.pages.length,0);
  assert.deepEqual(ledger.ownership,{default:0,gm:3,alice:0});assert.ok(!JSON.stringify(ledger).includes('PIN-DO-ANTIGO'));
  assert.equal(f.phones().length,0);
  const created=await f.create('21999999999');assert.notEqual(created.id,doc.id);assert.equal(f.phones().length,1);
});

test('restauração: dados inválidos e números em conflito são recusados sem alterar arquivo',async()=>{
  const f=fixture(),one=await f.create('11999999999'),two=await f.create('21999999999');
  await f.service.setArchived(one.id,true);
  Object.assign(f.data(f.state.docs[two.id]),{phoneNumber:f.data(one).phoneNumber,phoneNumberNormalized:f.data(one).phoneNumberNormalized,nationalNumberNormalized:f.data(one).nationalNumberNormalized});
  const before=clone(f.state);
  await assert.rejects(()=>f.service.setArchived(one.id,false),/duplicados/);assert.deepEqual(f.state,before);
  const other=f.data(f.state.docs[two.id]);Object.assign(other,{phoneNumber:f.data(two).phoneNumber,phoneNumberNormalized:f.data(two).phoneNumberNormalized,nationalNumberNormalized:f.data(two).nationalNumberNormalized});
  f.data(f.state.docs[one.id]).users='invalid';
  await assert.rejects(()=>f.service.setArchived(one.id,false),/inválidos/);assert.equal(f.data(f.state.docs[one.id]).archived,true);
});

test('restauração: gravação vetada não informa sucesso nem muda o ID ou a situação',async()=>{
  const f=fixture(),doc=await f.create('11999999999');await f.service.setArchived(doc.id,true);
  const update=f.Doc.prototype.update;
  f.Doc.prototype.update=async function(patch){if(this.id===doc.id&&patch[`flags.${ID}.data.archived`]===false)return undefined;return update.call(this,patch);};
  await assert.rejects(()=>f.service.setArchived(doc.id,false),/armazenamento não confirmou/);
  assert.equal(f.data(f.state.docs[doc.id]).archived,true);assert.equal(f.state.docs[doc.id]._id,doc.id);
  assert.equal((await f.service.inspectIntegrity()).audit.at(-1).result,'failed');
});

test('exclusão: veto no armazenamento não é tratado como exclusão concluída',async()=>{
  const f=fixture(),doc=await f.create('11999999999');
  const remove=f.Doc.prototype.delete;
  f.Doc.prototype.delete=async function(){if(this.id===doc.id)return undefined;return remove.call(this);};
  await assert.rejects(()=>f.service.deletePhone(doc.id,'Pessoal'),/interrompida.*verify/);
  assert.ok(f.state.docs[doc.id]);assert.equal((await f.service.inspectIntegrity()).deletions[doc.id].result,'pending');
  f.Doc.prototype.delete=remove;assert.equal(await f.service.resumeDeletions(),1);assert.equal(f.state.docs[doc.id],undefined);
});

test('restauração: permissões revogadas e sessões antigas não são reativadas',async()=>{
  const f=fixture(),doc=await f.create('11999999999');
  Object.assign(f.data(f.state.docs[doc.id]),{sessions:['old'],unlockSessions:{alice:true},unlockedUsers:['alice'],unlockTokens:{alice:'token'},pin:{hash:'keep'},personalization:{theme:'red'}});
  await f.service.setArchived(doc.id,true);await f.service.save(doc.id,{users:[],disabled:true});
  // Even obsolete imported session data must not come back on restore.
  f.data(f.state.docs[doc.id]).sessions=['imported-old'];
  const restored=await f.service.setArchived(doc.id,false),data=f.data(restored);
  assert.equal(restored.id,doc.id);assert.equal(data.phoneNumberNormalized,f.data(doc).phoneNumberNormalized);
  assert.equal(data.actorUuid,'Actor.actor1');assert.equal(data.disabled,true);assert.deepEqual(data.users,[]);
  assert.deepEqual(restored.ownership,{default:0,gm:3,alice:0});assert.deepEqual(data.sessions,[]);assert.equal(data.unlockSessions,undefined);
  assert.deepEqual(data.unlockedUsers,[]);assert.equal(data.unlockTokens,undefined);assert.deepEqual(data.pin,{hash:'keep'});assert.equal(data.personalization.theme,'red');
});

test('IDs: edição, número, Actor, permissões, arquivo e restauração mantêm o ID; payloads falsos falham',async()=>{
  const f=fixture(),doc=await f.create('11999999999');
  for(const input of [{name:'Renomeado'},{phoneNumber:'31999999999'},{users:[],calendar:true},{disabled:true}]) assert.equal((await f.service.save(doc.id,input)).id,doc.id);
  for(const uuid of ['Actor.actor2',null,'Actor.actor1']) assert.equal((await f.service.setActorLink(doc.id,uuid)).id,doc.id);
  assert.equal((await f.service.setArchived(doc.id,true)).id,doc.id);assert.equal((await f.service.setArchived(doc.id,false)).id,doc.id);
  assert.notEqual((await f.service.duplicate(doc.id)).id,doc.id);
  const before=clone(f.state);
  for(const input of [{id:'forced'},{_id:'forced'},{deviceId:'forced'},{'flags.smartphone-rpg.data._id':'forced'},{data:{_id:'forced'}}]) await assert.rejects(()=>f.service.save(doc.id,input),/não podem/);
  assert.deepEqual(f.state,before);
  f.state.settings.devices.push(doc.id);await assert.rejects(()=>f.service.inspectIntegrity(),/IDs duplicados/);
});

test('exclusão concorrente: um salvamento falha por ocupação e o excluído não reaparece',async()=>{
  const f=fixture(),doc=await f.create('11999999999');let release,entered;
  const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{entered=r;});
  const remove=f.Doc.prototype.delete;
  f.Doc.prototype.delete=async function(){if(this.id===doc.id){entered();await gate;}return remove.call(this);};
  const deleting=f.service.deletePhone(doc.id,'Pessoal');await started;
  const other=createFoundryNumbering({isLeader:()=>true});
  await assert.rejects(()=>other.save(doc.id,{name:'Conflito'}),/ocupada/);release();await deleting;
  await assert.rejects(()=>other.save(doc.id,{name:'Não ressuscitar'}),/não encontrado/);
  assert.equal(f.phones().length,0);
});

test('gerenciador: cópia integral preserva configurações e dados com ID/número novos',async()=>{
  const f=fixture();const original=await f.create('11999999999');
  const data=f.data(f.state.docs[original.id]);
  Object.assign(data,{pin:{hash:'secret'},credentials:{token:'secret'},personalization:{theme:'dark',wallpaper:'x',session:'secret'},history:['past'],sessions:['secret'],audit:['past'],archiveAudit:['past'],calls:['past'],contacts:[{id:'other',name:'Contato personalizado',custom:{color:'red'}}],disabled:true,permissions:{calendar:true,customApp:true},custom:{nested:{value:42}}});
  const before=clone(f.state.docs[original.id]);
  const copy=await f.service.duplicate(original.id),copied=f.data(copy);
  assert.notEqual(copy.id,original.id);assert.notEqual(copied.phoneNumberNormalized,data.phoneNumberNormalized);
  assert.equal(copy.name,'Pessoal - Cópia');assert.equal(copied.actorUuid,data.actorUuid);assert.deepEqual(copy.ownership,before.ownership);
  const omitNumber=value=>Object.fromEntries(Object.entries(value).filter(([key])=>!['phoneNumber','phoneNumberNormalized','nationalNumberNormalized','localNumber','agendaCopySource'].includes(key)));
  assert.deepEqual(omitNumber(copied),omitNumber(data));
  assert.deepEqual(f.state.docs[original.id],before);
  f.data(f.state.docs[copy.id]).personalization.theme='light';assert.equal(data.personalization.theme,'dark');
  f.data(f.state.docs[copy.id]).custom.nested.value=9;assert.equal(data.custom.nested.value,42);
  const edited=await f.service.save(copy.id,{name:'Cópia editada'});
  assert.equal(f.data(edited).pin.hash,'secret');assert.equal(f.data(edited).actorUuid,data.actorUuid);assert.equal(f.data(edited).permissions.customApp,true);
});

test('gerenciador: cópia preserva arquivamento, auditoria e referência de Actor excluído',async()=>{
  const f=fixture(),doc=await f.create('11999999999');
  await f.service.setArchived(doc.id,true);
  Object.assign(f.data(f.state.docs[doc.id]),{actorUuid:'Actor.deleted',actorId:'deleted'});
  const copy=await f.service.duplicate(doc.id),data=f.data(copy);
  assert.equal(data.archived,true);assert.deepEqual(data.archiveAudit,f.data(f.state.docs[doc.id]).archiveAudit);
  assert.equal(data.actorUuid,'Actor.deleted');assert.deepEqual(data.users,['alice']);
  assert.notEqual(copy.id,doc.id);assert.notEqual(data.phoneNumberNormalized,f.data(f.state.docs[doc.id]).phoneNumberNormalized);
});

test('gerenciador: arquivar/restaurar preserva tudo, audita e reserva o número',async()=>{
  const f=fixture();const original=await f.create('11999999999');
  Object.assign(f.data(f.state.docs[original.id]),{pin:{hash:'secret'},history:['past'],personalization:{theme:'dark'}});
  const before=clone(f.state.docs[original.id]);
  await f.service.setArchived(original.id,true);
  const stored=f.state.docs[original.id],data=f.data(stored);
  const {archived,archiveAudit,accessEpoch,...rest}=data;
  assert.equal(accessEpoch,1);
  assert.equal(archived,true);assert.deepEqual(rest,f.data(before));assert.equal(stored._id,before._id);assert.deepEqual(stored.ownership,before.ownership);
  assert.equal(archiveAudit[0].operation,'archive');assert.equal(archiveAudit[0].userId,'gm');assert.ok(Number.isFinite(Date.parse(archiveAudit[0].at)));
  await assert.rejects(()=>f.create('11999999999'),/já pertence/);
  await f.service.setArchived(original.id,true);assert.equal(f.data(f.state.docs[original.id]).archiveAudit.length,1);
  await f.service.setArchived(original.id,false);
  const restored=f.data(f.state.docs[original.id]);assert.equal(restored.archived,false);assert.equal(restored.archiveAudit[1].operation,'restore');
  const {archived:_,archiveAudit:__,accessEpoch:epoch,...preserved}=restored;assert.equal(epoch,2);assert.deepEqual(preserved,f.data(before));
  assert.ok(Object.values(f.state.docs).some(doc=>f.data(doc)?.reason==='phone-archive'));
  assert.ok(Object.values(f.state.docs).some(doc=>f.data(doc)?.reason==='phone-restore'));
});

test('gerenciador: persistência simulada da cópia, arquivo, auditoria e restauração',async()=>{
  const f=fixture(),original=await f.create('11999999999');
  const copied=await f.service.duplicate(original.id);await f.service.setArchived(original.id,true);
  const reloaded=fixture(JSON.parse(JSON.stringify(f.state)));
  assert.equal(reloaded.phones().length,2);assert.equal(reloaded.data(reloaded.state.docs[original.id]).archived,true);
  assert.equal(reloaded.data(reloaded.state.docs[copied.id]).phoneNumberNormalized,f.data(copied).phoneNumberNormalized);
  await reloaded.service.setArchived(original.id,false);assert.equal(reloaded.data(reloaded.state.docs[original.id]).archiveAudit.length,2);
});

test('gerenciador: jogador não duplica/arquiva/restaura; entrada inválida e backup falho não gravam',async()=>{
  const f=fixture(),doc=await f.create('11999999999');const before=clone(f.state.docs[doc.id]);
  game.user={id:'alice',isGM:false};
  for(const action of [()=>f.service.duplicate(doc.id),()=>f.service.setArchived(doc.id,true),()=>f.service.setArchived(doc.id,false)]) await assert.rejects(action,/Somente/);
  game.user={id:'gm',isGM:true};await assert.rejects(()=>f.service.setArchived(doc.id,'true'),/inválida/);
  await assert.rejects(()=>f.service.duplicate('missing'),/não encontrado/);
  const create=f.Journal.create;f.Journal.create=async input=>{if(input.flags?.[ID]?.data?.kind==='backup')throw Error('backup falhou');return create(input);};
  await assert.rejects(()=>f.service.setArchived(doc.id,true),/backup falhou/);assert.deepEqual(f.state.docs[doc.id],before);
});

test('gerenciador: repetição de duplicação e gravação concorrente não perdem dados',async()=>{
  const f=fixture(),doc=await f.create('11999999999');
  const creating=f.service.duplicate(doc.id);
  await assert.rejects(()=>f.service.duplicate(doc.id),/andamento/);await creating;
  const other=createFoundryNumbering({isLeader:()=>true});
  const results=await Promise.allSettled([f.service.setArchived(doc.id,true),other.save(doc.id,{name:'Renomeado'})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.match(results.find(r=>r.status==='rejected').reason.message,/ocupada/);
  await other.save(doc.id,{name:'Renomeado'});
  const data=f.data(f.state.docs[doc.id]);assert.equal(data.archived,true);assert.equal(data.phoneNumberNormalized,'5511999999999');assert.equal(f.phones().length,2);
});

test('gerenciador: cópias por duas instâncias respeitam o bloqueio e a unicidade',async()=>{
  const f=fixture(),doc=await f.create('11999999999');
  const other=createFoundryNumbering({isLeader:()=>true});
  let release,entered;
  const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
  const create=f.Journal.create;
  f.Journal.create=async input=>{if(input.flags?.[ID]?.data?.kind==='phone'){entered();await gate;}return create(input);};
  const first=f.service.duplicate(doc.id);await started;
  const second=other.duplicate(doc.id).finally(release);
  const results=await Promise.allSettled([first,second]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.match(results.find(result=>result.status==='rejected').reason.message,/ocupada/);
  await other.duplicate(doc.id);
  const phones=f.phones();assert.equal(phones.length,3);
  assert.equal(new Set(phones.map(phone=>f.data(phone).phoneNumberNormalized)).size,3);
  assert.equal(new Set(phones.map(phone=>phone._id)).size,3);
});
test('1. cria com número manual; guarda formato e normalização',async()=>{
  const f=fixture();const doc=await f.create('(11) 99999-9999');
  assert.equal(f.data(doc).phoneNumber,'+55 (11) 99999-9999');assert.equal(f.data(doc).phoneNumberNormalized,'5511999999999');
});
test('2. gera automaticamente segundo o padrão configurado',async()=>{
  const f=fixture();f.state.settings.numberPattern='219########';const doc=await f.create('');assert.match(f.data(doc).phoneNumberNormalized,/^55219\d{8}$/);
});
test('3. recusa duplicado e não cria cadastro inválido',async()=>{
  const f=fixture();await f.create('11999999999');await assert.rejects(()=>f.create('11999999999'),/já pertence/);assert.equal(f.phones().length,1);
});
test('4. compara formatos equivalentes',async()=>{
  const f=fixture();await f.create('(11) 99999-9999');await assert.rejects(()=>f.create('11 99999 9999'),/já pertence/);
});
test('5. permite alterar para número livre e recusa edição para número ocupado',async()=>{
  const f=fixture();const first=await f.create('11999999999');await f.create('21999999999');
  const updated=await f.service.save(first.id,{phoneNumber:'31999999999'});assert.equal(f.data(updated).phoneNumberNormalized,'5531999999999');
  await assert.rejects(()=>f.service.save(first.id,{phoneNumber:'21999999999'}),/já pertence/);assert.equal(f.data(f.phones().find(p=>p._id===first.id)).phoneNumberNormalized,'5531999999999');
});
test('6. mantém o número atual ao salvar e preserva PIN, permissões e personalizações',async()=>{
  const f=fixture();const doc=await f.create('11999999999');const data=f.data(f.state.docs[doc.id]);data.pin={hash:'preservado'};data.personalization={wallpaper:'x'};data.permissions.customApp=true;
  const updated=await f.service.save(doc.id,{phoneNumber:'(11) 99999-9999',name:'Renomeado'});
  assert.equal(f.data(updated).phoneNumberNormalized,'5511999999999');assert.deepEqual(f.data(updated).pin,{hash:'preservado'});assert.equal(f.data(updated).permissions.customApp,true);assert.equal(f.data(updated).personalization.wallpaper,'x');assert.deepEqual(updated.ownership,{default:0,gm:3,alice:2});
});
test('7. transfere Actor mantendo ID do aparelho, número e acesso',async()=>{
  const f=fixture();const doc=await f.create('11999999999');const updated=await f.service.save(doc.id,{actorId:'actor2'});
  assert.equal(updated.id,doc.id);assert.equal(f.data(updated).actorId,'actor2');assert.equal(f.data(updated).phoneNumberNormalized,'5511999999999');assert.deepEqual(f.data(updated).users,['alice']);
});
test('8. persistência em armazenamento e reconstrução de sessão simulados (não reinicia Foundry)',async()=>{
  const f=fixture();const doc=await f.create('11999999999');const dir=mkdtempSync(join(tmpdir(),'srpg-numbers-'));
  try{writeFileSync(join(dir,'world.json'),JSON.stringify(f.state));const reloaded=fixture(JSON.parse(readFileSync(join(dir,'world.json'),'utf8')));await reloaded.service.migrate();assert.equal(reloaded.data(reloaded.phones()[0]).phoneNumberNormalized,'5511999999999');assert.equal(reloaded.phones()[0]._id,doc.id);}finally{rmSync(dir,{recursive:true});}
});
test('9. migra legados com backup, preserva dados e é idempotente',async()=>{
  const f=fixture();for(const id of ['oldA','oldB']){f.state.docs[id]={_id:id,name:id,pages:[],ownership:{default:0,gm:3,alice:2},flags:{another:{keep:true},[ID]:{data:{kind:'phone',schema:1,actorId:'actor1',users:['alice'],contacts:[{id:'other',name:'Contato'}],pin:'untouched',permissions:{calendar:true},custom:{theme:'red'}}}}};f.state.settings.devices.push(id)}
  const original=clone(f.state.docs.oldA);assert.equal(await f.service.migrate(),2);
  assert.equal(new Set(f.phones().map(p=>f.data(p).phoneNumberNormalized)).size,2);
  assert.equal(f.data(f.state.docs.oldA).pin,'untouched');assert.deepEqual(f.data(f.state.docs.oldA).contacts,original.flags[ID].data.contacts);assert.deepEqual(f.state.docs.oldA.ownership,original.ownership);assert.deepEqual(f.state.docs.oldA.flags.another,{keep:true});
  assert.ok(Object.values(f.state.docs).some(d=>f.data(d)?.snapshot?._id==='oldA'));assert.equal(await f.service.migrate(),0);
});
test('10. duas instâncias simultâneas: uma salva, outra bloqueia; repetição recusa duplicado',async()=>{
  const f=fixture();const second=createFoundryNumbering({isLeader:()=>true});
  let release,entered;
  const gate=new Promise(resolve=>{release=resolve;});
  const started=new Promise(resolve=>{entered=resolve;});
  const create=f.Journal.create;
  f.Journal.create=async input=>{if(input.flags?.[ID]?.data?.kind==='phone'){entered();await gate;}return create(input);};
  const first=f.create('11999999999');await started;
  const competing=second.save(null,{name:'Outro',actorId:'actor2',users:[],contacts:[],phoneNumber:'(11) 99999-9999'}).finally(release);
  const results=await Promise.allSettled([first,competing]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/ocupada/);assert.equal(f.phones().length,1);
  await assert.rejects(()=>second.save(null,{name:'Outro',actorId:'actor2',phoneNumber:'11999999999'}),/já pertence/);assert.equal(f.state.docs.control.pages.length,0);
});
test('colisão automática tenta novamente; esgotamento e entrada inválida falham sem cadastrar',async()=>{
  let count=0;assert.equal(allocateNumber(new Set(['11900000000']),'119########',()=>count++<8?0:1),'11911111111');
  assert.throws(()=>allocateNumber(new Set(['11900000000']),'119########',()=>0,3),/Não foi possível/);
  const f=fixture();for(const number of ['123','11abc999999999','+9911999999999'])await assert.rejects(()=>f.create(number),/inválido/);assert.equal(f.phones().length,0);
  assert.equal(normalizeNumber('(00) 00000-0000'),'00000000000');assert.equal(formatNumber('0012345678'),'(00) 1234-5678');
});
test('serviço recusa jogador e bloqueio persistente falha fechado',async()=>{
  const f=fixture();game.user={id:'alice',isGM:false};await assert.rejects(()=>f.create('11999999999'),/Somente/);game.user={id:'gm',isGM:true};f.state.docs.control.pages.push({_id:LOCK_ID});await assert.rejects(()=>f.create('11999999999'),/ocupada/);assert.equal(f.phones().length,0);
});
test('primeira migração usa aparelho existente como âncora preservando cópia anterior',async()=>{
  const f=fixture();delete f.state.docs.control;delete f.state.settings.numberLockParent;f.state.docs.old={_id:'old',name:'Antigo',pages:[],ownership:{gm:3,default:0},flags:{[ID]:{data:{kind:'phone',actorId:'actor1',users:[],contacts:[]}}}};f.state.settings.devices=['old'];
  await f.service.migrate();assert.equal(f.state.settings.numberLockParent,'old');assert.equal(f.state.docs.old.flags[ID].numberLockAnchor,true);assert.ok(f.data(f.state.docs.old).phoneNumber);assert.ok(Object.values(f.state.docs).some(d=>f.data(d)?.reason==='numbering-anchor'));
});
test('falha ao fazer backup interrompe edição e libera bloqueio',async()=>{
  const f=fixture();const doc=await f.create('11999999999');const previous=clone(f.state.docs[doc.id]);
  const original=f.Journal.create;f.Journal.create=async input=>{if(input.flags?.[ID]?.data?.kind==='backup')throw Error('backup indisponível');return original(input)};
  await assert.rejects(()=>f.service.save(doc.id,{phoneNumber:'21999999999'}),/backup indisponível/);
  assert.deepEqual(f.state.docs[doc.id],previous);assert.equal(f.state.docs.control.pages.length,0);
});
test('conflito preexistente interrompe migração sem renumerar silenciosamente',async()=>{
  const f=fixture();const first=await f.create('11999999999');const second=await f.create('21999999999');f.data(f.state.docs[second.id]).phoneNumber='+55 (11) 99999-9999';f.data(f.state.docs[second.id]).phoneNumberNormalized='5511999999999';f.data(f.state.docs[second.id]).nationalNumberNormalized='11999999999';
  const before=clone(f.state.docs);await assert.rejects(()=>f.service.migrate(),/duplicados/);assert.deepEqual(f.state.docs,before);assert.equal(f.data(f.state.docs[first.id]).phoneNumberNormalized,'5511999999999');
});
test('DDI padrão, entrada internacional e unicidade do número completo',async()=>{
  const f=fixture();const first=await f.create('+55 (11) 99999-9999');
  assert.equal(f.data(first).countryCode,'55');assert.equal(f.data(first).nationalNumberNormalized,'11999999999');
  await assert.rejects(()=>f.create('5511999999999'),/já pertence/);
  const foreign=await f.service.save(null,{name:'Exterior',actorId:'actor1',countryCode:'1',phoneNumber:'(11) 99999-9999'});
  assert.equal(f.data(foreign).phoneNumber,'+1 (11) 99999-9999');
  await assert.rejects(()=>f.service.save(foreign.id,{countryCode:'55'}),/já pertence/);
  await assert.rejects(()=>f.service.save(foreign.id,{countryCode:'abc'}),/DDI inválido/);
});
test('migração v1 acrescenta 55 sem mudar DDD/número e preserva backup',async()=>{
  const f=fixture();f.state.docs.old={_id:'old',name:'Legado',pages:[],ownership:{gm:3},flags:{[ID]:{data:{kind:'phone',actorId:'actor1',users:[],contacts:[],phoneNumber:'(11) 91234-5678',phoneNumberNormalized:'11912345678',numberingVersion:1,pin:'preservar'}}}};f.state.settings.devices=['old'];
  await f.service.migrate();const data=f.data(f.state.docs.old);
  assert.equal(data.phoneNumber,'+55 (11) 91234-5678');assert.equal(data.phoneNumberNormalized,'5511912345678');assert.equal(data.nationalNumberNormalized,'11912345678');assert.equal(data.pin,'preservar');
  assert.ok(Object.values(f.state.docs).some(d=>f.data(d)?.snapshot?.flags[ID]?.data?.phoneNumber==='(11) 91234-5678'));
  assert.equal(await f.service.migrate(),0);
});
test('divisões fictícias diferentes não podem repetir os mesmos dígitos completos',async()=>{
  const f=fixture();await f.service.save(null,{name:'A',actorId:'actor1',countryCode:'1',phoneNumber:'11999999999'});
  await assert.rejects(()=>f.service.save(null,{name:'B',actorId:'actor1',countryCode:'11',phoneNumber:'1999999999'}),/já pertence/);
});
test('Actors: criação sem vínculo é válida e tem número próprio',async()=>{
  const f=fixture();const doc=await f.service.save(null,{name:'Reserva',phoneNumber:'11911112222'});
  assert.equal(f.data(doc).actorUuid,null);assert.equal(f.data(doc).actorId,null);assert.equal(f.data(doc).phoneNumberNormalized,'5511911112222');
});
test('Actors: todos os tipos do mundo e vários aparelhos por Actor',async()=>{
  const f=fixture();for(const actor of game.actors){const doc=await f.service.save(null,{name:actor.name,actorUuid:actor.uuid});assert.equal(f.data(doc).actorUuid,actor.uuid)}
  const extra=await f.create('11999999999');assert.equal(f.data(extra).actorUuid,'Actor.actor1');assert.equal(f.phones().filter(p=>f.data(p).actorUuid==='Actor.actor1').length,2);
});
test('Actors: vínculo isolado preserva número, ID, PIN, acesso e campos desconhecidos',async()=>{
  const f=fixture();const doc=await f.create('11999999999');const stored=f.state.docs[doc.id];f.data(stored).pin={hash:'keep'};f.data(stored).custom={wallpaper:'x'};f.data(stored).permissions.webstudio=true;
  const before=clone(stored);await f.service.setActorLink(doc.id,'Actor.actor2');const after=f.state.docs[doc.id];
  const expected=clone(before);Object.assign(f.data(expected),{actorUuid:'Actor.actor2',actorId:'actor2',actorLinkVersion:1});assert.deepEqual(after,expected);
  await f.service.setActorLink(doc.id,null);assert.equal(f.data(after).actorUuid,null);assert.equal(f.data(after).phoneNumberNormalized,'5511999999999');assert.equal(after._id,doc.id);
});
test('Actors: serviço recusa jogador e referências externas ou inexistentes',async()=>{
  const f=fixture();const doc=await f.create('11999999999');const before=clone(f.state.docs[doc.id]);
  for(const value of ['Actor.deleted','Compendium.system.pack.Actor.actor1','Scene.scene.Token.token.Actor.actor1','Item.actor1',{}])await assert.rejects(()=>f.service.setActorLink(doc.id,value),/válid/);
  assert.deepEqual(f.state.docs[doc.id],before);
  game.user={id:'alice',isGM:false};await assert.rejects(()=>f.service.setActorLink(doc.id,null),/Somente o GM/);await assert.rejects(()=>f.service.save(doc.id,{actorUuid:null}),/Somente o GM/);
});
test('Actors: excluir Actor não exclui aparelho e não impede editar outros dados',async()=>{
  const f=fixture();const doc=await f.create('11999999999');game.actors.splice(0,1);
  const updated=await f.service.save(doc.id,{name:'Sem dono disponível'});assert.equal(f.data(updated).actorUuid,'Actor.actor1');assert.equal(f.data(updated).phoneNumberNormalized,'5511999999999');assert.equal(f.phones().length,1);
  await f.service.setActorLink(doc.id,null);assert.equal(f.data(f.state.docs[doc.id]).actorUuid,null);
});
test('Actors: migração de actorId acrescenta UUID com backup e sem renumerar',async()=>{
  const f=fixture();const original={kind:'phone',schema:1,actorId:'actor1',phoneNumber:'(11) 99999-9999',phoneNumberNormalized:'11999999999',numberingVersion:1,pin:'keep',users:['alice'],contacts:[],permissions:{calendar:true},custom:{x:1}};
  f.state.docs.legacy={_id:'legacy',name:'Legado',pages:[],ownership:{gm:3,alice:2},flags:{[ID]:{data:clone(original)}}};f.state.settings.devices=['legacy'];
  assert.equal(await f.service.migrateActors(),1);assert.deepEqual(f.data(f.state.docs.legacy),{...original,actorUuid:'Actor.actor1',actorLinkVersion:1});assert.equal(await f.service.migrateActors(),0);
  assert.ok(Object.values(f.state.docs).some(d=>f.data(d)?.reason==='actor-link-migration' && f.data(d).snapshot.flags[ID].data.phoneNumber==='(11) 99999-9999'));
});
test('Actors: vínculo sobrevive à reconstrução de sessão simulada',async()=>{
  const f=fixture();const doc=await f.create('11999999999');await f.service.setActorLink(doc.id,'Actor.actor2');const reloaded=fixture(clone(f.state));
  assert.equal(await reloaded.service.migrateActors(),0);assert.equal(reloaded.data(reloaded.state.docs[doc.id]).actorUuid,'Actor.actor2');assert.equal(reloaded.data(reloaded.state.docs[doc.id]).phoneNumberNormalized,'5511999999999');
});
test('Actors: falha de backup impede alteração do vínculo',async()=>{
  const f=fixture();const doc=await f.create('11999999999');const before=clone(f.state.docs[doc.id]);f.Journal.create=async()=>{throw Error('backup falhou')};
  await assert.rejects(()=>f.service.setActorLink(doc.id,null),/backup falhou/);assert.deepEqual(f.state.docs[doc.id],before);assert.equal(f.state.docs.control.pages.length,0);
});




test('contatos pessoais: número resolvido pelo GM, apelidos isolados, edição, persistência e preservação',async()=>{
  const f=fixture(),source=await f.create('11999999999'),target=await f.create('11888888888');
  game.users.push({id:'bob',isGM:false});await f.service.save(source.id,{users:['alice','bob']});
  const before=clone(f.data(f.state.docs[source.id]));
  await f.service.applyUserAction(source.id,'alice','contact-save',{countryCode:'55',phoneNumber:'(11) 88888-8888',name:'Amigo'},'contact1');
  await f.service.applyUserAction(source.id,'bob','contact-save',{countryCode:'55',phoneNumber:'11888888888',name:'Colega'},'contact2');
  let data=f.data(f.state.docs[source.id]);assert.equal(data.personalContacts.alice[0].name,'Amigo');assert.equal(data.personalContacts.bob[0].name,'Colega');
  await f.service.applyUserAction(source.id,'alice','contact-save',{countryCode:'55',phoneNumber:'+55 (11) 88888-8888',name:'Outro apelido'},'contact3');
  data=f.data(f.state.docs[source.id]);assert.equal(data.personalContacts.alice.length,1);assert.equal(data.personalContacts.alice[0].name,'Outro apelido');assert.equal(data.personalContacts.bob[0].name,'Colega');
  for(const key of ['phoneNumber','phoneNumberNormalized','users','contacts','actorUuid'])assert.deepEqual(data[key],before[key]);
  const fresh=fixture(clone(f.state));assert.equal(fresh.data(fresh.state.docs[source.id]).personalContacts.alice[0].id,target.id);
});
test('contatos pessoais: recusa número ausente, próprio, payload forjado e falta de permissão',async()=>{
  const f=fixture(),source=await f.create('11999999999'),target=await f.create('11888888888');
  const payload={countryCode:'55',phoneNumber:'11888888888',name:'NOME DO CONTATO'};
  for(const input of [{...payload,phoneNumber:'123'},{...payload,phoneNumber:'11999999999'},{...payload,phoneNumber:'11777777777'},{...payload,userId:'bob'},{...payload,name:'x'.repeat(81)}])await assert.rejects(()=>f.service.applyUserAction(source.id,'alice','contact-save',input));
  await f.service.save(source.id,{enabledApps:['messages','personalization']});await assert.rejects(()=>f.service.applyUserAction(source.id,'alice','contact-save',payload));
  await f.service.save(source.id,{enabledApps:['contacts','messages','personalization'],users:[]});await assert.rejects(()=>f.service.applyUserAction(source.id,'alice','contact-save',payload));
  assert.equal(f.data(f.state.docs[source.id]).personalContacts,undefined);
});

test('numeração estruturada: internacionais, duplicidade completa, edição isolada e cópia',async()=>{
 const f=fixture();const input={name:'Internacional',countryCode:'+44',areaCode:'020',localNumber:'000-1234',users:['alice'],contacts:[]};const first=await f.service.save(null,input),data=f.data(first);assert.equal(data.phoneNumberNormalized,'440200001234');assert.equal(data.areaCode,'020');assert.equal(data.localNumber,'0001234');assert.equal(data.numberingVersion,3);
 await assert.rejects(()=>f.service.save(null,{...input,name:'Duplicado',localNumber:'0001234'}),/pertence/);
 const other=await f.service.save(null,{...input,areaCode:'021'});assert.notEqual(f.data(other).phoneNumberNormalized,data.phoneNumberNormalized);
 const edited=await f.service.save(first.id,{name:'Nome novo'});assert.equal(edited.id,first.id);assert.equal(f.data(edited).phoneNumberNormalized,data.phoneNumberNormalized);
 const copy=await f.service.duplicate(first.id);assert.equal(f.data(copy).areaCode,'020');assert.notEqual(f.data(copy).phoneNumberNormalized,data.phoneNumberNormalized);assert.equal(f.data(copy).countryCode,'44');
});
test('numeração estruturada: geração automática respeita padrões sem renumerar existentes',async()=>{
 const f=fixture();f.state.settings.contactCountryCode='+99';f.state.settings.contactAreaCode='007';const first=await f.service.save(null,{name:'Automático',areaCode:'007',countryCode:'+99',localNumber:'',users:['alice'],contacts:[]});const number=f.data(first).phoneNumberNormalized;assert.equal(f.data(first).areaCode,'007');assert.ok(number.startsWith('99007'));
 f.state.settings.contactAreaCode='008';const edited=await f.service.save(first.id,{name:'Mesmo aparelho'});assert.equal(f.data(edited).phoneNumberNormalized,number);
});
test('numeração estruturada: migração acrescenta partes sem trocar ID ou número e valida concorrência',async()=>{
 const f=fixture(),first=await f.create('01999999999');const stored=f.data(f.state.docs[first.id]);delete stored.areaCode;delete stored.localNumber;const before=clone(stored);await f.service.migrate();const after=f.data(f.state.docs[first.id]);assert.equal(after.areaCode,'01');assert.equal(after.localNumber,'999999999');assert.equal(after.phoneNumberNormalized,before.phoneNumberNormalized);assert.equal(after.phoneNumber,before.phoneNumber);
 const input={name:'Concorrente',countryCode:'44',areaCode:'020',localNumber:'0001234',users:['alice'],contacts:[]};const attempts=await Promise.allSettled([f.service.save(null,input),f.service.save(null,input)]);assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);assert.equal(attempts.filter(r=>r.status==='rejected').length,1);
});
