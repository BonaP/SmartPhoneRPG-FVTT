import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canUse,validateRequest,recipients,escapeHTML,text,ID} from '../scripts/core.mjs';
import {DEFAULT_APPEARANCE} from '../scripts/presentation.mjs';

const gm={id:'gm',isGM:true,active:true}, alice={id:'alice',isGM:false,active:true}, bob={id:'bob',isGM:false,active:false}, eve={id:'eve',isGM:false,active:true};
const a={schema:1,kind:'phone',id:'a',name:'A',users:['alice'],contacts:[{id:'b',name:'B'}],disabled:false};
const b={...a,id:'b',name:'B',users:['bob'],contacts:[{id:'a',name:'A'}]};
test('policy: explicit grants, contacts, blocking and offline recipients',()=>{
  assert.equal(canUse(a,alice),true);assert.equal(canUse(a,eve),false);assert.equal(canUse(a,gm),true);
  assert.equal(validateRequest({to:'b',body:' oi '},alice,a,b),'oi');
  assert.throws(()=>validateRequest({to:'b',body:'oi'},eve,a,b),/acesso/);
  assert.throws(()=>validateRequest({to:'x',body:'oi'},alice,a,b),/Contato/);
  assert.throws(()=>validateRequest({to:'b',body:'oi'},alice,{...a,disabled:true},b));
  assert.throws(()=>validateRequest({to:'b',body:'oi'},alice,a,{...b,disabled:true}));
  assert.deepEqual(recipients(a,b,[gm,alice,bob,eve]),['gm','alice','bob']);
  assert.throws(()=>text('x'.repeat(2001)));assert.throws(()=>text(' '));
  assert.equal(escapeHTML('<script>"&'), '&lt;script&gt;&quot;&amp;');
});

class Collection extends Array {
  get contents(){return [...this];} get(id){return this.find(x=>x.id===id);} has(id){return !!this.get(id);}
}
const hooks=new Map();
globalThis.Hooks={once:(n,f)=>{hooks.set(n,[...(hooks.get(n)||[]),f]);},on:(n,f)=>{hooks.set(n,[...(hooks.get(n)||[]),f]);},callAll:(n,...args)=>{for(const f of hooks.get(n)||[]) f(...args);}};
const store=new Map([['devices',['a','b']],['numberLockParent','control']]);
globalThis.game={user:alice,users:Collection.from([gm,alice,bob,eve]),journal:Collection.from([a,b].map(data=>({id:data.id,name:data.name,getFlag:()=>data}))),messages:new Collection(),modules:new Map([[ID,{}]]),settings:{get:(_,k)=>store.get(k),register:()=>{},registerMenu:()=>{}},keybindings:{register:()=>{}},time:{worldTime:123},actors:new Collection()};
globalThis.ui={notifications:{info:()=>{},warn:()=>{},error:()=>{}}};
globalThis.foundry={data:{fields:{StringField:class{constructor(options){this.options=options;}}}},applications:{api:{ApplicationV2:class {
  render(){return this;}
  _getHeaderControls(){return [];}
}}}};
// Minimal DOM adapter for transport tests only; this is not a browser/layout test.
globalThis.DOMParser=class {parseFromString(content){return {querySelector:()=>({textContent:content.match(/data-srpg-body[^>]*>([\s\S]*?)<\/p>/)?.[1]?.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&') ?? ''})};}};
let counter=0;
globalThis.CONFIG={ChatMessage:{documentClass:{create:async data=>{
  const doc={...data,id:`m${++counter}`,author:game.user,timestamp:Date.now(),getFlag:()=>data.flags[ID].data,get isContentVisible(){return this.author.id===game.user.id||this.whisper.includes(game.user.id);}};
  game.messages.push(doc);Hooks.callAll('createChatMessage',doc);return doc;
}}}};
// Emulate the shared server lock used by delivery and administrative writes.
let locked=false;
const control={id:'control',getFlag:(_id,key)=>key==='numberLockAnchor'?true:undefined,createEmbeddedDocuments:async(_type,pages)=>{
  if(locked) throw Error('occupied');locked=true;
  return [{id:pages[0]._id,delete:async()=>{locked=false;}}];
}};
game.journal.push(control);
foundry.utils={randomID:()=>Math.random().toString(36).slice(2),deepClone:structuredClone};
foundry.documents={JournalEntry:{database:{get:async()=>[...game.journal]}}};
CONFIG.Setting={documentClass:{database:{get:async(_class,{query})=>[{value:store.get(query.key.slice(ID.length+1))}]}}};
const flush=async()=>{for(let i=0;i<8;i++) await new Promise(resolve=>setImmediate(resolve));};
await import('../scripts/main.mjs');
Hooks.callAll('init');Hooks.callAll('ready');
const api=game.modules.get(ID).api;

test('admin navigation: directory first, new editor, device selection and native Cell Config permissions',async()=>{
  const previousUser=game.user;
  const previousDocument=globalThis.document;
  const snapshot=JSON.stringify([a,b]);
  // Minimal event adapter: exercise the actual render handlers, without claiming browser layout coverage.
  class Root {
    innerHTML=''; listeners=new Map();
    insertAdjacentHTML(_position,html){this.innerHTML+=html;}
    querySelector(){return null;}
    querySelectorAll(selector){return selector==='[data-command]'?[...this.innerHTML.matchAll(/data-command="([^"]+)"/g)].map(match=>({dataset:{command:match[1]},addEventListener:(_name,fn)=>this.listeners.set(match[1],fn)})):[];}
    addEventListener(name,fn){const previous=this.listeners.get(name);this.listeners.set(name,(...args)=>{previous?.(...args);return fn(...args);});}
    contains(){return true;}
  }
  globalThis.document={createElement:()=>new Root()};
  try {
    game.user=gm;
    const admin=api.openAdmin();
    assert.equal(admin.activeTab,'devices');
    let root=await admin._renderHTML();
    assert.ok(root.innerHTML.includes('data-phone-list'));
    assert.ok(!root.innerHTML.includes('<form'));
    root.listeners.get('new')();
    assert.equal(admin.activeTab,'config');assert.equal(admin.editId,null);
    root=await admin._renderHTML();
    assert.ok(root.innerHTML.includes('Novo aparelho'));assert.ok(root.innerHTML.includes('<form'));
    assert.ok(!root.innerHTML.includes('data-phone-list'));
    admin.activeTab='devices';root=await admin._renderHTML();
    root.listeners.get('click')({target:{closest:()=>({dataset:{edit:'b'}})}});
    assert.equal(admin.editId,'b');assert.equal(admin.activeTab,'config');
    const phone=api.open();
    // Available on the first frame, before the phone content has rendered.
    assert.equal(phone._getHeaderControls()[0].label,'Cell Config');
    phone.selected='a';phone._getHeaderControls()[0].onClick();
    assert.equal(admin.editId,'a');assert.equal(admin.activeTab,'config');
    phone.selected='b';const control=phone._getHeaderControls()[0];control.onClick();
    assert.equal(admin.editId,'b');assert.equal(api.openAdmin().activeTab,'devices');
    game.user=alice;
    assert.deepEqual(phone._getHeaderControls(),[]);assert.equal(api.openAdmin('a'),undefined);
    control.onClick();assert.equal(admin.activeTab,'devices');
    assert.equal(JSON.stringify([a,b]),snapshot);
  } finally {game.user=previousUser;globalThis.document=previousDocument;}
});
test('scene toolbar: launcher coexists with ruler; admin API denies players',()=>{
  const ruler={name:'ruler'};
  const controls={tokens:{tools:{ruler}}};
  Hooks.callAll('getSceneControlButtons',controls);
  assert.equal(controls.tokens.tools.ruler,ruler);
  assert.equal(controls.tokens.tools[ID].button,true);
  assert.equal(typeof controls.tokens.tools[ID].onChange,'function');
  assert.equal(api.openAdmin(),undefined);
});

test('arquivamento: API bloqueia envio mesmo pelo GM e operações administrativas de jogador',async()=>{
  const previousUser=game.user,previousArchived=a.archived;
  try {
    game.user=gm;a.archived=true;
    await assert.rejects(()=>api.send('a','b','teste'),/acesso/);
    a.archived=false;b.archived=true;
    await assert.rejects(()=>api.send('a','b','teste'),/arquivado/);
    game.user=alice;
    await assert.rejects(()=>api.duplicatePhone('a'),/Somente/);
    await assert.rejects(()=>api.setArchived('a',true),/Somente/);
  } finally {game.user=previousUser;a.archived=previousArchived;delete b.archived;}
});
test('chat tradicional: documentos legados preservados ficam ocultos e módulo não cria novas mensagens de chat',async()=>{
 const html={hidden:false,classList:{add:value=>html.className=value}},doc={getFlag:()=>({kind:'delivery'})};Hooks.callAll('renderChatMessageHTML',doc,html);assert.equal(html.hidden,true);assert.equal(html.className,'srpg-legacy-chat-hidden');const fs=await import('node:fs');const source=fs.readFileSync(new URL('../scripts/main.mjs',import.meta.url),'utf8')+fs.readFileSync(new URL('../scripts/messaging-bridge.mjs',import.meta.url),'utf8');assert.ok(!source.includes('documentClass.create({content:'));assert.ok(!source.includes('ChatMessage.create('));
});
