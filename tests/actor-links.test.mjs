import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actorReference,describeActorLink,prepareActorLink,filterPhonesByActor} from '../scripts/actor-links.mjs';
import {renderActorLinkEditor,renderActorDirectory,renderActorBadge} from '../scripts/actor-link-view.mjs';
const actor={id:'abc',uuid:'Actor.abc',name:'Mark <Grayson>',img:'tokens/mark.webp',type:'superhero'};
const actors=Object.assign([actor],{get(id){return this.find(a=>a.id===id)}});
test('referência: UUID é autoritativo; legado é resolvido; sem Actor não lança erro',()=>{
  assert.equal(actorReference({actorId:'abc'}),'Actor.abc');assert.equal(actorReference({actorId:'abc',actorUuid:null}),null);
  assert.equal(describeActorLink(null,actors).status,'unlinked');assert.equal(describeActorLink({actorUuid:'Actor.abc'},actors).name,actor.name);
  assert.equal(describeActorLink({actorUuid:'Actor.deleted'},actors).status,'missing');assert.equal(describeActorLink({actorUuid:'Actor.abc.Item.x'},actors).status,'missing');
});
test('filtro distingue personagens, aparelhos sem vínculo e referências excluídas',()=>{
  const phones=[{id:'one',actorUuid:'Actor.abc'},{id:'two',actorId:'abc'},{id:'empty',actorUuid:null},{id:'gone',actorUuid:'Actor.deleted'}];
  assert.deepEqual(filterPhonesByActor(phones,'Actor.abc',actors).map(p=>p.id),['one','two']);assert.equal(filterPhonesByActor(phones,'unlinked',actors)[0].id,'empty');assert.equal(filterPhonesByActor(phones,'missing',actors)[0].id,'gone');assert.equal(filterPhonesByActor(phones,'all',actors).length,4);
});
test('formulário permite Sem personagem, mostra imagem e escapa conteúdo',()=>{
  const html=renderActorLinkEditor({id:'p',actorUuid:'Actor.abc'},actors);
  assert.ok(html.includes('value=""'));assert.ok(html.includes('tokens/mark.webp'));assert.ok(html.includes('Mark &lt;Grayson&gt;'));assert.ok(html.includes('data-save-actor'));assert.ok(!html.includes('name="actorUuid" required'));
  assert.ok(renderActorLinkEditor(null,actors).includes('value="" selected'));assert.ok(renderActorLinkEditor({actorUuid:'Actor.deleted'},actors).includes('manter referência'));
});
test('listagem filtrada mostra proprietário e número sem incluir outros aparelhos',()=>{
  const html=renderActorDirectory([{id:'a',name:'Aparelho A',phoneNumber:'+55 (11) 99999-9999',actorUuid:'Actor.abc'},{id:'b',name:'Aparelho B',actorUuid:null}],'Actor.abc',actors);
  assert.ok(html.includes('Aparelho A'));assert.ok(html.includes('+55 (11) 99999-9999'));assert.ok(html.includes('Mark &lt;Grayson&gt;'));assert.ok(!html.includes('Aparelho B'));
  assert.ok(renderActorBadge({actorUuid:'Actor.deleted'},actors).includes('aparelho permanece preservado'));
});
test('referência divergente é recusada e referência excluída inalterada é preservada',()=>{
  assert.throws(()=>prepareActorLink({actorUuid:'Actor.abc',actorId:'other'},{},actors),/não correspondem/);
  assert.equal(prepareActorLink({actorUuid:'Actor.deleted'},{actorUuid:'Actor.deleted'},actors).actorUuid,'Actor.deleted');
});
