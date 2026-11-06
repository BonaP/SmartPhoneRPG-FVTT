export function validClockAnchor(anchor){return !!anchor&&Number.isFinite(anchor.realEpochMs)&&Number.isFinite(anchor.fictionEpochSeconds);}
export function createClockAnchor(now=Date.now(),random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296) {
  return {schema:1,realEpochMs:now,fictionEpochSeconds:Date.UTC(2040,0,1)/1000+Math.floor(random()*365*86400)};
}
export function fallbackClock(anchor,now=Date.now()) {
  if(!validClockAnchor(anchor))return {time:'--:--',date:'Aguardando o relógio do mundo',source:'pending'};
  const date=new Date((anchor.fictionEpochSeconds+(now-anchor.realEpochMs)/1000)*1000);
  return {time:date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'}),date:date.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}),source:'fiction'};
}
export function readCalendar(modules,api) {
  const active=modules?.get('foundryvtt-simple-calendar-reborn')?.active||modules?.get('foundryvtt-simple-calendar')?.active;
  if(!active)return null;
  if(typeof api?.currentDateTime!=='function')throw Error('API do calendário indisponível.');
  const raw=api.currentDateTime();
  if(!raw||!['year','month','day','hour','minute'].every(key=>Number.isFinite(raw[key]))||raw.hour<0||raw.minute<0)throw Error('Data do calendário indisponível.');
  const display=typeof api.currentDateTimeDisplay==='function'?api.currentDateTimeDisplay():typeof api.formatDateTime==='function'?api.formatDateTime(raw):null;
  return {time:display?.time||`${String(raw.hour).padStart(2,'0')}:${String(raw.minute).padStart(2,'0')}`,date:display?.date??`${raw.day+1}/${raw.month+1}/${raw.year}`,source:'calendar',raw};
}
export function createClockReader(warn=console.warn) {
  let warned=false;
  return ({modules,api,anchor,now})=>{
    try{const clock=readCalendar(modules,api);if(clock){warned=false;return clock;}}
    catch(error){if(!warned){warn('Smartphone RPG: relógio fictício em uso.',error.message);warned=true;}}
    return fallbackClock(anchor,now);
  };
}
