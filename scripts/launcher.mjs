import {moveApp} from './apps.mjs';
export function nearestCell(cells,x,y,bounds) {
  if(x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom)return null;
  let best=null,distance=Infinity;
  for(const cell of cells){const r=cell.rect,d=(x-(r.left+r.right)/2)**2+(y-(r.top+r.bottom)/2)**2;if(d<distance){distance=d;best=cell.index;}}
  return best;
}
export function attachLauncher(root,{getLayout,onMove,onOrganize,onDragging,delay=450,setTimer=setTimeout,clearTimer=clearTimeout}) {
  const grid=root.querySelector('.srpg-app-grid');if(!grid)return ()=>{};
  let press,ghost,timer,suppress=false;
  const cleanup=()=>{
    const wasDragging=!!ghost;
    clearTimer(timer);timer=null;ghost?.remove();ghost=null;
    grid.querySelectorAll('.is-drag-source,.is-drop-target').forEach(node=>node.classList.remove('is-drag-source','is-drop-target'));
    if(press?.button.hasPointerCapture?.(press.id))press.button.releasePointerCapture(press.id);
    press=null;
    if(wasDragging)onDragging?.(false);
  };
  const move=event=>{
    if(!press||event.pointerId!==press.id)return;
    if(!ghost){if(Math.hypot(event.clientX-press.x,event.clientY-press.y)>12){suppress=true;cleanup();}return;}
    event.preventDefault();event.stopPropagation();
    ghost.style.left=`${event.clientX-press.width/2}px`;ghost.style.top=`${event.clientY-press.height/2}px`;
    const cells=[...grid.querySelectorAll('[data-cell]')].filter(cell=>!cell.hasAttribute('data-reserved')).map(cell=>({index:Number(cell.dataset.cell),rect:cell.getBoundingClientRect()}));
    press.target=nearestCell(cells,event.clientX,event.clientY,grid.getBoundingClientRect());
    grid.querySelectorAll('.is-drop-target').forEach(node=>node.classList.remove('is-drop-target'));
    if(press.target!==null)grid.querySelector(`[data-cell="${press.target}"]`)?.classList.add('is-drop-target');
  };
  const down=event=>{
    if(event.button!==0||event.isPrimary===false)return;
    const button=event.target.closest('[data-app-id]');if(!button||!grid.contains(button))return;
    cleanup();suppress=false;event.stopPropagation();
    const r=button.getBoundingClientRect();press={id:event.pointerId,button,app:button.dataset.appId,x:event.clientX,y:event.clientY,width:r.width,height:r.height,target:null};
    // Capture while pressing too, so a release outside the icon cancels the timer.
    button.setPointerCapture?.(event.pointerId);
    timer=setTimer(()=>{
      if(!press)return;suppress=true;onOrganize(true);onDragging?.(true);root.classList.add('srpg-organizing');
      press.button.classList.add('is-drag-source');ghost=press.button.cloneNode(true);ghost.classList.add('srpg-drag-ghost');ghost.removeAttribute('data-screen');ghost.removeAttribute('data-app-id');
      Object.assign(ghost.style,{left:`${press.x-press.width/2}px`,top:`${press.y-press.height/2}px`,width:`${press.width}px`,height:`${press.height}px`});root.append(ghost);
    },delay);
  };
  const up=event=>{
    if(!press||event.pointerId!==press.id)return;
    if(ghost){event.preventDefault();event.stopPropagation();const {app,target}=press;cleanup();if(target!==null)onMove(moveApp(getLayout(),app,target));}
    else cleanup();
  };
  const click=event=>{if(suppress){event.preventDefault();event.stopImmediatePropagation();suppress=false;}};
  const resetSuppression=()=>{if(!press)suppress=false;};
  root.addEventListener('pointerdown',resetSuppression,true);root.addEventListener('keydown',resetSuppression,true);
  grid.addEventListener('pointerdown',down);grid.addEventListener('pointermove',move);grid.addEventListener('pointerup',up);grid.addEventListener('pointercancel',cleanup);root.addEventListener('click',click,true);
  return ()=>{cleanup();grid.removeEventListener('pointerdown',down);grid.removeEventListener('pointermove',move);grid.removeEventListener('pointerup',up);grid.removeEventListener('pointercancel',cleanup);root.removeEventListener('click',click,true);root.removeEventListener('pointerdown',resetSuppression,true);root.removeEventListener('keydown',resetSuppression,true);};
}
