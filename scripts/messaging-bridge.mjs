import {ID,canUse} from './core.mjs';
import {emptyMessaging,applyMessaging,messagingProjection,migrateMessaging} from './messaging.mjs';
import {seal,unseal,localIdentity,samePublicKey} from './messaging-crypto.mjs';
export function createMessagingBridge({numbering,isLeader,getPhones,refresh,onResult,legacyMessages=()=>[],legacyPending=()=>[],identityStore=localIdentity,readVault=async()=>{const C=CONFIG.Setting.documentClass;const docs=await C.database.get(C,{query:{key:ID+'.messagingVault'}});return docs[0]?.value??{};}}){
 let requestTail=Promise.resolve(),viewGeneration=0;
 let identity,view={revision:0,phones:{},results:[]},ready=false,queue=Promise.resolve(),syncing=false,pendingSync=false;
 const world=()=>game.world.id,purpose=(kind,user)=>'smartphone-rpg:'+world()+':'+kind+':'+user;
 const users=()=>game.users.contents??[...game.users];
 const gmUsers=()=>users().filter(u=>u.isGM);
 const nativeKey=u=>u.getFlag(ID,'messagingKey');
 const raw=()=>game.settings.get(ID,'messagingVault');
 const enqueue=task=>{const result=queue.then(task);queue=result.catch(error=>console.error('Smartphone RPG — mensagens',error));return result;};
 async function readState(){const vault=await readVault();if(!vault?.schema)return emptyMessaging();const envelope=vault.ledger?.[game.user.id];if(!envelope)throw Error('Histórico protegido indisponível para este GM. Conecte um GM que possua a chave anterior para sincronizar.');return unseal(envelope,identity.privateKey,purpose('ledger',game.user.id));}
 async function writeState(state,phones){
  const ledger={},projections={};for(const user of users()){const pub=nativeKey(user);if(!pub)continue;if(user.isGM)ledger[user.id]=await seal(state,pub,purpose('ledger',user.id));
   const projection=messagingProjection(state,user,phones);projection.results=(state.results?.[user.id]??[]).slice(-100);projections[user.id]=await seal(projection,pub,purpose('view',user.id));
  }
  if(!Object.keys(ledger).length)throw Error('Nenhuma chave de GM disponível.');
  await game.settings.set(ID,'messagingVault',{schema:1,revision:state.revision,ledger,projections});
 }
 async function updateView(){
  if(!ready)return;const generation=++viewGeneration;const envelope=raw()?.projections?.[game.user.id];if(!envelope){view={revision:0,phones:{},results:[]};refresh();return;}
  const next=await unseal(envelope,identity.privateKey,purpose('view',game.user.id));if(generation!==viewGeneration)return;view=next;
  for(const result of next.results??[])onResult?.(result);refresh();
 }
 async function drain(){
  if(!ready||!isLeader())return;
  return enqueue(async()=>{
   const visuals=new Map(),previously=await readState();
   for(const user of users())for(const entry of (Array.isArray(user.getFlag(ID,'messagingOutbox'))?user.getFlag(ID,'messagingOutbox'):[]).slice(0,30)){
    if(previously.processed[user.id+':'+entry?.id])continue;
    if(!entry?.forGM?.[game.user.id]||JSON.stringify(entry).length>40000)continue;
    try{const req=await unseal(entry.forGM[game.user.id],identity.privateKey,purpose('request',user.id));if(req.id===entry.id&&req.action==='visual'){
      try{await numbering.applyUserAction(req.from,user.id,req.payload.action,req.payload.payload,user.id+':'+entry.id);visuals.set(user.id+':'+entry.id,{success:true});}catch(error){visuals.set(user.id+':'+entry.id,{success:false,reason:error.message});}
    }}catch{}
   }
   return numbering.withOperationalLock(async phones=>{
   let state=await readState();state=migrateMessaging(state,phones,legacyMessages());
   if(!state.legacyRequestsImported){for(const legacy of legacyPending()){
    const requestId='legacy-native:'+legacy.id;if(state.processed[requestId])continue;
    try{const user=game.users.get(legacy.author);if(!user)throw Error('Autor indisponível.');state=applyMessaging(state,user,phones,{id:requestId,from:legacy.from,action:'send-number',payload:{number:phones.get(legacy.to)?.phoneNumberNormalized,body:legacy.body}},{now:legacy.at});}
    catch{state.processed[requestId]={user:legacy.author,at:Date.now(),legacyRejected:true};}
   }state.legacyRequestsImported=true;}
   for(const user of users()){
    const entries=user.getFlag(ID,'messagingOutbox')??[];if(!Array.isArray(entries)||entries.length>30)continue;
    for(const entry of entries){
     if(!entry||typeof entry.id!=='string'||entry.id.length>100)continue;const requestId=user.id+':'+entry.id;
     if(state.processed[requestId])continue;
     const encrypted=entry.forGM?.[game.user.id];if(!encrypted)continue;
     let result;
     try{
      if(JSON.stringify(encrypted).length>40000)throw Error('Solicitação muito grande.');
      const req=await unseal(encrypted,identity.privateKey,purpose('request',user.id));
      if(req.id!==entry.id)throw Error('Identificador adulterado.');
      if(Object.values(state.processed).filter(r=>r.user===user.id&&Date.now()-r.at<60000).length>=30)throw Error('Limite de 30 operações por minuto.');
      if(req.action==='visual'){
       const visual=visuals.get(requestId);if(!visual?.success)throw Error(visual?.reason??'Operação visual não disponível.');state.processed[requestId]={user:user.id,at:Date.now()};
      }else{
       state=applyMessaging(state,user,phones,{...req,id:requestId});
      }
      result={requestId:entry.id,success:true};
     }catch(error){state.processed[requestId]={user:user.id,at:Date.now()};result={requestId:entry.id,success:false,reason:error.message};}
     state.results??={};state.results[user.id]=[...(state.results[user.id]??[]).slice(-99),result];
    }
   }
   // Revocations and newly registered keys must update encrypted views even without a new message.
   await writeState(state,phones);
   // Native User updates discard acknowledged encrypted requests after the durable result exists.
   for(const user of users()){const outbox=user.getFlag(ID,'messagingOutbox');if(!Array.isArray(outbox))continue;const keep=outbox.filter(e=>!state.processed[user.id+':'+e.id]);if(keep.length!==outbox.length)await user.setFlag(ID,'messagingOutbox',keep);}
  });}).then(updateView);
 }
 async function sync(){if(syncing){pendingSync=true;return;}syncing=true;try{await updateView();await drain();}finally{syncing=false;if(pendingSync){pendingSync=false;queueMicrotask(()=>sync().catch(error=>console.error(error)));}}}
 async function sendRequest(from,action,payload){
  if(!ready)throw Error('Mensagens ainda não inicializadas.');const phone=getPhones().get(from);if(!canUse(phone,game.user))throw Error('Sem acesso ao aparelho.');
  const id=crypto.randomUUID(),req={id,from,action,payload},forGM={};for(const user of gmUsers()){const key=nativeKey(user);if(key)forGM[user.id]=await seal(req,key,purpose('request',game.user.id));}
  if(!Object.keys(forGM).length)throw Error('Um GM deve abrir o mundo e inicializar as chaves antes do primeiro envio.');
  const done=new Set((view.results??[]).map(r=>r.requestId));const outbox=(game.user.getFlag(ID,'messagingOutbox')??[]).filter(e=>!done.has(e.id));
  if(outbox.length>=20)throw Error('20 operações pendentes. Aguarde o GM sincronizar.');
  await game.user.setFlag(ID,'messagingOutbox',[...outbox,{id,forGM}]);
  if(isLeader())await drain();
  const result=view.results?.find(r=>r.requestId===id);if(result&&!result.success)throw Error(result.reason);return result?{pending:false}:{pending:true,requestId:id};
 }
 function request(...args){const run=()=>globalThis.navigator?.locks?navigator.locks.request('smartphone-rpg-outbox-'+world()+':'+game.user.id,()=>sendRequest(...args)):sendRequest(...args);const result=requestTail.then(run);requestTail=result.catch(()=>{});return result;}
 return {get view(){return view;},request,sync,updateView,async start(){
  if(!globalThis.crypto?.subtle)throw Error('Criptografia indisponível. Use localhost ou HTTPS.');
  identity=await (globalThis.navigator?.locks?navigator.locks.request('smartphone-rpg-key-'+world()+':'+game.user.id,()=>identityStore(world(),game.user.id)):identityStore(world(),game.user.id));const existing=nativeKey(game.user);
  if(existing&&!samePublicKey(existing,identity.publicKey))throw Error('A chave deste usuário pertence a outro navegador. Use o navegador original; não apague a chave sem recuperação pelo GM.');
  if(!existing)await game.user.setFlag(ID,'messagingKey',identity.publicKey);ready=true;await sync();
 },async purgeDevice(id){
   if(!game.user.isGM||!ready)throw Error('Mensagens protegidas ainda não disponíveis para exclusão.');
   // Caller already holds the shared document lock.
   const state=await readState(),number=getPhones().get(id)?.phoneNumberNormalized,removed=new Set(Object.values(state.conversations).filter(c=>!c.group&&c.ever.includes(id)).map(c=>c.id));
   for(const user of users()){const outbox=user.getFlag(ID,'messagingOutbox');if(!Array.isArray(outbox))continue;const keep=[];for(const entry of outbox){try{const req=await unseal(entry.forGM?.[game.user.id],identity.privateKey,purpose('request',user.id));if(req.from===id||removed.has(req.payload?.conversation)||String(req.payload?.number).replace(/\D/g,'')===number)continue;}catch{}keep.push(entry);}if(keep.length!==outbox.length)await user.setFlag(ID,'messagingOutbox',keep);}
   delete state.contacts[id];for(const [key,conv] of Object.entries(state.conversations)){conv.sequence??=conv.messages.at(-1)?.seq??0;conv.members=conv.members.filter(x=>x!==id);conv.ever=conv.ever.filter(x=>x!==id);conv.messages=conv.messages.filter(m=>m.sender!==id).map(m=>({...m,audience:m.audience.filter(x=>x!==id)}));if(!conv.ever.length||!conv.group)delete state.conversations[key];if(conv.admin===id)conv.admin=conv.members[0]??null;}
   state.revision++;await writeState(state,getPhones());
 }};
}
