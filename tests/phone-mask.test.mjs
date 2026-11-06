import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatNationalInput} from '../scripts/numbering.mjs';
import {attachPhoneMask} from '../scripts/phone-mask.mjs';
function input(){return {value:'',selectionStart:0,selectionEnd:0,listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;},type(value,position=value.length){this.value=value;this.setSelectionRange(position,position);this.listeners.input({});}};}
test('máscara progressiva: parênteses, DDD e hífen',()=>{
  assert.equal(formatNationalInput('1'),'(1');assert.equal(formatNationalInput('11'),'(11)');assert.equal(formatNationalInput('119'),'(11) 9');assert.equal(formatNationalInput('11999999999'),'(11) 99999-9999');assert.equal(formatNationalInput('1133334444'),'(11) 3333-4444');assert.equal(formatNationalInput(''),'');
});
test('digitação, colagem com DDI e cursor na edição',()=>{
  const national=input(),country={value:'55'};attachPhoneMask(national,country);
  national.type('11999999999');assert.equal(national.value,'(11) 99999-9999');assert.equal(national.selectionStart,national.value.length);
  national.type('+1 (11) 99999-9999');assert.equal(country.value,'1');assert.equal(national.value,'(11) 99999-9999');
  national.type('(21) 99999-9999',2);assert.equal(national.selectionStart,2);
  national.type('(11) 99999-9999');national.setSelectionRange(4,4);
  let prevented=false;national.listeners.beforeinput({inputType:'deleteContentBackward',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(national.value.replace(/\D/g,''),'1999999999');
});
