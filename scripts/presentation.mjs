import {contactPatch} from './contacts.mjs';
import {requireApp,requireDeviceAccess,validateLayout} from './apps.mjs';
export const DEFAULT_APPEARANCE=Object.freeze({primaryColor:'#121b2c',accentColor:'#9af2ce',theme:'dark',homeWallpaper:'',lockWallpaper:''});
export function imagePath(value) {
  if(value==='')return '';
  if(typeof value!=='string'||value.length>1024)throw Error('Caminho de imagem inválido.');
  let path=value.trim().replace(/\\/g,'/');
  let decoded;try{decoded=decodeURIComponent(path);}catch{throw Error('Caminho de imagem inválido.');}
  if(!path||path.startsWith('/')||/[\x00-\x1f:"'<>?#]/.test(decoded)||/%[\da-f]{2}/i.test(decoded)||decoded.startsWith('/')||decoded.split('/').some(part=>part==='..'||part==='.')||!(/\.(?:png|jpe?g|webp|gif|avif|svg)$/i).test(decoded)) throw Error('Selecione uma imagem local da biblioteca do Foundry.');
  return path;
}
export function validateAppearance(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!Object.hasOwn(DEFAULT_APPEARANCE,key)))throw Error('Somente configurações visuais são permitidas.');
  const result={...DEFAULT_APPEARANCE,...value};
  for(const key of ['primaryColor','accentColor']) if(typeof result[key]!=='string'||!/^#[\da-f]{6}$/i.test(result[key]))throw Error('Cor inválida. Use uma cor hexadecimal com seis dígitos.');
  if(!['dark','light'].includes(result.theme))throw Error('Tema inválido.');
  result.homeWallpaper=imagePath(result.homeWallpaper);result.lockWallpaper=imagePath(result.lockWallpaper);
  return result;
}
export function appearanceOf(phone) {
  const old=phone?.personalization??{},value={...DEFAULT_APPEARANCE};
  for(const key of Object.keys(value))if(old[key]!==undefined)value[key]=old[key];
  if(!old.homeWallpaper&&typeof old.wallpaper==='string')value.homeWallpaper=old.wallpaper;
  for(const key of ['homeWallpaper','lockWallpaper'])try{value[key]=imagePath(value[key]);}catch{value[key]='';}
  for(const key of ['primaryColor','accentColor'])if(typeof value[key]!=='string'||!/^#[\da-f]{6}$/i.test(value[key]))value[key]=DEFAULT_APPEARANCE[key];
  if(!['dark','light'].includes(value.theme))value.theme='dark';return value;
}
export function notificationsFor(phone,user) {
  requireDeviceAccess(phone,user);
  return (Array.isArray(phone.notifications)?phone.notifications:[]).filter(n=>n&&typeof n.id==='string'&&typeof n.title==='string'&&typeof n.message==='string').slice(-100).map(n=>({...n,read:(Array.isArray(n.readBy)?n.readBy:[]).includes(user.id)}));
}
export function notificationRecord(input,id,at=new Date().toISOString()) {
  if(!input||typeof input.title!=='string'||!input.title.trim()||input.title.length>100||typeof input.message!=='string'||input.message.length>1000)throw Error('Notificação inválida.');
  return {id,title:input.title.trim(),message:input.message,at,readBy:[],source:typeof input.source==='string'?input.source.slice(0,40):'system'};
}
export function presentationPatch(phone,user,action,payload,phones) {
  requireDeviceAccess(phone,user);
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Solicitação inválida.');
  if(action==='contact-save'){requireApp(phone,user,'contacts');return contactPatch(phone,user,payload,phones);}
  if(action==='layout') {
    if(Object.keys(payload).some(key=>key!=='layout'))throw Error('Somente o layout pode ser alterado.');
    return {appLayout:validateLayout(payload.layout,phone)};
  }
  if(action==='appearance') {
    requireApp(phone,user,'personalization');
    return {personalization:{...phone.personalization,...validateAppearance(payload)}};
  }
  if(action==='notification-read') {
    if(Object.keys(payload).some(key=>key!=='id')||typeof payload.id!=='string')throw Error('Notificação inválida.');
    if(!notificationsFor(phone,user).some(n=>n.id===payload.id))throw Error('Notificação não encontrada.');
    return {notifications:phone.notifications.map(n=>n?.id===payload.id?{...n,readBy:[...new Set([...(Array.isArray(n.readBy)?n.readBy:[]),user.id])]}:n)};
  }
  throw Error('Operação visual não autorizada.');
}
