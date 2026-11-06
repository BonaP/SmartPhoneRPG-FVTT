import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contactsFor,contactDefaults,validateContactInput} from '../scripts/contacts.mjs';
import {validateRequest} from '../scripts/core.mjs';
import {renderDevice} from '../scripts/device-view.mjs';
test('contatos: padrões de mesa e apelidos por usuário sem alterar agenda antiga',()=>{
 assert.deepEqual(contactDefaults(),{countryCode:'55',areaCode:'11'});assert.deepEqual(contactDefaults({countryCode:'99',areaCode:'42'}),{countryCode:'99',areaCode:'42'});
 assert.deepEqual(contactDefaults({countryCode:'bad',areaCode:'bad'}),{countryCode:'55',areaCode:'11'});
 const phone={contacts:[{id:'b',name:'Legado'}],personalContacts:{alice:[{id:'b',name:'Amigo'}],bob:[{id:'b',name:'Chefe'}]}};
 assert.equal(contactsFor(phone,{id:'alice'})[0].name,'Amigo');assert.equal(contactsFor(phone,{id:'bob'})[0].name,'Chefe');assert.equal(contactsFor(phone,{id:'carol'})[0].name,'Legado');assert.equal(phone.contacts[0].name,'Legado');
 assert.equal(validateContactInput({countryCode:'55',phoneNumber:'(11) 99999-9999'}).name,'NOME DO CONTATO');
});
test('contatos: envio usa somente agenda pessoal do autor ou contatos compartilhados pelo GM',()=>{
 const from={id:'a',users:['alice','bob'],contacts:[],personalContacts:{alice:[{id:'b',name:'Amigo'}]}},to={id:'b'};
 assert.equal(validateRequest({to:'b',body:'Olá'},{id:'alice'},from,to),'Olá');assert.throws(()=>validateRequest({to:'b',body:'Olá'},{id:'bob'},from,to),/Contato/);
});
test('contatos: formulário preenche DDI, DDD e apelido e escapa conteúdo',()=>{
 const phone={id:'a',name:'A',contacts:[{id:'b',name:'<script>x</script>'}]};const html=renderDevice({phone,phones:[phone],screen:'contacts',contactDefaults:{countryCode:'99',areaCode:'42'}});
 assert.match(html,/value="99"/);assert.match(html,/value="\(42\) "/);assert.match(html,/value="NOME DO CONTATO"/);assert.ok(!html.includes('<script>'));
});
