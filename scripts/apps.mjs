import {canUse} from './core.mjs';
export const APP_CATALOG=Object.freeze([
  {id:'messages',name:'Mensagens',icon:'comment-dots',color:'mint',implemented:true},
  {id:'contacts',name:'Contatos',icon:'address-book',color:'blue',implemented:true},
  {id:'calendar',name:'Calendário',icon:'calendar-days',color:'peach',implemented:true},
  {id:'calls',name:'Chamadas',icon:'phone',color:'violet',implemented:false},
  {id:'webstudio',name:'WebStudio',icon:'globe',color:'blue',implemented:false},
  {id:'appstudio',name:'AppStudio',icon:'shapes',color:'pink',implemented:false},
  {id:'personalization',name:'Personalização',icon:'sliders',color:'violet',implemented:true,essential:true}
].map(Object.freeze));
export function enabledApps(phone) {
  return APP_CATALOG.filter(app=>app.essential||!Array.isArray(phone?.enabledApps)||phone.enabledApps.includes(app.id));
}
export function isAppEnabled(phone,id){return enabledApps(phone).some(app=>app.id===id);}
export function validateEnabledApps(value) {
  if(!Array.isArray(value)||value.length>APP_CATALOG.length||value.some(id=>!APP_CATALOG.some(app=>app.id===id))) throw Error('Seleção de aplicativos inválida.');
  return [...new Set([...value,...APP_CATALOG.filter(app=>app.essential).map(app=>app.id)])];
}
export function needsAuthentication(phone){return phone?.authentication?.mode==='pin'||phone?.pin?.enabled===true;}
export function requireDeviceAccess(phone,user) {
  if(!canUse(phone,user)||phone.archived||phone.disabled) throw Error('Sem acesso a este aparelho ativo.');
  if(needsAuthentication(phone)) throw Error('Autenticação por PIN configurada, mas ainda indisponível. Solicite revisão ao GM.');
}
export function requireApp(phone,user,id) {
  requireDeviceAccess(phone,user);
  const app=APP_CATALOG.find(app=>app.id===id);
  if(!app||!isAppEnabled(phone,id)) throw Error('Aplicativo desabilitado pelo GM.');
  if(!app.implemented) throw Error('Aplicativo planejado, ainda não implementado.');
  return app;
}
export function layoutFor(phone={}) {
  phone??={};
  const slots=[],seen=new Set();
  for(const id of Array.isArray(phone.appLayout)?phone.appLayout.slice(0,48):[]) {
    if(typeof id==='string'&&/^[a-z][a-z0-9-]{0,39}$/.test(id)&&!seen.has(id)){slots.push(id);seen.add(id);}else slots.push(null);
  }
  for(const app of APP_CATALOG) if(!seen.has(app.id)) {
    const free=slots.indexOf(null);if(free<0) slots.push(app.id);else slots[free]=app.id;seen.add(app.id);
  }
  while(slots.length<12||slots.length%6)slots.push(null);
  return slots;
}
export function validateLayout(value,phone) {
  if(!Array.isArray(value)||value.length<APP_CATALOG.length||value.length>48) throw Error('Grade de aplicativos inválida.');
  const known=new Set([...APP_CATALOG.map(app=>app.id),...layoutFor(phone).filter(Boolean)]),seen=new Set();
  for(const id of value) {
    if(id===null)continue;
    if(typeof id!=='string'||!known.has(id)||seen.has(id)) throw Error('Posições inválidas ou aplicativos sobrepostos.');
    seen.add(id);
  }
  if(APP_CATALOG.some(app=>!seen.has(app.id))) throw Error('O layout deve preservar também os aplicativos desabilitados.');
  return [...value];
}
export function moveApp(layout,id,index) {
  if(!Number.isInteger(index)||index<0||index>=layout.length||!layout.includes(id)) return [...layout];
  const result=[...layout],old=result.indexOf(id);[result[old],result[index]]=[result[index],result[old]];return result;
}
export class PhoneNavigation {
  locked=true; stack=['home'];
  get screen(){return this.locked?'lock':this.stack.at(-1);}
  unlock(phone,user){requireDeviceAccess(phone,user);this.locked=false;this.stack=['home'];}
  lock(){this.locked=true;this.stack=['home'];}
  open(phone,user,id){if(this.locked)throw Error('Desbloqueie a tela visual primeiro.');requireApp(phone,user,id);if(this.stack.at(-1)!==id)this.stack.push(id);}
  back(){if(!this.locked&&this.stack.length>1)this.stack.pop();}
  home(){if(!this.locked)this.stack=['home'];}
}
