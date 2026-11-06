const encoder=new TextEncoder(),decoder=new TextDecoder();
const b64=bytes=>{const array=new Uint8Array(bytes);let text='';for(let i=0;i<array.length;i+=8192)text+=String.fromCharCode(...array.subarray(i,i+8192));return btoa(text);};
const un64=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
export async function generateIdentity(){const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},false,['deriveKey']);return {privateKey:pair.privateKey,publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)};}
export async function seal(value,publicKey,purpose){
 const ephemeral=await generateIdentity(),pub=await crypto.subtle.importKey('jwk',publicKey,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const key=await crypto.subtle.deriveKey({name:'ECDH',public:pub},ephemeral.privateKey,{name:'AES-GCM',length:256},false,['encrypt']);const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(purpose)},key,encoder.encode(JSON.stringify(value)));
 return {schema:1,key:ephemeral.publicKey,iv:b64(iv),data:b64(data)};
}
export async function unseal(envelope,privateKey,purpose){
 if(envelope?.schema!==1||typeof envelope.data!=='string'||envelope.data.length>24000000)throw Error('Envelope criptografado inválido.');
 const pub=await crypto.subtle.importKey('jwk',envelope.key,{name:'ECDH',namedCurve:'P-256'},false,[]),key=await crypto.subtle.deriveKey({name:'ECDH',public:pub},privateKey,{name:'AES-GCM',length:256},false,['decrypt']);
 return JSON.parse(decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(envelope.iv),additionalData:encoder.encode(purpose)},key,un64(envelope.data))));
}
export async function localIdentity(world,user){
 const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('smartphone-rpg-keys',1);request.onupgradeneeded=()=>request.result.createObjectStore('keys');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 const key=world+':'+user;const get=()=>new Promise((resolve,reject)=>{const request=db.transaction('keys').objectStore('keys').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 let value=await get();if(!value){value=await generateIdentity();await new Promise((resolve,reject)=>{const tx=db.transaction('keys','readwrite');tx.objectStore('keys').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}db.close();return value;
}
export const samePublicKey=(a,b)=>a?.x===b?.x&&a?.y===b?.y&&a?.crv===b?.crv;
