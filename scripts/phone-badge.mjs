export function notificationCount(view,phoneIds){const ids=new Set();for(const id of phoneIds)for(const note of view.phones?.[id]?.notifications??[])if(!note.read)ids.add(id+':'+note.id);return ids.size;}
export function createPhoneBadge({getView,getIds}){
 let previous=null,timer;
 return ()=>{const view=getView(),ids=getIds(),keys=new Set(ids.flatMap(id=>(view.phones?.[id]?.notifications??[]).filter(n=>!n.read).map(n=>id+':'+n.id))),count=notificationCount(view,ids);
 const button=document.querySelector('[data-tool="smartphone-rpg"]');if(!button){previous=keys;return;}
 let badge=button.querySelector('.srpg-tool-badge');if(!badge){badge=document.createElement('span');badge.className='srpg-tool-badge';badge.setAttribute('aria-hidden','true');button.append(badge);}badge.textContent=count>99?'99+':String(count);badge.hidden=!count;button.setAttribute('aria-label','Meu celular'+(count?' · '+count+' não lidas':''));
 if(previous&&[...keys].some(k=>!previous.has(k))&&!matchMedia('(prefers-reduced-motion: reduce)').matches){button.classList.remove('srpg-tool-ring');void button.offsetWidth;button.classList.add('srpg-tool-ring');clearTimeout(timer);timer=setTimeout(()=>button.classList.remove('srpg-tool-ring'),650);}
 previous=keys;
 };
}
