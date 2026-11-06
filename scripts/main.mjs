import {createPhoneBadge} from './phone-badge.mjs';
import {createMessagingBridge} from './messaging-bridge.mjs';
import {partsOf,code} from './phone-parts.mjs';
import {contactsFor,contactDefaults} from './contacts.mjs';
import {ID, text, escapeHTML as esc, canUse, validateRequest, recipients} from './core.mjs';
import {createFoundryNumbering} from './foundry-numbering.mjs';
import {DEFAULT_PATTERN,DEFAULT_COUNTRY_CODE,formatNationalInput} from './numbering.mjs';
import {attachPhoneMask} from './phone-mask.mjs';
import {describeActorLink} from './actor-links.mjs';
import {renderActorLinkEditor,renderActorDirectory,renderActorBadge} from './actor-link-view.mjs';
import {confirmDeletion} from './lifecycle.mjs';
import {createPlayerPhoneClass} from './player-phone.mjs';
import {APP_CATALOG,requireApp} from './apps.mjs';
import {presentationPatch,notificationsFor} from './presentation.mjs';
import {renderAppSettings} from './presentation-view.mjs';
import {createClockReader} from './clock.mjs';

const flag = doc => doc?.getFlag(ID, 'data');
const registry = () => game.settings.get(ID, 'devices')??[];
const allPhones = () => game.journal.filter(d => registry().includes(d.id) && flag(d)?.kind === 'phone');
const phoneData = doc => doc ? {...flag(doc), id: doc.id, name: doc.name} : null;
const getPhone = id => registry().includes(id) && flag(game.journal.get(id))?.kind==='phone' ? phoneData(game.journal.get(id)) : null;
const messageBody = doc => new DOMParser().parseFromString(doc.content, 'text/html').querySelector('[data-srpg-body]')?.textContent ?? '';
const gms = () => game.users.filter(u => u.isGM);
const isLeader = () => game.user.isGM && game.users.filter(u => u.isGM && u.active).sort((a,b) => a.id.localeCompare(b.id))[0]?.id === game.user.id;
let app;
let adminApp;
let queue = Promise.resolve();
const readClock=createClockReader();
function getClock(){return readClock({modules:game.modules,api:globalThis.SimpleCalendar?.api,anchor:game.settings.get(ID,'worldClock'),now:game.time?.serverTime??Date.now()});}

let messaging;
const updateBadge=createPhoneBadge({getView:()=>{const view=structuredClone(messaging?.view??{phones:{}});for(const phone of allPhones().map(phoneData)){if(!canUse(phone,game.user))continue;view.phones[phone.id]??={notifications:[]};view.phones[phone.id].notifications=[...(view.phones[phone.id].notifications??[]),...(phone.notifications??[]).map(n=>({...n,read:(n.readBy??[]).includes(game.user.id)}))];}return view;},getIds:()=>game.user.isGM?(app?.selected?[app.selected]:[]):allPhones().map(phoneData).filter(p=>canUse(p,game.user)).map(p=>p.id)});
async function requestDeviceAction(id,action,payload){
 presentationPatch(getPhone(id),game.user,action,payload);
 if(game.user.isGM){await numbering.applyUserAction(id,game.user.id,action,payload);return {pending:false};}
 return messaging.request(id,'visual',{action,payload});
}
async function send(from,to,body){
 requireApp(getPhone(from),game.user,'messages');if(getPhone(to)?.archived)throw Error('Destinatário arquivado.');
 const target=getPhone(to),saved=contactsFor(getPhone(from),game.user).find(c=>c.id===to);
 const number=target?.phoneNumberNormalized??saved?.number??saved?.phoneNumber;
 if(!number)throw Error('Número do destinatário indisponível.');return messaging.request(from,'send-number',{number,body});
}
const numbering=createFoundryNumbering({isLeader,purgeMessaging:id=>messaging.purgeDevice(id)});
const savePhone=(id,input)=>numbering.save(id,input);

class Smartphone extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {id:'smartphone-rpg-window',classes:['smartphone-rpg'],window:{title:'Smartphone RPG',icon:'fa-solid fa-mobile-screen',resizable:true},position:{width:430,height:720}};
  constructor(options={}) { super(options); adminApp=this; }
  selected = null;
  admin = true;
  activeTab = 'devices';
  actorFilter = 'all';
  searchQuery = '';
  statusFilter = 'active';
  pendingOperations = new Set();
  draft = '';
  target = '';
  async _renderHTML() {
    const root = document.createElement('section');
    root.className = 'srpg-shell';
    const available = allPhones().map(phoneData).filter(p=>canUse(p,game.user));
    if (!available.some(p=>p.id===this.selected)) this.selected = available[0]?.id;
    const phone = getPhone(this.selected);
    const options = (list, selected) => list.map(p=>`<option value="${esc(p.id)}" ${p.id===selected?'selected':''}>${esc(p.name)}</option>`).join('');
    if (!game.user.isGM) {root.textContent='Painel exclusivo do mestre.';return root;}
    root.innerHTML = `<div class="srpg-status"><span>📶 Smartphone RPG</span><span>Administração</span></div>
      <nav aria-label="Administração"><button type="button" data-command="devices" aria-pressed="${this.activeTab==='devices'}">Aparelhos</button><button type="button" data-command="config" aria-pressed="${this.activeTab==='config'}">Cell Config</button><button type="button" data-command="player">Abrir celular</button></nav>`;
    if (this.activeTab === 'devices') {
      root.insertAdjacentHTML('beforeend',`<button type="button" data-command="new">Criar novo aparelho</button>${renderActorDirectory(allPhones().map(phoneData),this.actorFilter,game.actors,{query:this.searchQuery,status:this.statusFilter})}<button type="button" data-command="resume-deletions">Retomar exclusões interrompidas</button><button type="button" data-command="recover-lock">Recuperar bloqueio da numeração</button>`);
    } else {
      const edit = this.editId ? getPhone(this.editId) : null;
      root.insertAdjacentHTML('beforeend',`<form class="srpg-admin"><h3>${edit?'Editar aparelho':'Novo aparelho'}</h3>
        <label>Nome<input name="name" maxlength="80" required value="${esc(edit?.name ?? '')}"></label>
        <div class="srpg-number-fields srpg-three-numbers"><label>DDI<input name="countryCode" inputmode="numeric" maxlength="4" required value="+${esc(String(edit?.countryCode??game.settings.get(ID,'contactCountryCode')).replace(/^\+/,''))}"></label><label>DDD<input name="areaCode" inputmode="numeric" maxlength="5" required value="${esc(edit?partsOf(edit).areaCode:game.settings.get(ID,'contactAreaCode'))}"></label><label>Número local<input name="localNumber" inputmode="tel" maxlength="16" value="${esc(edit?partsOf(edit).localNumber:'')}" placeholder="98765-4321"></label></div><small>Número local vazio gera automaticamente. DDI: 1–3 dígitos; DDD: 1–5; local: 3–12. Os padrões não alteram aparelhos existentes.</small>
        ${renderActorLinkEditor(edit,game.actors)}
        ${renderAppSettings(edit)}
        <fieldset><legend>Acesso dos usuários (além dos GMs)</legend>${game.users.filter(u=>!u.isGM).map(u=>`<label><input type="checkbox" name="users" value="${esc(u.id)}" ${edit?.users.includes(u.id)?'checked':''}>${esc(u.name)}</label>`).join('')}</fieldset>
        <p>Administre a agenda pelo aplicativo Contatos deste aparelho.</p>
        <label><input type="checkbox" name="disabled" ${edit?.disabled?'checked':''}>Bloquear aparelho</label>
        <label><input type="checkbox" name="calendar" ${edit?.permissions?.calendar?'checked':''}>Permitir leitura de Simple Calendar</label>
        <button type="submit">Salvar aparelho</button><button type="button" data-command="devices">Cancelar / Voltar à lista</button>
        <p>As conversas pertencem aos aparelhos. O destinatário pode responder pela conversa recebida.</p></form>`);
    }
    attachPhoneMask(root.querySelector('[name="phoneNumber"]'),root.querySelector('[name="countryCode"]'));
    const updateDirectory=()=>{
      const current=root.querySelector('[data-phone-list]');
      if(!current) return;
      const temp=document.createElement('div');
      temp.innerHTML=renderActorDirectory(allPhones().map(phoneData),this.actorFilter,game.actors,{query:this.searchQuery,status:this.statusFilter});
      current.replaceChildren(...temp.querySelector('[data-phone-list]').childNodes);
    };
    root.querySelector('[data-actor-filter]')?.addEventListener('change',event=>{this.actorFilter=event.target.value;updateDirectory();});
    root.querySelector('[data-device-search]')?.addEventListener('input',event=>{this.searchQuery=event.target.value;updateDirectory();});
    root.querySelector('[data-status-filter]')?.addEventListener('change',event=>{this.statusFilter=event.target.value;updateDirectory();});
    root.querySelector('[name="actorUuid"]')?.addEventListener('change',event=>{root.querySelector('[data-actor-preview]').innerHTML=renderActorBadge({actorUuid:event.target.value||null},game.actors);});
    root.querySelector('[data-save-actor]')?.addEventListener('click',async event=>{
      const button=event.currentTarget;button.disabled=true;
      try {
        await numbering.setActorLink(this.editId,root.querySelector('[name="actorUuid"]').value||null);
        updateDirectory();refresh();ui.notifications.info('Vínculo salvo. Número e demais configurações preservados.');
      } catch(error){ui.notifications.error(error.message);}finally{button.disabled=false;}
    });
    root.querySelector('[name="body"]')?.addEventListener('input',e=>{this.draft=e.target.value;});
    root.querySelector('[name="to"]')?.addEventListener('change',e=>{this.target=e.target.value;});
    root.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',()=>{
      const command = button.dataset.command;
      if(command==='recover-lock') {numbering.recover().then(recovered=>{ui.notifications.info(recovered?'Bloqueio recuperado. Recarregue o mundo para retomar a migração.':'Nenhuma alteração no bloqueio.');}).catch(error=>ui.notifications.error(error.message));return;}
      if(command==='player') {open();return;}
      if(command==='resume-deletions') {
        foundry.applications.api.DialogV2.confirm({window:{title:'Retomar exclusões interrompidas'},content:'<p>Retomar exclusões definitivas já confirmadas anteriormente? As etapas restantes de limpeza serão executadas. Esta ação não restaura aparelhos.</p>'}).then(async confirmed=>{
          if(!confirmed) return;
          const count=await numbering.resumeDeletions();ui.notifications.info(`${count} exclusão(ões) concluída(s).`);this.render(true);refresh();
        }).catch(error=>ui.notifications.error(error.message));return;
      }
      if(command==='calendar') {
        try { const value=calendarNow(this.selected); ui.notifications.info(JSON.stringify(value)); } catch(e) {ui.notifications.warn(e.message);} return;
      }
      this.activeTab = command==='devices' ? 'devices' : 'config';
      if(command==='new') this.editId=null;
      this.render(true);
    }));
    root.addEventListener('click',event=>{const button=event.target.closest('[data-edit]');if(button&&root.contains(button)){this.editId=button.dataset.edit;this.activeTab='config';this.render(true);}});
    root.addEventListener('click',async event=>{
      const button=event.target.closest('[data-device-action]');
      if(!button || !root.contains(button) || !button.dataset.deviceAction || !game.user.isGM) return;
      const {id,deviceAction:action}=button.dataset;
      const phone=getPhone(id);
      if(!phone || this.pendingOperations.has(id)) return;
      if(action==='open') {open(id);return;}
      this.pendingOperations.add(id);button.disabled=true;
      try {
        if(action==='delete') {
          const name=await confirmDeletion(phone,game.actors,foundry.applications.api.DialogV2);
          if(name===null || name===undefined) return;
          await numbering.deletePhone(id,name);
          if(this.editId===id) this.editId=null;
          this.activeTab='devices';ui.notifications.info('Aparelho excluído definitivamente.');
          refresh();this.render(true);return;
        }
        if(action==='duplicate' || action==='archive') {
          const content=action==='duplicate'?`Duplicar ${esc(phone.name)}? As configurações e os dados do cadastro serão copiados, incluindo proprietário, acessos, contatos e PIN. A cópia terá ID e número próprios e uma grade de aplicativos padrão.`:`Arquivar ${esc(phone.name)}? Seus dados serão preservados e o número continuará reservado.`;
          if(!await foundry.applications.api.DialogV2.confirm({window:{title:action==='duplicate'?'Duplicar aparelho':'Arquivar aparelho'},content:`<p>${content}</p>`})) return;
        }
        if(action==='duplicate') {
          const doc=await numbering.duplicate(id);
          this.editId=doc.id;this.activeTab='config';
          ui.notifications.info(`Cópia criada: ${doc.name} · ${flag(doc).phoneNumber}`);
        } else if(action==='archive' || action==='restore') {
          await numbering.setArchived(id,action==='archive');
          ui.notifications.info(action==='archive'?'Aparelho arquivado. Dados e número preservados.':'Aparelho restaurado.');
        } else return;
        refresh();this.render(true);
      } catch(error){ui.notifications.error(error.message);}
      finally {this.pendingOperations.delete(id);button.disabled=false;}
    });
    root.querySelector('form')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const button=e.target.querySelector('[type="submit"]'); button.disabled=true;
      const data=new FormData(e.target);
      try {
        if (this.admin) {
          const doc=await savePhone(this.editId,{name:data.get('name'),countryCode:data.get('countryCode'),areaCode:data.get('areaCode'),localNumber:data.get('localNumber'),actorUuid:data.get('actorUuid')||null,users:data.getAll('users'),enabledApps:data.getAll('enabledApps'),disabled:data.has('disabled'),calendar:data.has('calendar')});
          this.editId=doc.id; this.selected=doc.id;
          this.activeTab='devices';
          ui.notifications.info(`Aparelho salvo: ${flag(doc).phoneNumber}`);
        } else {await send(this.selected,data.get('to'),data.get('body'));this.draft='';}
        this.render(true);
      } catch(error) {ui.notifications.error(error.message);button.disabled=false;}
    });
    return root;
  }
  _replaceHTML(result, content) { content.replaceChildren(result); const log=content.querySelector('.srpg-messages'); if(log) log.scrollTop=log.scrollHeight; }
}
const PlayerPhone=createPlayerPhoneClass({getMessaging:()=>messaging?.view??{phones:{}},messageAction:(...args)=>messaging.request(...args),getContactDefaults:()=>contactDefaults({countryCode:game.settings.get(ID,'contactCountryCode'),areaCode:game.settings.get(ID,'contactAreaCode')}),allPhones,phoneData,getPhone,messageBody,getActorName:phone=>describeActorLink(phone,game.actors).name,getClock,calendarNow,send,openAdmin,requestAction:requestDeviceAction,setApp:value=>{app=value;}});
function calendarNow(phoneId) {
  const phone=getPhone(phoneId);
  requireApp(phone,game.user,'calendar');
  if (!canUse(phone,game.user) || phone.archived || !phone.permissions?.calendar) throw Error('Leitura do calendário não autorizada pelo GM.');
  const active = game.modules.get('foundryvtt-simple-calendar-reborn')?.active || game.modules.get('foundryvtt-simple-calendar')?.active;
  if (!active || typeof globalThis.SimpleCalendar?.api?.currentDateTime!=='function') throw Error('Simple Calendar não está ativo ou sua API não está disponível.');
  return foundry.utils.deepClone(globalThis.SimpleCalendar.api.currentDateTime());
}
Hooks.once('init',()=>{
  game.settings.register(ID,'contactCountryCode',{name:'DDI padrão para novos celulares',hint:'DDI de 1 a 3 dígitos para novos aparelhos e contatos. Não altera números existentes.',scope:'world',config:true,type:new foundry.data.fields.StringField({required:true,blank:false,validate:value=>{code(value,3,'DDI');return true;}}),default:'+55',onChange:refresh});
  game.settings.register(ID,'contactAreaCode',{name:'DDD padrão para novos celulares',hint:'DDD de 1 a 5 dígitos para novos aparelhos e contatos. Não altera números existentes.',scope:'world',config:true,type:new foundry.data.fields.StringField({required:true,blank:false,validate:value=>{code(value,5,'DDD');return true;}}),default:'11',onChange:refresh});
  game.settings.register(ID,'numberPattern',{name:'Padrão de números fictícios',hint:'10 ou 11 posições. Dígitos fixos e # para posições aleatórias. Exemplo: 119########.',scope:'world',config:true,type:String,default:DEFAULT_PATTERN});
  game.settings.register(ID,'numberLockParent',{scope:'world',config:false,type:String,default:''});
  game.settings.register(ID,'devices',{scope:'world',config:false,type:Array,default:[],onChange:refresh});
  game.settings.register(ID,'messagingVault',{scope:'world',config:false,type:Object,default:{},onChange:()=>messaging?.updateView().catch(error=>ui.notifications.error(error.message))});
  game.settings.register(ID,'worldClock',{scope:'world',config:false,type:Object,default:{},onChange:()=>app?.tickClock()});
  game.settings.registerMenu(ID,'open',{name:'Smartphone RPG — Administração',label:'Gerenciar aparelhos',hint:'Painel do mestre: aparelhos, acessos e contatos.',icon:'fas fa-sliders',type:Smartphone,restricted:true});
  game.settings.registerMenu(ID,'player',{name:'Smartphone RPG — Meu celular',label:'Abrir meu celular',hint:'Também disponível no botão de celular junto às ferramentas de tokens e em Alt+P.',icon:'fas fa-mobile-screen',type:PlayerPhone,restricted:false});
  game.keybindings.register(ID,'open',{name:'Abrir Smartphone RPG',editable:[{key:'KeyP',modifiers:['Alt']}],onDown:()=>{open();return true;}});
});
function open(phoneId) {app ??= new PlayerPhone();if(typeof phoneId==='string' && canUse(getPhone(phoneId),game.user)){app.selectPhone(phoneId);}return app.render(true);}
function openAdmin(phoneId) {if(!game.user.isGM) return;adminApp ??= new Smartphone();adminApp.activeTab=getPhone(phoneId)?'config':'devices';if(adminApp.activeTab==='config') adminApp.editId=phoneId;return adminApp.render(true);}
function refresh() {
  updateBadge();
  if(app) for(const key of app.drafts.keys()) if(key.split(':').some(id=>id && id!=='null' && (!getPhone(id)||getPhone(id).deletionPending||getPhone(id).archived))) app.drafts.delete(key);
  if(app?.dragging){app.pendingRefresh=true;return;}
  if(app?.rendered&&!app.closing) app.render(true);
}
Hooks.on('getSceneControlButtons',controls=>{
  if(!controls.tokens) return;
  controls.tokens.tools['smartphone-rpg']={name:'smartphone-rpg',title:'Meu celular · Smartphone RPG',icon:'fa-solid fa-mobile-screen',order:90,button:true,visible:true,onChange:()=>open()};
});
Hooks.on('renderSceneControls',()=>updateBadge());
Hooks.on('smartphoneRPGPhoneSelected',()=>updateBadge());
Hooks.once('ready',()=>{
  messaging=createMessagingBridge({numbering,isLeader,getPhones:()=>new Map(allPhones().map(phoneData).map(p=>[p.id,p])),refresh,onResult:result=>app?.acceptVisualResult(result),legacyMessages:()=>game.messages.filter(m=>m.author?.isGM&&flag(m)?.kind==='delivery').map(m=>({...flag(m),id:m.id,at:m.timestamp,body:messageBody(m)})).sort((a,b)=>a.at-b.at),legacyPending:()=>game.messages.filter(m=>flag(m)?.kind==='request'&&m.author&&m.whisper.includes(game.user.id)&&!game.messages.some(result=>result.author?.isGM&&flag(result)?.requestId===m.id&&['delivery','rejected'].includes(flag(result)?.kind))).map(m=>({...flag(m),id:m.id,author:m.author.id,at:m.timestamp,body:messageBody(m)}))});
  game.modules.get(ID).api=Object.freeze({open,openAdmin,send,calendarNow,savePhone,duplicatePhone:id=>numbering.duplicate(id),setArchived:(id,archived)=>numbering.setArchived(id,archived),deletePhone:(id,name)=>numbering.deletePhone(id,name),resumeDeletions:()=>numbering.resumeDeletions(),inspectIntegrity:()=>numbering.inspectIntegrity(),setActorLink:(id,uuid)=>numbering.setActorLink(id,uuid),migrateActorLinks:()=>numbering.migrateActors(),migrateNumbers:()=>numbering.migrate(),recoverNumberLock:()=>numbering.recover(),clock:getClock,saveLayout:(id,layout)=>requestDeviceAction(id,'layout',{layout}),saveAppearance:(id,appearance)=>requestDeviceAction(id,'appearance',appearance),listNotifications:id=>[...notificationsFor(getPhone(id),game.user),...(messaging?.view.phones[id]?.notifications??[])],markNotificationRead:(id,noteId)=>{const note=messaging?.view.phones[id]?.notifications.find(n=>n.id===noteId);return note?messaging.request(id,'read',{conversation:note.conversation,through:note.seq}):requestDeviceAction(id,'notification-read',{id:noteId});},addNotification:(id,input)=>numbering.addNotification(id,input),getAppCatalog:()=>APP_CATALOG.map(app=>({...app})),openApp:(id,screen)=>{if(app?.selected!==id)throw Error('Abra este aparelho primeiro.');return app.launch(screen);},messageAction:(...args)=>messaging.request(...args),messagingView:()=>messaging.view,version:'0.8.0'});
  if(isLeader()) (async()=>{
    const integrity=await numbering.inspectIntegrity();
    const pending=Object.values(integrity.deletions).filter(job=>job.result==='pending').length;
    if(pending) ui.notifications.warn(`Smartphone RPG: ${pending} exclusão(ões) interrompida(s). Use Retomar exclusões interrompidas na administração.`);
    await numbering.initializeClock();
    const count=await numbering.migrate();
    const links=await numbering.migrateActors();
    if(count) ui.notifications.info(`Smartphone RPG: numeração atualizada em ${count} aparelho(s).`);
    if(links) ui.notifications.info(`Smartphone RPG: vínculos atualizados em ${links} aparelho(s).`);
    await messaging.start();refresh();
  })().catch(error=>ui.notifications.error(`Smartphone RPG — inicialização: ${error.message}`));
  if(!isLeader())messaging.start().catch(error=>ui.notifications.error(`Smartphone RPG — mensagens: ${error.message}`));
});
Hooks.on('updateUser',(_user,changes)=>{refresh();if(changes?.flags?.[ID]||Object.keys(changes??{}).some(k=>k.startsWith('flags.'+ID))||'role' in (changes??{}))messaging?.sync().catch(error=>console.error(error));});
Hooks.on('userConnected',()=>messaging?.sync().catch(error=>console.error(error)));
Hooks.on('updateJournalEntry',(_doc,changes)=>{if(changes?.ownership||changes?.flags?.[ID]?.data||Object.keys(changes??{}).some(k=>k.startsWith('flags.'+ID+'.data')))messaging?.sync().catch(error=>console.error(error));});
for (const event of ['createJournalEntry','updateJournalEntry','deleteJournalEntry']) Hooks.on(event,refresh);
const refreshActorViews=()=>{refresh();if(adminApp?.rendered) adminApp.render(true);};
Hooks.on('createActor',refreshActorViews);
Hooks.on('deleteActor',refreshActorViews);
Hooks.on('updateActor',(_actor,changes)=>{if('name' in changes || 'img' in changes) refreshActorViews();});


for(const hook of ['simple-calendar-date-time-change','simple-calendar-clock-start-stop','simple-calendar-ready','updateWorldTime'])Hooks.on(hook,()=>app?.tickClock());

// Preserve legacy documents while excluding their old transport notices from the traditional chat UI.
Hooks.on('renderChatMessageHTML',(doc,html)=>{if(['request','delivery','rejected','device-action','device-action-result'].includes(flag(doc)?.kind)){html.hidden=true;html.classList.add('srpg-legacy-chat-hidden');}});

Hooks.on('createJournalEntry',doc=>{if(flag(doc)?.kind==='phone')messaging?.sync().catch(error=>console.error(error));});
