import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withEmbeddedLock,recoverEmbeddedLock,createLocalWriteQueue,LOCK_ID} from '../scripts/foundry-numbering.mjs';
const ID='smartphone-rpg';
test('fila local mantém a ordem e uma falha não interrompe a próxima tarefa',async()=>{
  const serialize=createLocalWriteQueue(),order=[];
  const first=serialize(async()=>{order.push('primeira');throw Error('falhou');});
  const next=serialize(async()=>{order.push('segunda');return 'ok';});
  await assert.rejects(first,/falhou/);assert.equal(await next,'ok');assert.deepEqual(order,['primeira','segunda']);
});
test('liberação vetada é diagnosticada sem remover outra página',async()=>{
  globalThis.game={users:[{id:'gm',isGM:true}]};let deletes=0;
  const page={id:LOCK_ID,getFlag:()=>({token:'same'}),delete:async()=>{deletes++;}};
  const parent={pages:new Map([[LOCK_ID,page]]),createEmbeddedDocuments:async()=>[page]};
  await assert.rejects(()=>withEmbeddedLock(parent,async()=>{}, {owner:'gm',token:'same'}),/não foi liberado/);
  assert.equal(deletes,1);assert.equal(parent.pages.get(LOCK_ID),page);
});
test('regressão: snapshot não recebe a página; liberação usa o documento retornado',async()=>{
  globalThis.game={users:[{id:'gm',isGM:true}]};
  let deleted=false,ran=false;
  const snapshot={createEmbeddedDocuments:async()=>[{id:LOCK_ID,delete:async()=>{deleted=true;}}],deleteEmbeddedDocuments:async()=>{throw Error(`undefined id [${LOCK_ID}] does not exist in the EmbeddedCollection collection.`);}};
  await withEmbeddedLock(snapshot,async()=>{ran=true;},{owner:'gm',token:'token'});
  assert.equal(ran,true);assert.equal(deleted,true);
});
test('regressão: falha na tarefa também libera a página correta',async()=>{
  globalThis.game={users:[{id:'gm',isGM:true}]};let deleted=false;
  const parent={createEmbeddedDocuments:async()=>[{id:LOCK_ID,delete:async()=>{deleted=true;}}]};
  await assert.rejects(()=>withEmbeddedLock(parent,async()=>{throw Error('falha original');},{owner:'gm',token:'x'}),/falha original/);assert.equal(deleted,true);
});
test('recuperação preserva backup antes de excluir apenas a página temporária',async()=>{
  const order=[];const lock={owner:'gm',token:'old'};
  const page={getFlag:(namespace,key)=>namespace===ID&&key==='writeLock'?lock:null,delete:async()=>order.push('delete')};
  const parent={pages:new Map([[LOCK_ID,page]])};
  assert.equal(await recoverEmbeddedLock(parent,{confirm:async()=>false,backup:async()=>order.push('backup')}),false);assert.deepEqual(order,[]);
  assert.equal(await recoverEmbeddedLock(parent,{confirm:async()=>true,backup:async()=>order.push('backup')}),true);assert.deepEqual(order,['backup','delete']);
});
test('recuperação falha fechada se backup falhar ou bloqueio mudar',async()=>{
  let deleted=false;const page={getFlag:()=>({owner:'gm',token:'old'}),delete:async()=>{deleted=true;}};
  const parent={pages:new Map([[LOCK_ID,page]])};
  await assert.rejects(()=>recoverEmbeddedLock(parent,{confirm:async()=>true,backup:async()=>{throw Error('backup falhou');}}),/backup falhou/);assert.equal(deleted,false);
  await assert.rejects(()=>recoverEmbeddedLock(parent,{confirm:async()=>true,backup:async()=>parent.pages.delete(LOCK_ID)}),/mudou/);assert.equal(deleted,false);
});
