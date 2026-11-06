import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterDevices,duplicateInput} from '../scripts/device-management.mjs';
import {renderActorDirectory} from '../scripts/actor-link-view.mjs';
import {canUse,validateRequest} from '../scripts/core.mjs';
const actors=Object.assign([{id:'a',uuid:'Actor.a',name:'Pedro'}],{get(id){return this.find(a=>a.id===id);}});
const phones=[
  {id:'one',name:'Celulár do Pédro',phoneNumber:'+55 (11) 99999-1234',phoneNumberNormalized:'5511999991234',actorUuid:'Actor.a'},
  {id:'two',name:'PEDRO - Reserva',phoneNumberNormalized:'5521999991234',actorUuid:null},
  {id:'three',name:'Antigo',nickname:'Pédro antigo',archived:true,phoneNumberNormalized:'5531999991234',actorUuid:'Actor.deleted'}
];
const ids=options=>filterDevices(phones,options,actors).map(p=>p.id);
test('pesquisa: nome completo, parcial, apelido, caixa e acentos sem mutação',()=>{
  const before=structuredClone(phones);
  assert.deepEqual(ids({query:'Celulár do Pédro'}),['one']);
  assert.deepEqual(ids({query:'pEdRo'}),['one','two']);
  assert.deepEqual(ids({query:'ular do'}),['one']);
  assert.deepEqual(ids({query:'pédro antigo',status:'all'}),['three']);
  assert.deepEqual(ids({query:'inexistente'}),[]);assert.deepEqual(phones,before);
});
test('pesquisa: número completo, parcial e formatação combinados com Actor e situação',()=>{
  for(const query of ['+55 (11) 99999-1234','5511999991234','(11) 99999','1199999']) assert.deepEqual(ids({query}),['one']);
  assert.deepEqual(ids({actor:'Actor.a'}),['one']);assert.deepEqual(ids({actor:'unlinked'}),['two']);
  assert.deepEqual(ids({actor:'missing',status:'all'}),['three']);
  assert.deepEqual(ids({actor:'Actor.a',query:'reserva'}),[]);
  assert.deepEqual(ids({actor:'unlinked',query:'pedro',status:'active'}),['two']);
  assert.deepEqual(ids({query:'pedro',status:'archived'}),['three']);
  assert.equal(ids({status:'all'}).length,3);
});
test('diretório: estados, ações explícitas, escape e mensagem sem resultados',()=>{
  const html=renderActorDirectory(phones,'all',actors,{status:'all'});
  for(const label of ['Pesquisar por nome ou número','Sem proprietário','Ativos','Arquivados','Abrir','Editar','Duplicar','Arquivar','Restaurar']) assert.ok(html.includes(label));
  assert.ok(renderActorDirectory(phones,'all',actors,{query:'nada'}).includes('Nenhum aparelho corresponde'));
});
test('entrada de cópia solicita número automático sem alterar os dados originais',()=>{
  const source={name:'Original',data:{personalization:{theme:'dark',wallpaper:'image.webp',credentials:'secret',nested:{token:'secret'}},pin:'123',preferences:{session:'secret'}}};
  const input=duplicateInput(source);
  assert.equal(input.name,'Original - Cópia');assert.equal(input.phoneNumber,'');
  assert.equal(source.data.personalization.theme,'dark');assert.equal(source.data.pin,'123');
});
test('arquivados: jogadores não acessam e nenhum usuário envia ou recebe mensagens',()=>{
  const gm={id:'gm',isGM:true},player={id:'p',isGM:false};
  const phone={id:'p1',users:['p'],contacts:[{id:'p2'}],archived:true},active={...phone,id:'p2',archived:false};
  assert.equal(canUse(phone,player),false);assert.equal(canUse(active,player),true);
  assert.throws(()=>validateRequest({to:'p2',body:'oi'},gm,phone,active),/indisponível/);
  assert.throws(()=>validateRequest({to:'p2',body:'oi'},player,active,phone),/indisponível/);
});
