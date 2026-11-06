import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertDeviceIds,assertImmutableInput,confirmDeletion,deletionContent} from '../scripts/lifecycle.mjs';
import {renderDeviceActions,renderDeleteButton,renderActorDirectory} from '../scripts/actor-link-view.mjs';
const actors=Object.assign([{id:'actor',name:'Mark',uuid:'Actor.actor'}],{get(id){return this.find(a=>a.id===id)}});
const phone={id:'one',name:'Meu <celular>',phoneNumber:'+55 (11) 99999-9999',actorUuid:'Actor.actor'};
test('exclusão: modal avisa permanência sem exigir digitação e escapa o nome',()=>{
  const html=deletionContent(phone,actors);
  for(const text of ['Meu &lt;celular&gt;','permanente','Não será possível recuperar nenhuma informação']) assert.ok(html.includes(text));
  assert.ok(!html.includes('<input'));
  assert.ok(!html.includes('Meu <celular>'));
});
test('exclusão: cancelar fecha sem confirmar; Excluir confirma sem ler formulário',async()=>{
  let config;
  const Dialog={wait:async options=>{config=options;return options.buttons.find(b=>b.action==='cancel').callback();}};
  assert.equal(await confirmDeletion(phone,actors,Dialog),null);assert.equal(config.modal,true);
  assert.equal(config.buttons[0].type,'button');assert.equal(config.buttons[0].default,true);
  assert.deepEqual(config.buttons.map(b=>b.label),['Cancelar','Excluir']);
  assert.deepEqual(config.buttons[1].callback(),{confirmationName:phone.name});
  const literalCancel={...phone,name:'cancel'};
  const exactDialog={wait:async options=>options.buttons[1].callback()};
  assert.equal(await confirmDeletion(literalCancel,actors,exactDialog),'cancel');
});
test('IDs: detecta duplicidade, campo inconsistente e requisições manipuladas',()=>{
  assert.throws(()=>assertDeviceIds([{id:'one'},{id:'one'}]),/duplicado/);
  assert.throws(()=>assertDeviceIds([{id:'one',data:{_id:'two'}}]),/inconsistente/);
  assert.throws(()=>assertDeviceIds([{id:'one'}],['one','one']),/duplicados/);
  for(const input of [{id:'new'},{_id:'new'},{deviceId:'new'},{uuid:'new'},{'flags.smartphone-rpg.data.id':'new'},{data:{id:'new'}}]) assert.throws(()=>assertImmutableInput(input),/não podem/);
  assert.doesNotThrow(()=>assertImmutableInput({name:'Novo nome',actorUuid:'Actor.actor'}));
});
test('ações: arquivados só restauram/excluem e falhas de exclusão só retomam',()=>{
  const archived=renderDeviceActions({...phone,archived:true});
  assert.ok(archived.includes('srpg-recovery'));assert.ok(!archived.includes('data-device-action="delete"'));
  for(const action of ['open','duplicate','archive']) assert.ok(!archived.includes(`data-device-action="${action}"`));
  assert.ok(!archived.includes('data-edit'));
  const pending=renderDeleteButton({...phone,deletionPending:true});
  assert.ok(pending.includes('Retomar exclusão'));assert.ok(!pending.includes('Restaurar'));
  const card=renderActorDirectory([phone],'all',actors);
  assert.equal((card.match(/data-device-action="delete"/g)||[]).length,1);
  assert.ok(card.includes('class="srpg-delete-icon"'));assert.ok(card.includes('<svg width="14"'));
  assert.ok(!card.includes('Excluir definitivamente</button>'));
});
