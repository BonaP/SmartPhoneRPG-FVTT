import {contactsFor,contactDefaults} from './contacts.mjs';
import {attachPhoneMask} from './phone-mask.mjs';
import {ID,canUse} from './core.mjs';
import {renderDevice} from './device-view.mjs';
import {PhoneNavigation,isAppEnabled,layoutFor,requireApp,needsAuthentication} from './apps.mjs';
import {appearanceOf,validateAppearance,DEFAULT_APPEARANCE,notificationsFor} from './presentation.mjs';
import {attachLauncher} from './launcher.mjs';

export function createPlayerPhoneClass({getMessaging=()=>({phones:{}}),messageAction,getContactDefaults=()=>contactDefaults(),allPhones,phoneData,getPhone,messageBody,getActorName,getClock,calendarNow,send,openAdmin,requestAction,setApp}) {
  return class PlayerPhone extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS={id:'smartphone-rpg-device',classes:['smartphone-rpg-device'],window:{title:'Meu celular',icon:'fa-solid fa-mobile-screen',resizable:true},position:{width:400,height:740}};
    constructor(options={}){super(options);setApp(this);}
    selected=null;nav=new PhoneNavigation();target=null;drafts=new Map();organizing=false;notificationsOpen=false;
    contactEditor=false;contactQuery='';groupEditor=false;readRequests=new Set();pendingConversation=null;
    appearanceDrafts=new Map();layoutPreviews=new Map();pendingVisual=new Map();failedImages=new Set();
    selectPhone(id){this.selected=id;this.nav.lock();this.target=null;this.notificationsOpen=false;this.organizing=false;this.contactEditor=false;this.contactQuery='';this.groupEditor=false;this.pendingConversation=null;}
    get screen(){return this.nav.screen;}
    launch(id){this.nav.open(getPhone(this.selected),game.user,id);this.organizing=false;this.notificationsOpen=false;this.render(true);}
    _getHeaderControls(){
      const controls=super._getHeaderControls();
      if(game.user.isGM&&(getPhone(this.selected)||allPhones().length))controls.push({action:'cellConfig',label:'Cell Config',icon:'fa-solid fa-sliders',onClick:()=>{const id=getPhone(this.selected)?.id??allPhones()[0]?.id;if(game.user.isGM&&id)return openAdmin(id);}});
      return controls;
    }
    async saveVisual(id,action,payload) {
      const result=await requestAction(id,action,payload);
      if(result.pending){this.pendingVisual.set(result.requestId,{id,action});ui.notifications.info('Solicitação enviada ao GM. A alteração ainda aguarda confirmação.');}
      else {if(action==='appearance')this.appearanceDrafts.delete(id);if(action==='layout')this.layoutPreviews.delete(id);ui.notifications.info('Configuração do aparelho salva.');}
      return result;
    }
    acceptVisualResult(result) {
      const pending=this.pendingVisual.get(result.requestId);if(!pending)return;
      this.pendingVisual.delete(result.requestId);
      if(pending.action==='appearance')this.appearanceDrafts.delete(pending.id);
      if(pending.action==='layout')this.layoutPreviews.delete(pending.id);
      if(result.success)ui.notifications.info('Alteração confirmada e salva pelo GM.');else ui.notifications.error(result.reason??'Alteração recusada.');
    }
    tickClock(){
      const clock=getClock();
      this.clockRoot?.querySelectorAll('[data-clock-time]').forEach(node=>node.textContent=clock.time);
      this.clockRoot?.querySelectorAll('[data-clock-date]').forEach(node=>node.textContent=clock.date);
    }
    async _renderHTML(){
      this.dragCleanup?.();
      const available=allPhones().map(phoneData).filter(phone=>canUse(phone,game.user));
      if(!available.some(phone=>phone.id===this.selected))this.selectPhone(available[0]?.id);
      const raw=getPhone(this.selected);
      const messagingData=getMessaging().phones[this.selected]??{contacts:[],conversations:[],notifications:[]};
      const phone=raw?{...raw,contacts:messagingData.contacts,...(this.layoutPreviews.has(raw.id)?{appLayout:this.layoutPreviews.get(raw.id)}:{})}:null;
      if(this.pendingConversation?.phone===this.selected){const pending=this.pendingConversation;const conv=messagingData.conversations.find(c=>pending.group?c.group&&c.name===pending.name:c.members.some(m=>m.number===pending.number));if(conv){this.target=conv.id;this.pendingConversation=null;}}
      if(!messagingData.conversations.some(c=>c.id===this.target))this.target=null;
      if(!this.nav.locked && this.screen!=='home' && !isAppEnabled(phone,this.screen))this.nav.home();
      if(phone?.archived||phone?.disabled||needsAuthentication(phone))this.nav.lock();
      const key=`${this.selected}:${this.target}`,entries=[];
      let calendar;if(this.screen==='calendar'&&phone){try{calendar=calendarNow(phone.id);}catch(error){calendar={error:error.message};}}
      let notes=[];if(phone&&!this.nav.locked)try{notes=[...messagingData.notifications,...notificationsFor(phone,game.user)];}catch{}
      const root=document.createElement('section');root.className=`srpg-player-root${this.organizing?' srpg-organizing':''}`;
      root.innerHTML=renderDevice({isGM:game.user.isGM,messagingData,contactEditor:this.contactEditor,contactQuery:this.contactQuery,groupEditor:this.groupEditor,phone,phones:available,screen:this.screen,locked:this.nav.locked,target:this.target,entries,draft:this.drafts.get(key)??'',online:game.users.some(user=>user.isGM&&user.active),actorName:getActorName(phone),calendar,clock:getClock(),organizing:this.organizing,notificationsOpen:this.notificationsOpen,notifications:notes,contactDefaults:getContactDefaults(),appearanceDraft:this.appearanceDrafts.get(this.selected)});
      const safe=fn=>(...args)=>{try{return fn(...args);}catch(error){ui.notifications.warn(error.message);}};
      root.querySelector('[data-phone]')?.addEventListener('change',event=>{this.selectPhone(event.target.value);this.render(true);});
      root.querySelector('[data-unlock]')?.addEventListener('click',safe(()=>{this.nav.unlock(getPhone(this.selected),game.user);this.render(true);}));
      root.querySelector('[data-lock-screen]')?.addEventListener('click',()=>{this.appearanceDrafts.delete(this.selected);this.nav.lock();this.organizing=false;this.notificationsOpen=false;this.render(true);});
      root.querySelector('[data-home]')?.addEventListener('click',()=>{this.appearanceDrafts.delete(this.selected);this.nav.home();this.target=null;this.notificationsOpen=false;this.render(true);});
      root.querySelector('[data-back]')?.addEventListener('click',()=>{
        if(this.notificationsOpen)this.notificationsOpen=false;
        else if(this.screen==='messages'&&this.target)this.target=null;
        else {if(this.screen==='personalization')this.appearanceDrafts.delete(this.selected);this.nav.back();}
        this.render(true);
      });
      root.querySelectorAll('[data-screen]').forEach(button=>button.addEventListener('click',safe(()=>this.launch(button.dataset.screen))));
      root.querySelectorAll('[data-contact]').forEach(button=>button.addEventListener('click',safe(()=>{requireApp(getPhone(this.selected),game.user,'messages');if(this.screen!=='messages')this.nav.open(getPhone(this.selected),game.user,'messages');this.target=button.dataset.contact;this.render(true);})));
      root.querySelector('[data-back-conversations]')?.addEventListener('click',()=>{this.target=null;this.render(true);});
      root.querySelectorAll('[data-notifications]').forEach(button=>button.addEventListener('click',()=>{if(this.nav.locked)return;this.notificationsOpen=!this.notificationsOpen;this.render(true);}));
      root.querySelectorAll('[data-read-notification]').forEach(button=>button.addEventListener('click',async()=>{try{await this.saveVisual(phone.id,'notification-read',{id:button.dataset.readNotification});if(this.rendered&&!this.closing)this.render(true);}catch(error){ui.notifications.error(error.message);}}));
      root.querySelector('[data-finish-organize]')?.addEventListener('click',()=>{this.organizing=false;this.render(true);});
      this.dragCleanup=attachLauncher(root,{getLayout:()=>this.layoutPreviews.get(phone.id)??layoutFor(getPhone(phone.id)),onOrganize:value=>{this.organizing=value;},onDragging:value=>{
        this.dragging=value;
        if(!value&&this.pendingRefresh&&!this.closing){this.pendingRefresh=false;queueMicrotask(()=>{if(this.rendered&&!this.dragging&&!this.closing)this.render(true);});}
      },onMove:async layout=>{
        this.layoutPreviews.set(phone.id,layout);
        try{await this.saveVisual(phone.id,'layout',{layout});}catch(error){this.layoutPreviews.delete(phone.id);ui.notifications.error(error.message);}if(this.rendered&&!this.closing)this.render(true);
      }});
      root.querySelector('[name="body"]')?.addEventListener('input',event=>this.drafts.set(key,event.target.value));
      this.attachMessaging(root,phone,messagingData);
      this.attachAppearance(root,phone);
      root.querySelectorAll('img').forEach(image=>{
        const path=image.getAttribute('src');
        if(!path||this.failedImages.has(path)){image.hidden=true;if(path)image.removeAttribute('src');}
        image.addEventListener('error',()=>{image.hidden=true;const failed=image.getAttribute('src');if(failed)this.failedImages.add(failed);});
        image.addEventListener('load',()=>{if(image.getAttribute('src'))image.hidden=false;});
      });
      return root;
    }
    attachMessaging(root,phone,data){
      if(!phone)return;
      const run=async(action,payload)=>{try{const result=await this.saveVisual(phone.id,action,payload);if(this.rendered&&!this.closing)this.render(true);return result;}catch(error){ui.notifications.error(error.message);return null;}};
      const action=async(kind,payload)=>{try{const result=await messageAction(phone.id,kind,payload);if(result.pending){this.pendingVisual.set(result.requestId,{id:phone.id,action:kind});ui.notifications.info('Operação pendente de confirmação do GM.');}if(this.rendered&&!this.closing)this.render(true);return result;}catch(error){ui.notifications.error(error.message);return null;}};
      const openConversation=id=>{this.nav.open(getPhone(phone.id),game.user,'messages');this.target=id;this.notificationsOpen=false;this.groupEditor=false;this.render(true);};
      root.querySelectorAll('[data-conversation],[data-notification-conversation]').forEach(button=>button.addEventListener('click',()=>{try{openConversation(button.dataset.conversation??button.dataset.notificationConversation);}catch(error){ui.notifications.warn(error.message);}}));
      root.querySelectorAll('[data-read-notification]').forEach(button=>{const note=data.notifications.find(n=>n.id===button.dataset.readNotification);if(note){button.replaceWith(button.cloneNode(true));root.querySelector('[data-read-notification="'+note.id+'"]')?.addEventListener('click',()=>action('read',{conversation:note.conversation,through:note.seq}));}});
      root.querySelector('[data-add-contact]')?.addEventListener('click',()=>{this.contactEditor=true;this.render(true);});
      root.querySelector('[data-cancel-contact]')?.addEventListener('click',()=>{this.contactEditor=false;this.render(true);});
      root.querySelector('[data-contact-search]')?.addEventListener('input',event=>{this.contactQuery=event.target.value;const q=this.contactQuery.toLocaleLowerCase();root.querySelectorAll('.srpg-contact-card').forEach(card=>{card.hidden=!card.textContent.toLocaleLowerCase().includes(q)&&!card.textContent.replace(/\D/g,'').includes(q.replace(/\D/g,'')||'!');});});
      root.querySelectorAll('[data-edit-agenda]').forEach(button=>button.addEventListener('click',()=>{this.contactEditor=data.contacts.find(c=>c.id===button.dataset.editAgenda);this.render(true);}));
      root.querySelectorAll('[data-delete-contact]').forEach(button=>button.addEventListener('click',()=>action('contact-delete',{id:button.dataset.deleteContact})));
      const form=root.querySelector('.srpg-contact-editor');form?.addEventListener('submit',async event=>{event.preventDefault();const payload=Object.fromEntries(new FormData(form));if(!payload.id)delete payload.id;const result=await action('contact-save',payload);if(result){this.contactEditor=false;if(this.rendered&&!this.closing)this.render(true);}});
      root.querySelector('[data-pick-contact-photo]')?.addEventListener('click',()=>{new foundry.applications.apps.FilePicker({type:'image',allowUpload:false,callback:path=>{form.elements.photo.value=path;}}).render(true);});
      root.querySelectorAll('[data-message-contact]').forEach(button=>button.addEventListener('click',async()=>{const c=data.contacts.find(c=>c.id===button.dataset.messageContact);if(!c)return;const result=await action('private-open',{number:c.number});if(result){this.pendingConversation={phone:phone.id,number:c.number};this.nav.open(getPhone(phone.id),game.user,'messages');this.render(true);}}));
      root.querySelector('[data-new-group]')?.addEventListener('click',()=>{this.groupEditor=true;this.render(true);});
      root.querySelector('[data-cancel-group]')?.addEventListener('click',()=>{this.groupEditor=false;this.render(true);});
      const members=form=>[...new FormData(form).getAll('members'),...String(new FormData(form).get('numbers')??'').split(/[,;\n]+/).map(s=>s.replace(/\D/g,'')).filter(Boolean)];
      root.querySelector('.srpg-group-create')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.target,values=new FormData(form),name=values.get('name');const result=await action('group-create',{name,photo:values.get('photo'),members:members(form)});if(result){this.groupEditor=false;this.pendingConversation={phone:phone.id,group:true,name};if(this.rendered&&!this.closing)this.render(true);}});
      root.querySelector('.srpg-group-edit')?.addEventListener('submit',event=>{event.preventDefault();const form=event.target,values=new FormData(form);action('group-edit',{conversation:form.dataset.conversationId,name:values.get('name'),photo:values.get('photo'),members:members(form)});});
      root.querySelector('[data-leave-group]')?.addEventListener('click',event=>action('group-leave',{conversation:event.currentTarget.dataset.leaveGroup}));
      root.querySelector('.srpg-device-compose')?.addEventListener('submit',async event=>{event.preventDefault();const key=phone.id+':'+this.target;const button=event.target.querySelector('[type="submit"]');button.disabled=true;const result=await action('message-send',{conversation:this.target,body:new FormData(event.target).get('body')});if(result){this.drafts.delete(key);if(this.rendered&&!this.closing)this.render(true);}button.disabled=false;});
      const conv=data.conversations.find(c=>c.id===this.target);if(!this.nav.locked&&this.screen==='messages'&&conv?.unread){const through=conv.messages.at(-1)?.seq??0,key=phone.id+':'+conv.id+':'+through;if(!this.readRequests.has(key)){this.readRequests.add(key);requestAnimationFrame(()=>{if(root.isConnected&&!this.closing&&!this.nav.locked&&this.target===conv.id&&document.visibilityState!=='hidden')action('read',{conversation:conv.id,through});else this.readRequests.delete(key);});}}
    }
    attachAppearance(root,phone){
      const form=root.querySelector('.srpg-appearance-form');if(!form)return;
      const read=()=>validateAppearance(Object.fromEntries(new FormData(form).entries()));
      const preview=()=>{
        try {
          const value=read();this.appearanceDrafts.set(phone.id,value);const device=root.querySelector('.srpg-device');
          device.style.setProperty('--srpg-primary',value.primaryColor);device.style.setProperty('--srpg-accent',value.accentColor);device.dataset.theme=value.theme;
          for(const key of ['homeWallpaper','lockWallpaper']){const image=root.querySelector(`[data-wallpaper-preview="${key}"] img`);image.hidden=!value[key]||this.failedImages.has(value[key]);if(!value[key])image.removeAttribute('src');else if(!this.failedImages.has(value[key])&&image.getAttribute('src')!==value[key])image.src=value[key];}
        }catch{/* The save handler presents validation errors; preserve the last valid preview. */}
      };
      form.addEventListener('input',preview);form.addEventListener('change',preview);
      root.querySelector('[data-reset-colors]')?.addEventListener('click',()=>{for(const key of ['primaryColor','accentColor','theme'])form.elements[key].value=DEFAULT_APPEARANCE[key];preview();});
      root.querySelectorAll('[data-reset-wallpaper]').forEach(button=>button.addEventListener('click',()=>{form.elements[button.dataset.resetWallpaper].value='';preview();}));
      root.querySelectorAll('[data-pick-wallpaper]').forEach(button=>button.addEventListener('click',async()=>{
        try {
          const key=button.dataset.pickWallpaper;const Picker=foundry.applications.apps.FilePicker;
          await new Picker({type:'image',current:form.elements[key].value,allowUpload:false,callback:path=>{if(this.selected!==phone.id)return;form.elements[key].value=path;this.failedImages.delete(path);root.querySelector(`[data-wallpaper-preview="${key}"] img`).removeAttribute('src');preview();}}).render(true);
        } catch(error){ui.notifications.warn(`Biblioteca de imagens indisponível: ${error.message}`);}
      }));
      form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;
        try{await this.saveVisual(phone.id,'appearance',read());if(this.rendered&&!this.closing)this.render(true);}catch(error){ui.notifications.error(error.message);button.disabled=false;}
      });
    }
    _replaceHTML(result,content){
      const oldLog=content.querySelector('.srpg-chat-log'),nearBottom=!oldLog||oldLog.scrollHeight-oldLog.scrollTop-oldLog.clientHeight<60,previousScroll=oldLog?.scrollTop??0;
      const focused=content.querySelector('[name="body"]'),restoreFocus=focused&&document.activeElement===focused,selection=restoreFocus?[focused.selectionStart,focused.selectionEnd]:null;
      content.replaceChildren(result);this.clockRoot=result;this.tickClock();Hooks.callAll('smartphoneRPGPhoneSelected',this.selected);
      if(!this.clockTimer){this.clockTimer=setInterval(()=>this.tickClock(),1000);this.clockTimer.unref?.();}
      const log=content.querySelector('.srpg-chat-log');if(log)log.scrollTop=nearBottom?log.scrollHeight:previousScroll;
      if(restoreFocus){const input=content.querySelector('[name="body"]');input?.focus();input?.setSelectionRange(...selection);}
    }
    async close(options){this.closing=true;clearInterval(this.clockTimer);this.clockTimer=null;this.dragCleanup?.();this.pendingRefresh=false;this.nav.lock();this.appearanceDrafts.clear();this.layoutPreviews.clear();this.organizing=false;try{return await super.close(options);}finally{this.closing=false;}}
  };
}
