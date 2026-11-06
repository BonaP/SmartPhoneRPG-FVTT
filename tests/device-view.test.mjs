import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderDevice} from '../scripts/device-view.mjs';
const phone={id:'a',name:'Pessoal',phoneNumber:'(11) 99999-9999',users:['alice'],contacts:[{id:'b',name:'Cecil <GDA>'}],disabled:false};
const base={phone,phones:[phone],screen:'home',online:true,actorName:'Mark',now:new Date('2026-10-22T12:00:00Z')};
test('player home: navigation, app placeholders, escaped data and no admin entry',()=>{
  const html=renderDevice(base);
  assert.ok(html.includes('data-page="home"'));assert.ok(html.includes('data-screen="contacts"'));
  assert.ok(!html.includes('data-admin'));assert.ok(html.includes('aria-disabled="true" aria-label="Chamadas — em breve"'));
  assert.ok(html.includes('(11) 99999-9999'));
  assert.ok(!renderDevice({...base,isGM:true}).includes('data-admin'));
  assert.ok(renderDevice({...base,phone:null,phones:[]}).includes('Seu celular está chegando'));
});
test('conversation: two-pane structure, private message escape, blocked composer and draft',()=>{
  const html=renderDevice({...base,screen:'messages',target:'b',entries:[{sent:true,body:'<script>x</script>\nolá',time:Date.now()}],draft:'rascunho <seguro>'});
  assert.ok(html.includes('srpg-conversations'));assert.ok(html.includes('has-conversation'));assert.ok(html.includes('srpg-chat-log'));
  assert.ok(html.includes('Cecil &lt;GDA&gt;'));assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt;'));assert.ok(html.includes('rascunho &lt;seguro&gt;'));
  assert.ok(renderDevice({...base,phone:{...phone,disabled:true},screen:'messages',target:'b'}).includes('aria-label="Enviar mensagem" disabled'));
  const archived=renderDevice({...base,phone:{...phone,archived:true},screen:'messages',target:'b'});
  assert.ok(archived.includes('Arquivado'));assert.ok(archived.includes('aria-label="Enviar mensagem" disabled'));
});
