import {attachSecondarySwipe,attachSecondaryBack} from './secondary-swipe';
/** Shared geometry is measured from the approved home header, not duplicated. */
export function setupSecondaryChrome(routes:{closeCompanion:()=>void;closeNote:()=>void;closeMoment:()=>void}) {
 const home=document.querySelector<HTMLElement>('#page-home .page-header')!;
 const footerProbe=document.createElement('div');footerProbe.hidden=true;footerProbe.style.paddingBottom='max(10px,env(safe-area-inset-bottom))';document.body.append(footerProbe);
 const frames=[...document.querySelectorAll<HTMLIFrameElement>('.ledger-page iframe')];
 function metrics(){const style=getComputedStyle(home),height=parseFloat(style.height),top=parseFloat(style.paddingTop),bottom=parseFloat(getComputedStyle(footerProbe).paddingBottom);if(!height||!Number.isFinite(top))return;
  document.documentElement.style.setProperty('--secondary-header-height',height+'px');document.documentElement.style.setProperty('--secondary-header-top',top+'px');
  document.documentElement.style.setProperty('--secondary-footer-inset',bottom+'px');
  for(const frame of frames)frame.contentWindow?.postMessage({channel:'sanhao:header-metrics',height,top,bottom},'*');
 }
 const copy=(element:HTMLElement)=>element.matches('.image-cropper')?'留下喜欢的样子就好 (｡•ᴗ•｡)':element.matches('.wheel-picker')?'慢慢选，选好就记着啦 (｡•ᴗ•｡)':element.matches('.memo-note-detail,.memo-moment-detail')?'想到什么，就轻轻写下来 (｡•ᴗ•｡)':element.matches('.archive-reader')?'喜欢的小片段，再看看吧 (｡•ᴗ•｡)':'挑个喜欢的，今天也开心呀 (｡•ᴗ•｡)';
 function endings(){
  for(const button of document.querySelectorAll<HTMLButtonElement>('#mobile-app button')){const plain=/^[+＋]\s*\S/.test(button.textContent?.trim()??'');if(button.classList.contains('plain-add-action')!==plain)button.classList.toggle('plain-add-action',plain)}
  for(const panel of document.querySelectorAll<HTMLElement>('.memo-note-detail,.memo-moment-detail,.archive-reader,.chat-customizer,.image-cropper,.app-confirm,.wheel-picker')){
  let ending=panel.querySelector<HTMLElement>(':scope > .secondary-page-ending');
  if(!ending){ending=document.createElement('p');ending.className='secondary-page-ending';ending.textContent=copy(panel)}
  if(panel.lastElementChild!==ending)panel.append(ending);
 }}
 const blocked=()=>!!document.querySelector('dialog[open]:not(.archive-reader),.mobile-sheet:not([hidden])');
 attachSecondarySwipe(document,()=>{
  if(blocked())return null;
  const editor=document.querySelector<HTMLElement>('.memo-note-detail:not([hidden])');
  if(editor)return editor.querySelector<HTMLButtonElement>('.centered-back');
  const reader=document.querySelector<HTMLElement>('.archive-reader[open]');
  return reader?.querySelector<HTMLButtonElement>('.centered-back')??null;
 });
 attachSecondaryBack(document,()=>{
  if(blocked())return null;
  const note=document.querySelector<HTMLButtonElement>('#note-detail-view:not([hidden]) #close-note-detail');
  if(note)return {button:note,close:routes.closeNote};
  const moment=document.querySelector<HTMLButtonElement>('#moment-detail-view:not([hidden]) #close-moment-detail');
  return moment?{button:moment,close:routes.closeMoment}:null;
 });
 const attached=new WeakSet<Document>();
 const connect=(frame:HTMLIFrameElement)=>{metrics();const doc=frame.contentDocument;if(!doc||attached.has(doc))return;attached.add(doc);
  attachSecondaryBack(doc,()=>{if(frame.closest<HTMLElement>('.ledger-page')!.hidden)return null;const button=doc.querySelector<HTMLButtonElement>('.head>button:first-child');return button?{button,close:routes.closeCompanion}:null});
  attachSecondarySwipe(doc,()=>{if(frame.closest<HTMLElement>('.ledger-page')!.hidden||blocked()||doc.querySelector('.overlay:not([hidden])'))return null;return doc.querySelector<HTMLButtonElement>('.head>button:first-child')});
 };
 frames.forEach(frame=>{frame.addEventListener('load',()=>connect(frame));connect(frame)});new ResizeObserver(metrics).observe(home);window.addEventListener('resize',metrics);
 new MutationObserver(endings).observe(document.querySelector('#mobile-app')!,{childList:true,subtree:true});metrics();endings();
}
