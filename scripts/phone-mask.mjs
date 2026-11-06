import {formatNationalInput,parsePhone,normalizeCountryCode} from './numbering.mjs';
export function attachPhoneMask(input,countryInput) {
  if(!input) return;
  function apply() {
    const raw=input.value,at=input.selectionStart??raw.length;
    let digitsBefore=raw.slice(0,at).replace(/\D/g,'').length;
    let source=raw;
    if(raw.trim().startsWith('+')) {
      const prefix=raw.trim().match(/^\+(\d{1,3})\s*\(/)?.[1];
      try {
        const code=normalizeCountryCode(prefix??countryInput.value);
        const parsed=parsePhone(raw,code);countryInput.value=code;source=parsed.national;
        digitsBefore=Math.max(0,digitsBefore-code.length);
      } catch {return;} // Keep invalid pasted data visible so service validation can explain it.
    }
    const formatted=formatNationalInput(source);
    input.value=formatted;
    if(at===raw.length) input.setSelectionRange(formatted.length,formatted.length);
    else {
      let count=0,position=0;
      for(;position<formatted.length;position++) {if(/\d/.test(formatted[position]))count++;if(count>=digitsBefore){position++;break;}}
      input.setSelectionRange(position,position);
    }
  }
  input.addEventListener('input',apply);
  input.addEventListener('beforeinput',event=>{
    const at=input.selectionStart;
    if(at!==input.selectionEnd || !['deleteContentBackward','deleteContentForward'].includes(event.inputType))return;
    const backwards=event.inputType==='deleteContentBackward';
    let pos=backwards?at-1:at;
    if(pos<0 || pos>=input.value.length || /\d/.test(input.value[pos]))return;
    while(pos>=0 && pos<input.value.length && !/\d/.test(input.value[pos]))pos+=backwards?-1:1;
    if(pos<0 || pos>=input.value.length)return;
    event.preventDefault();input.value=input.value.slice(0,pos)+input.value.slice(pos+1);input.setSelectionRange(pos,pos);apply();
  });
}
