import {ID,text} from './core.mjs';
import {createNumberingService,DEFAULT_PATTERN} from './numbering.mjs';
import {createLifecycleService,assertDeviceIds,assertImmutableInput,assertRestorable,invalidateSessions} from './lifecycle.mjs';
import {prepareActorLink,existingActorFields} from './actor-links.mjs';
import {duplicateInput,archivePatch} from './device-management.mjs';
import {validateEnabledApps} from './apps.mjs';
import {presentationPatch,notificationRecord,notificationsFor} from './presentation.mjs';
import {createClockAnchor,validClockAnchor} from './clock.mjs';
export const LOCK_ID='srpgPhoneWrite01';
const flag=doc=>doc?.getFlag(ID,'data');
const gmOwnership=()=>({default:0,...Object.fromEntries(game.users.map(u=>[u.id,u.isGM?3:0]))});
export function createLocalWriteQueue() {
  let tail=Promise.resolve();
  return task=>{
    const result=tail.then(task);
    tail=result.catch(()=>{});
    return result;
  };
}
// The v14 server serializes mutations and rejects duplicate IDs in an embedded
// collection. Never use a top-level deterministic ID as a uniqueness constraint:
// v14's top-level keepId create can overwrite an existing record.
export async function withEmbeddedLock(parent,task,{owner,token}) {
  let acquired=false;
  let lockPage;
  try {
    let created;
    try {created=await parent.createEmbeddedDocuments('JournalEntryPage',[{_id:LOCK_ID,name:'Smartphone RPG · gravação em andamento',type:'text',ownership:gmOwnership(),flags:{[ID]:{writeLock:{owner,token,createdAt:Date.now()}}}}],{keepId:true,render:false});}
    catch(error){throw Error('Numeração ocupada ou bloqueio indisponível. Aguarde o outro salvamento e tente novamente. Se persistir após reiniciar, consulte a recuperação no manual.',{cause:error});}
    if(created?.length!==1 || created[0].id!==LOCK_ID) throw Error('Não foi possível adquirir o bloqueio de numeração. Nenhum salvamento iniciado.');
    lockPage=created[0];
    acquired=true;
    return await task();
  } finally {
    // database.get returns detached snapshots. Creation responses are attached
    // to the live world collection, so delete the returned page itself, never
    // look it up in the stale snapshot's EmbeddedCollection.
    if(acquired) {
      await lockPage.delete({render:false});
      if(parent.pages?.get?.(LOCK_ID)?.getFlag(ID,'writeLock')?.token===token) throw Error('O bloqueio de gravação não foi liberado. Verifique o resultado da operação e use Recuperar bloqueio da numeração após encerrar as sessões anteriores.');
    }
  }
}
export async function recoverEmbeddedLock(parent,{backup,confirm}) {
  const page=parent.pages.get(LOCK_ID);
  if(!page) return false;
  const lock=page.getFlag(ID,'writeLock');
  if(!lock?.owner || !lock?.token) throw Error('Página de bloqueio não reconhecida. Nenhuma página foi excluída.');
  const originalToken=lock.token;
  if(!await confirm()) return false;
  await backup(parent,'number-lock-recovery');
  if(parent.pages.get(LOCK_ID)!==page || page.getFlag(ID,'writeLock')?.token!==originalToken) throw Error('O bloqueio mudou durante a recuperação. Tente novamente.');
  await page.delete({render:false});
  return true;
}
export function createFoundryNumbering({isLeader,purgeMessaging=async()=>{}}) {
  const Journal=()=>foundry.documents.JournalEntry;
  const all=()=>Journal().database.get(Journal(),{query:{}});
  const setting=async key=>{
    const C=CONFIG.Setting.documentClass;
    const docs=await C.database.get(C,{query:{key:`${ID}.${key}`}});
    return docs[0]?.value;
  };
  const backup=async(phone,reason)=>{
    const original=phone.doc??phone;
    const snapshot=original.toObject();
    const result=await Journal().create({name:`Backup Smartphone ${original.name} ${new Date().toISOString()}`,ownership:gmOwnership(),flags:{[ID]:{data:{kind:'backup',schema:1,source:original.id,reason,snapshot}}}},{render:false});
    if(!result) throw Error('Não foi possível preservar o aparelho antes da alteração.');
  };
  async function initialize() {
    if(!game.user.isGM) throw Error('Somente o GM pode inicializar a numeração.');
    const configured=await setting('numberLockParent');
    let docs=await all();
    if(configured) {
      const parent=docs.find(d=>d.id===configured);
      if(!parent?.getFlag(ID,'numberLockAnchor')) throw Error('Diário de controle da numeração ausente ou alterado. Restaure-o do backup; não recrie para contornar um bloqueio.');
      const live=game.journal.get(parent.id);
      if(!live) throw Error('Diário de numeração ainda não está sincronizado. Recarregue o mundo.');
      return live;
    }
    if(!isLeader()) throw Error('Aguarde o GM principal inicializar a numeração neste mundo.');
    const markers=docs.filter(d=>d.getFlag(ID,'numberLockAnchor'));
    if(markers.length>1) throw Error('Há mais de um diário de controle. Restaure a configuração de numeração antes de salvar.');
    let parent=markers[0];
    if(!parent) {
      const registered=await setting('devices') ?? [];
      parent=docs.filter(d=>registered.includes(d.id) && flag(d)?.kind==='phone').sort((a,b)=>a.id.localeCompare(b.id))[0];
      if(parent) {await backup(parent,'numbering-anchor');await parent.setFlag(ID,'numberLockAnchor',true);}
      else {
        // Bootstrap only, before any device saves are accepted. A fresh world
        // must initialize with one GM session; subsequent writes use the server lock.
        if(game.users.filter(u=>u.isGM&&u.active).length!==1) throw Error('Primeira inicialização em mundo vazio: mantenha apenas um GM conectado e recarregue.');
        parent=await Journal().create({name:'Smartphone RPG · Controle de numeração (não excluir)',ownership:gmOwnership(),flags:{[ID]:{numberLockAnchor:true,data:{kind:'number-ledger',schema:1}}}},{render:false});
        if(!parent) throw Error('Não foi possível inicializar o controle de numeração.');
      }
    }
    await game.settings.set(ID,'numberLockParent',parent.id);
    const live=game.journal.get(parent.id);
    if(!live) throw Error('Diário de numeração ainda não está sincronizado. Recarregue o mundo.');
    return live;
  }
  const init=()=>globalThis.navigator?.locks? navigator.locks.request(`smartphone-rpg-init-${game.world?.id??'world'}`,initialize):initialize();
  const serialize=createLocalWriteQueue();
  const withLock=task=>serialize(async()=>withEmbeddedLock(await init(),task,{owner:game.user.id,token:foundry.utils.randomID()}));
  const list=async()=>{
    const registered=await setting('devices') ?? [];
    const phones=(await all()).filter(doc=>flag(doc)?.kind==='phone' && (registered.includes(doc.id)||game.users.get(doc._stats?.createdBy)?.isGM)).map(doc=>({id:doc.id,name:doc.name,data:foundry.utils.deepClone(flag(doc)),doc}));
    assertDeviceIds(phones,registered);return phones;
  };
  const requireAvailable=phone=>{if(phone?.data.deletionPending) throw Error('Aparelho em exclusão. Use Retomar exclusões interrompidas.');};
  const service=createNumberingService({
    isGM:()=>game.user.isGM,
    defaults:()=>({countryCode:game.settings.get(ID,'contactCountryCode')||'55',areaCode:game.settings.get(ID,'contactAreaCode')||'11'}),
    pattern:()=>game.settings.get(ID,'numberPattern')||DEFAULT_PATTERN,
    withLock,
    list,backup,
    validateInput:assertImmutableInput,
    duplicateInput,
    patchNumber:async(phone,patch)=>phone.doc.update(Object.fromEntries(Object.entries(patch).map(([key,value])=>[`flags.${ID}.data.${key}`,value])),{render:false}),
    prepare:async(existing,input,number,duplicateSource)=>{
      requireAvailable(existing);requireAvailable(duplicateSource);
      if(duplicateSource) {
        const data=foundry.utils.deepClone(duplicateSource.data);
        delete data.id;delete data._id;
        delete data.appLayout;
        data.agendaCopySource=duplicateSource.id;
        Object.assign(data,number);
        return {name:text(input.name,80),ownership:foundry.utils.deepClone(duplicateSource.doc.ownership),[`flags.${ID}.data`]:data};
      }
      const before=existing?.data??{};
      const actorLink=prepareActorLink(input,before,game.actors);
      const users=input.users===undefined?(before.users??[]):[...new Set(input.users)].filter(id=>game.users.has(id));
      const known=await list();
      const contacts=input.contacts===undefined?(before.contacts??[]):[...new Set(input.contacts)].filter(id=>id!==existing?.id && known.some(p=>p.id===id)).map(id=>({id,name:known.find(p=>p.id===id).name}));
      const data={...before,...(!existing && input.personalization?{personalization:foundry.utils.deepClone(input.personalization)}:{}),schema:before.schema??1,kind:'phone',...actorLink,users,contacts,disabled:input.disabled??before.disabled??false,permissions:{...before.permissions,...(input.calendar===undefined?{}:{calendar:!!input.calendar})},...number};
      if(input.enabledApps!==undefined)data.enabledApps=validateEnabledApps(input.enabledApps);
      const update={name:text(input.name??existing?.name,80),[`flags.${ID}.data`]:data};
      if(!existing || input.users!==undefined) update.ownership={...(existing?.doc.ownership??{}),default:0,...Object.fromEntries(game.users.map(u=>[u.id,u.isGM?3:users.includes(u.id)?2:0]))};
      return update;
    },
    persist:async(existing,update,operation)=>lifecycle.audited(operation,{id:existing?.id,name:update.name,data:update[`flags.${ID}.data`]},async()=>{
      if(existing) return existing.doc.update(update);
      const {['flags.'+ID+'.data']:data,...rest}=update;
      const retired=await lifecycle.retiredIds();
      let doc;
      for(let attempt=0;attempt<16;attempt++) {
        doc=await Journal().create({...rest,flags:{[ID]:{data}}});
        if(!doc || !retired.has(doc.id)) break;
        await doc.delete({render:false});doc=null;
      }
      if(!doc) throw Error('O Foundry não criou o aparelho.');
      const devices=await setting('devices')??[];
      await game.settings.set(ID,'devices',[...new Set([...devices,doc.id])]);
      return doc;
    })
  });
  const patchLink=async(phone,patch)=>{
    const changes=Object.fromEntries(Object.entries(patch).map(([key,value])=>{
    // Empty objects merge into existing flags in Foundry. Remove obsolete
    // session maps explicitly so no old token survives a restore.
    const remove=['sessions','unlockSessions','unlockedUsers','unlockTokens'].includes(key) && value && !Array.isArray(value) && typeof value==='object' && !Object.keys(value).length;
    return [`flags.${ID}.data.${key}`,remove?new foundry.data.operators.ForcedDeletion():value];
    }));
    // Foundry Document.update mutates changes by appending its top-level _id.
    // Verify only the flag fields prepared above, never that added metadata.
    const expectedEntries=Object.entries(changes);
    const result=await phone.doc.update(changes);
    if(result?.id!==phone.id) throw Error('O armazenamento não confirmou a alteração do aparelho.');
    const stored=(await all()).find(doc=>doc.id===phone.id);
    for(const [key,value] of expectedEntries) {
      const field=key.split('.').at(-1),actual=flag(stored)?.[field];
      if(value instanceof foundry.data.operators.ForcedDeletion ? actual!==undefined : !foundry.utils.equals(actual,value)) throw Error('O armazenamento não confirmou a alteração do aparelho.');
    }
    return result;
  };
  const auditJournal=async()=>{
    const docs=(await all()).filter(doc=>doc.getFlag(ID,'lifecycleLedger')===true);
    if(docs.length>1) throw Error('Há diários de auditoria duplicados. Nenhum registro foi alterado.');
    const doc=docs[0];
    if(doc && ((doc.ownership?.default??0)!==0 || game.users.some(user=>!user.isGM && (doc.ownership?.[user.id]??0)>0))) throw Error('O diário de auditoria deve ser exclusivo dos GMs.');
    return doc;
  };
  const readState=async()=>(await auditJournal())?.getFlag(ID,'lifecycle')??{};
  const writeState=async ledger=>{
    const doc=await auditJournal();
    if(doc) return doc.setFlag(ID,'lifecycle',ledger);
    // Called only while holding the same server lock as all device mutations.
    // The anchor may be a player-readable phone in legacy worlds, so the audit
    // must have its own GM-only Journal instead of using that phone's flags.
    const created=await Journal().create({name:'Smartphone RPG · Auditoria administrativa (não excluir)',ownership:gmOwnership(),flags:{[ID]:{lifecycleLedger:true,lifecycle:ledger,data:{kind:'administrative-ledger',schema:1}}}},{render:false});
    if(!created) throw Error('Não foi possível registrar a operação administrativa.');
    return created;
  };
  const associatedMessages=async id=>{
    const C=CONFIG.ChatMessage.documentClass;
    const docs=await C.database.get(C,{query:{}});
    const direct=docs.filter(doc=>['request','delivery','rejected','device-action','device-action-result'].includes(flag(doc)?.kind) && [flag(doc).from,flag(doc).to].includes(id));
    const ids=new Set(direct.map(doc=>doc.id));
    return docs.filter(doc=>ids.has(doc.id)||(['delivery','rejected'].includes(flag(doc)?.kind)&&ids.has(flag(doc).requestId)));
  };
  const associatedBackups=async id=>(await all()).filter(doc=>flag(doc)?.kind==='backup' && flag(doc).source===id);
  const lifecycle=createLifecycleService({
    isGM:()=>game.user.isGM,userId:()=>game.user.id,token:()=>foundry.utils.randomID(),withLock,list,
    readState,writeState,
    disable:async id=>{
      const phone=(await list()).find(p=>p.id===id);
      if(phone) {
        const result=await phone.doc.update({[`flags.${ID}.data.deletionPending`]:true,ownership:gmOwnership()});
        const stored=(await all()).find(doc=>doc.id===id);
        if(result?.id!==id || !flag(stored)?.deletionPending) throw Error('O armazenamento não confirmou a desativação do aparelho.');
      }
    },
    purgeAssociated:async id=>{
      await purgeMessaging(id);
      for(const doc of await associatedMessages(id)) await doc.delete({render:false});
      for(const doc of await associatedBackups(id)) await doc.delete({render:false});
    },
    erase:async id=>{
      const doc=(await all()).find(doc=>doc.id===id);
      if(!doc || flag(doc)?.kind!=='phone') return;
      if(doc.getFlag(ID,'numberLockAnchor')) {
        // Keep the shared lock's parent in place; erase only its former phone
        // payload. Moving the anchor mid-operation would create two locks.
        const live=game.journal.get(id);
        const pages=[...live.pages].map(page=>page.id??page._id).filter(id=>id!==LOCK_ID);
        if(pages.length) await live.deleteEmbeddedDocuments('JournalEntryPage',pages,{render:false});
        await live.update({name:'Smartphone RPG · Controle de numeração (não excluir)',ownership:gmOwnership()},{render:false});
        await live.unsetFlag(ID,'data');
      } else await doc.delete({render:false});
    },
    unregister:async id=>game.settings.set(ID,'devices',(await setting('devices')??[]).filter(value=>value!==id)),
    verifyErased:async id=>{
      if((await all()).some(doc=>doc.id===id && flag(doc)?.kind==='phone') || (await setting('devices')??[]).includes(id) || (await associatedMessages(id)).length || (await associatedBackups(id)).length) throw Error('A exclusão ainda não foi confirmada pelo armazenamento.');
    },
    afterDelete:id=>Hooks.callAll('smartphoneRPGDeviceDeleted',{id})
  });
  return Object.freeze({...service,
    initializeClock:()=>withLock(async()=>{
      if(!game.user.isGM)throw Error('Somente o GM pode inicializar o relógio.');
      const current=await setting('worldClock');if(validClockAnchor(current))return current;
      const anchor=createClockAnchor(game.time?.serverTime??Date.now());await game.settings.set(ID,'worldClock',anchor);return anchor;
    }),
    applyUserAction:async(id,authorId,action,payload,requestId)=>{
      if(!game.user.isGM)throw Error('Somente o GM pode processar solicitações de personalização.');
      return withLock(async()=>{
        const phone=(await list()).find(p=>p.id===id);if(!phone)throw Error('Aparelho não encontrado.');
        requireAvailable(phone);
        const author=game.users.get(authorId);if(!author)throw Error('Usuário indisponível.');
        const patch=presentationPatch({...phone.data,id:phone.id},author,action,payload,(await list()).map(p=>({...p.data,id:p.id})));
        const requests=Array.isArray(phone.data.visualRequests)?phone.data.visualRequests:[];
        if(requestId && requests.includes(requestId))return phone.doc;
        if(requestId)patch.visualRequests=[...requests.slice(-99),requestId];
        await backup(phone,'device-'+action);
        return lifecycle.audited('device-'+action,phone,()=>patchLink(phone,patch));
      });
    },
    addNotification:async(id,input)=>{
      if(!game.user.isGM)throw Error('Somente o GM pode adicionar notificações.');
      return withLock(async()=>{
        const phone=(await list()).find(p=>p.id===id);if(!phone)throw Error('Aparelho não encontrado.');requireAvailable(phone);
        const note=notificationRecord(input,foundry.utils.randomID());
        await backup(phone,'notification-add');
        return lifecycle.audited('notification-add',phone,()=>patchLink(phone,{notifications:[...(Array.isArray(phone.data.notifications)?phone.data.notifications:[]).slice(-99),note]}));
      });
    },
    listNotifications:(id,user=game.user)=>{const doc=game.journal.get(id);return notificationsFor(flag(doc),user);},
    deletePhone:(id,name)=>lifecycle.remove(id,name),
    resumeDeletions:()=>lifecycle.resume(),
    inspectIntegrity:()=>lifecycle.inspect(),
    withOperationalLock:task=>{
      if(!game.user.isGM) throw Error('Somente o GM pode processar mensagens.');
      return withLock(async()=>task(new Map((await list()).map(phone=>[phone.id,{...phone.data,id:phone.id,name:phone.name}]))));
    },
    setArchived:async(id,archived)=>{
      if(!game.user.isGM) throw Error('Somente o GM pode arquivar ou restaurar aparelhos.');
      return withLock(async()=>{
        const phone=(await list()).find(p=>p.id===id);
        if(!phone) throw Error('Aparelho não encontrado.');
        requireAvailable(phone);
        if(archived===false) assertRestorable(phone,await list());
        const patch=archivePatch(phone.data,archived,game.user.id);
        if(!patch) return phone.doc;
        Object.assign(patch,invalidateSessions(phone.data));
        await backup(phone,archived?'phone-archive':'phone-restore');
        return lifecycle.audited(archived?'archive':'restore',phone,()=>patchLink(phone,patch));
      });
    },
    setActorLink:async(id,actorUuid)=>{
      if(!game.user.isGM) throw Error('Somente o GM pode alterar o vínculo com personagens.');
      return withLock(async()=>{
        const phone=(await list()).find(p=>p.id===id);
        if(!phone) throw Error('Aparelho não encontrado.');
        requireAvailable(phone);
        const patch=prepareActorLink({actorUuid},phone.data,game.actors);
        if(Object.entries(patch).every(([key,value])=>phone.data[key]===value)) return phone.doc;
        await backup(phone,'actor-link-edit');
        return lifecycle.audited('actor-link',phone,()=>patchLink(phone,patch));
      });
    },
    migrateActors:async()=>{
      if(!game.user.isGM) throw Error('Somente o GM pode migrar vínculos.');
      return withLock(async()=>{
        const changes=(await list()).map(phone=>({phone,patch:existingActorFields(phone.data)})).filter(({phone,patch})=>Object.entries(patch).some(([key,value])=>phone.data[key]!==value));
        for(const {phone} of changes) await backup(phone,'actor-link-migration');
        for(const {phone,patch} of changes) await patchLink(phone,patch);
        return changes.length;
      });
    },recover:()=>serialize(async()=>{
    if(!game.user.isGM) throw Error('Somente o GM pode recuperar o bloqueio.');
    if(game.users.some(u=>u.isGM && u.active && u.id!==game.user.id)) throw Error('Feche as outras sessões de GM antes de recuperar o bloqueio.');
    return recoverEmbeddedLock(await init(),{backup,confirm:()=>foundry.applications.api.DialogV2.confirm({window:{title:'Recuperar bloqueio da numeração'},content:'<p>Use somente após reiniciar o Foundry e fechar as outras abas/sessões de GM, para garantir que nenhum salvamento anterior continua ativo.</p><p>Uma cópia do diário será preservada. Apenas a página temporária de bloqueio será removida; os aparelhos e números serão mantidos.</p><p>Você já reiniciou o Foundry e fechou as outras sessões?</p>'})});
  })});
}
