import {test} from 'node:test';
import assert from 'node:assert/strict';
import {APP_CATALOG,layoutFor,moveApp,requireApp,enabledApps,PhoneNavigation,validateEnabledApps} from '../scripts/apps.mjs';
import {appearanceOf,validateAppearance,DEFAULT_APPEARANCE,imagePath,presentationPatch,notificationsFor} from '../scripts/presentation.mjs';
import {createClockAnchor,fallbackClock,createClockReader,readCalendar} from '../scripts/clock.mjs';
import {renderDevice} from '../scripts/device-view.mjs';
import {renderAppSettings,renderAppearanceForm} from '../scripts/presentation-view.mjs';
import {attachLauncher,nearestCell} from '../scripts/launcher.mjs';
const user={id:'alice',isGM:false},gm={id:'gm',isGM:true};
const phone={id:'a',name:'Pessoal',users:['alice'],contacts:[{id:'b',name:'Contato'}],permissions:{calendar:true}};

test('relógio fictício tem uma âncora estável e avança pelo tempo real, compartilhável após reinício',()=>{
  const anchor=createClockAnchor(1000,()=>0),stored=JSON.parse(JSON.stringify(anchor));
  assert.equal(fallbackClock(stored,1000).time,'00:00');assert.equal(fallbackClock(stored,61000).time,'00:01');
  assert.deepEqual(fallbackClock(anchor,61000),fallbackClock(stored,61000));
  assert.equal(fallbackClock({},61000).source,'pending');
});
test('calendário: API pública atualiza hora/data e respeita avanço/pausa sem controlar o calendário',()=>{
  const modules=new Map([['foundryvtt-simple-calendar-reborn',{active:true}]]);
  let minute=0;
  const api={currentDateTime:()=>({year:2040,month:0,day:0,hour:12,minute}),currentDateTimeDisplay:()=>({time:`12:${String(minute).padStart(2,'0')}`,date:'Dia do mundo'}),setDate:()=>assert.fail('não pode escrever'),startClock:()=>assert.fail('não pode controlar')};
  assert.equal(readCalendar(modules,api).time,'12:00');minute=20;
  assert.equal(readCalendar(modules,api).time,'12:20');assert.equal(readCalendar(modules,api).date,'Dia do mundo');
  assert.equal(readCalendar(modules,api).time,'12:20');assert.equal(readCalendar(new Map(),api),null);
});
test('falha do calendário usa âncora fictícia sem gerar outra hora e avisa só uma vez',()=>{
  let warnings=0;const read=createClockReader(()=>warnings++),args={modules:new Map([['foundryvtt-simple-calendar-reborn',{active:true}]]),api:{currentDateTime:()=>{throw Error('falhou');}},anchor:createClockAnchor(1000,()=>0),now:61000};
  assert.equal(read(args).time,'00:01');assert.equal(read(args).source,'fiction');assert.equal(warnings,1);
});
test('layout: células vazias, troca, independência e posições de apps desabilitados',()=>{
  const layout=layoutFor(phone),original=[...layout],changed=moveApp(layout,'messages',10);
  assert.equal(changed[10],'messages');assert.equal(changed[0],null);assert.deepEqual(layout,original);
  const hidden={...phone,enabledApps:['contacts'],appLayout:changed};
  assert.ok(!enabledApps(hidden).some(app=>app.id==='messages'));assert.deepEqual(layoutFor(hidden),changed);
  assert.deepEqual(layoutFor({...hidden,enabledApps:APP_CATALOG.map(app=>app.id)}),changed);
  assert.notDeepEqual(layoutFor(phone),changed);assert.ok(enabledApps(hidden).some(app=>app.id==='personalization'));
});
test('catálogo: essencial, planejados e desabilitados são verificados pelo controlador',()=>{
  assert.deepEqual(validateEnabledApps([]),['personalization']);assert.throws(()=>validateEnabledApps(['forged']),/inválida/);
  assert.throws(()=>requireApp({...phone,enabledApps:[]},user,'messages'),/desabilitado/);
  assert.throws(()=>requireApp(phone,gm,'calls'),/não implementado/);
  assert.throws(()=>requireApp(phone,{id:'eve'},'contacts'),/acesso/);
});
test('navegação: trava visual, retorno por pilha e modo PIN futuro falha fechado',()=>{
  const nav=new PhoneNavigation();assert.equal(nav.screen,'lock');nav.back();assert.equal(nav.screen,'lock');
  assert.throws(()=>nav.open(phone,user,'contacts'),/Desbloqueie/);
  nav.unlock(phone,user);nav.open(phone,user,'contacts');nav.open(phone,user,'messages');nav.back();assert.equal(nav.screen,'contacts');
  nav.back();nav.back();assert.equal(nav.screen,'home');nav.lock();
  assert.throws(()=>nav.unlock({...phone,authentication:{mode:'pin'}},user),/PIN/);assert.equal(nav.screen,'lock');
});
test('aparência: cores, dois papéis independentes, defaults e recusa de campos administrativos',()=>{
  const value=validateAppearance({primaryColor:'#112233',accentColor:'#AABBCC',theme:'light',homeWallpaper:'worlds/campanha/inicio.webp',lockWallpaper:'assets/Bloqueio%20azul.png'});
  assert.notEqual(value.homeWallpaper,value.lockWallpaper);assert.equal(value.theme,'light');
  assert.deepEqual(appearanceOf(null),DEFAULT_APPEARANCE);assert.deepEqual(validateAppearance({...DEFAULT_APPEARANCE}),DEFAULT_APPEARANCE);
  for(const extra of [{users:['eve']},{actorUuid:'Actor.eve'},{enabledApps:['calls']},{phoneNumber:'11111111111'},{id:'change'}])assert.throws(()=>validateAppearance(extra),/Somente/);
  assert.throws(()=>validateAppearance({accentColor:'red;display:none'}),/Cor inválida/);
});
test('imagens: caminhos locais e fallback para legado inválido sem permitir URLs ou travessia',()=>{
  assert.equal(imagePath('worlds/mundo/Papel de parede.jpg'),'worlds/mundo/Papel de parede.jpg');
  for(const path of ['https://example.com/a.png','javascript:alert(1)','data:image/png;base64,x','../a.png','assets/%2e%2e/a.png','assets/%252e%252e/a.png','//other/a.png','C:/a.png','assets/x.html'])assert.throws(()=>imagePath(path));
  assert.equal(appearanceOf({personalization:{homeWallpaper:'../bad.png'}}).homeWallpaper,'');
});
test('notificações: autorização e leitura por usuário sem conceder opções administrativas',()=>{
  const withNotes={...phone,notifications:[{id:'note',title:'Aviso',message:'Mensagem',at:'2040-01-01',readBy:[]}]};
  assert.equal(notificationsFor(withNotes,user)[0].read,false);
  const patch=presentationPatch(withNotes,user,'notification-read',{id:'note'});
  assert.equal(notificationsFor({...withNotes,...patch},user)[0].read,true);
  assert.equal(notificationsFor({...withNotes,...patch},gm)[0].read,false);
  assert.throws(()=>notificationsFor(withNotes,{id:'eve'}),/acesso/);
  assert.throws(()=>presentationPatch(phone,user,'admin',{users:['eve']}),/não autorizada/);
});
test('interface: bloqueio não expõe conversa, apps desabilitados somem e personalização não tem administração',()=>{
  const locked=renderDevice({phone,phones:[phone],screen:'lock',locked:true,notificationsOpen:true,notifications:[{title:'PRIVADO',message:'SEGREDO'}]});
  assert.ok(locked.includes('Bloqueio apenas visual'));assert.ok(!locked.includes('PRIVADO'));assert.ok(locked.includes('data-unlock'));
  const hidden={...phone,enabledApps:['contacts']},html=renderDevice({phone:hidden,phones:[hidden],screen:'home'});
  assert.ok(!html.includes('data-screen="messages"'));assert.ok(html.includes('data-screen="personalization"'));
  const forced=renderDevice({phone:hidden,phones:[hidden],screen:'messages',target:'b',entries:[{body:'SEGREDO'}]});assert.ok(!forced.includes('SEGREDO'));
  const form=renderAppearanceForm(DEFAULT_APPEARANCE);for(const field of ['actorUuid','phoneNumber','name="users"','PIN'])assert.ok(!form.includes(field));
  assert.ok(renderAppSettings(phone).includes('Planejado · em breve'));
});

function launcherFixture(){
  let time=0,next=0;const timers=new Map(),moves=[],modes=[];
  const classes=()=>({values:new Set(),add(...names){names.forEach(n=>this.values.add(n));},remove(...names){names.forEach(n=>this.values.delete(n));}});
  const makeNode=()=>({style:{},classList:classes(),removeAttribute(){},remove(){},cloneNode:()=>makeNode()});
  const button=Object.assign(makeNode(),{dataset:{appId:'messages'},getBoundingClientRect:()=>({width:40,height:40}),setPointerCapture(){},hasPointerCapture:()=>false});
  const cells=[0,1,2].map(index=>({dataset:{cell:String(index)},classList:classes(),hasAttribute:()=>false,getBoundingClientRect:()=>({left:index*50,right:index*50+50,top:0,bottom:50})}));
  const events=new Map(),rootEvents=new Map();
  const grid={contains:()=>true,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name),querySelectorAll:selector=>selector==='[data-cell]'?cells:[],querySelector:selector=>cells[Number(selector.match(/\d+/)[0])],getBoundingClientRect:()=>({left:0,right:150,top:0,bottom:50})};
  const root={classList:classes(),querySelector:()=>grid,append(){},addEventListener:(name,fn)=>rootEvents.set(name,fn),removeEventListener:name=>rootEvents.delete(name)};
  const dispose=attachLauncher(root,{getLayout:()=>['messages','contacts',null],onMove:layout=>moves.push(layout),onOrganize:value=>modes.push(value),setTimer:(fn,delay)=>{timers.set(++next,{fn,at:time+delay});return next;},clearTimer:id=>timers.delete(id)});
  const event=(x=20,y=20)=>({button:0,pointerId:1,isPrimary:true,clientX:x,clientY:y,target:{closest:()=>button},preventDefault(){this.prevented=true;},stopPropagation(){},stopImmediatePropagation(){this.stopped=true;}});
  const advance=ms=>{time+=ms;for(const [id,timer]of timers)if(timer.at<=time){timers.delete(id);timer.fn();}};
  return {events,rootEvents,moves,modes,event,advance,dispose};
}
test('ponteiro: clique rápido não organiza; 450ms inicia arraste, encaixa e suprime o clique',()=>{
  const f=launcherFixture();f.events.get('pointerdown')(f.event());f.advance(449);f.events.get('pointerup')(f.event());
  assert.equal(f.modes.length,0);assert.equal(f.moves.length,0);const click=f.event();f.rootEvents.get('click')(click);assert.ok(!click.prevented);
  f.events.get('pointerdown')(f.event());f.advance(450);assert.deepEqual(f.modes,[true]);f.events.get('pointermove')(f.event(75,20));f.events.get('pointerup')(f.event(75,20));
  assert.deepEqual(f.moves,[['contacts','messages',null]]);const dragClick=f.event();f.rootEvents.get('click')(dragClick);assert.equal(dragClick.stopped,true);f.dispose();
});
test('ponteiro: soltar fora da grade cancela sem salvar; célula mais próxima usa limites',()=>{
  const f=launcherFixture();f.events.get('pointerdown')(f.event());f.advance(450);f.events.get('pointermove')(f.event(300,300));f.events.get('pointerup')(f.event(300,300));assert.equal(f.moves.length,0);f.dispose();
  assert.equal(nearestCell([{index:2,rect:{left:10,right:30,top:10,bottom:30}}],20,20,{left:0,right:50,top:0,bottom:50}),2);
  assert.equal(nearestCell([],100,100,{left:0,right:50,top:0,bottom:50}),null);
});
