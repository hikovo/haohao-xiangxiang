// One sheet structure across the companion pages, including dynamically rebuilt forms.
const endings={ledger:'每一笔小日子，都好好收着 (｡•ᴗ•｡)',health:'照顾好自己，慢慢来就好 (｡•ᴗ•｡)',timetable:'学习和休息，都好好安排呀 (｡•ᴗ•｡)'};
const kind=location.pathname.includes('ledger')?'ledger':location.pathname.includes('timetable')?'timetable':'health';
function normalize(){
 for(const button of document.querySelectorAll('button')){const plain=/^[+＋]\s*\S/.test(button.textContent?.trim()??'');if(button.classList.contains('plain-add-action')!==plain)button.classList.toggle('plain-add-action',plain)}
 for(const sheet of document.querySelectorAll('.phone .sheet')){
  let body=sheet.querySelector(':scope > .sheet-scroll');
  if(!body){body=document.createElement('div');body.className='sheet-scroll';sheet.append(body)}
  for(const child of [...sheet.children])if(!child.matches('.handle,.sheet-head,.sheet-scroll,.secondary-ending'))body.append(child);
  let ending=sheet.querySelector(':scope > .secondary-ending');
  if(!ending){ending=document.createElement('p');ending.className='secondary-ending';ending.textContent=endings[kind];sheet.append(ending)}
  if(sheet.lastElementChild!==ending)sheet.append(ending);
 }
 const phone=document.querySelector('.phone');
 if(phone){const actions=phone.querySelector(':scope > footer');let ending=phone.querySelector('.page-ending');if(!ending){ending=document.createElement('p');ending.className='page-ending';ending.textContent=endings[kind]}if(actions&&ending.parentElement!==actions)actions.append(ending)}
}
new MutationObserver(normalize).observe(document.body,{childList:true,subtree:true});normalize();

window.addEventListener('message',event=>{if(event.source!==parent||event.data?.channel!=='sanhao:header-metrics')return;const {height,top,bottom}=event.data;if(!Number.isFinite(height)||!Number.isFinite(top)||height<60||height>180||top<0||top>100)return;document.documentElement.style.setProperty('--secondary-header-height',height+'px');document.documentElement.style.setProperty('--secondary-header-top',top+'px');if(Number.isFinite(bottom)&&bottom>=0&&bottom<=100)document.documentElement.style.setProperty('--secondary-footer-inset',bottom+'px')});

// Leaving a full page retires its modal layer and keyboard as well. Reopening
// never leaves an invisible old form intercepting the header's back button.
window.addEventListener('message',event=>{
 if(event.source!==parent||event.data!=='sanhao:secondary-reset')return;
 if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
 for(const overlay of document.querySelectorAll('.overlay'))overlay.hidden=true;
 for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
});
