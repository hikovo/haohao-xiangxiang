export const storageKey = 'sanhao-tu.ledger.v1';
export function newLedger() {
  return {version:1,revision:0,entries:[],budgets:[],categories:[
    ['food','餐食','🍚','out'],['drink','饮品','🥤','out'],['travel','交通','🚇','out'],['shopping','购物','🛍','out'],['daily','日用','🧺','out'],['fun','娱乐','🎧','out'],['support','应援','⭐','out'],['salary','工资','💼','in'],['gift','收到礼物','🎁','in'],['refund','退款','↩️','in']
  ].map(([id,name,emoji,kind])=>({id,name,emoji,kind,archived:false}))};
}
export function parseAmount(text) {
  if(!/^\d{1,10}(\.\d{0,2})?$/.test(text.trim())) throw Error('金额最多保留两位小数呀');
  const [whole,decimal='']=text.trim().split('.'),cents=Number(whole)*100+Number(decimal.padEnd(2,'0'));
  if(!Number.isSafeInteger(cents)||cents<=0||cents>999999999999)throw Error('写一个大于零的金额呀');
  return cents;
}
export function amountText(cents) {
  const n=BigInt(cents),a=n<0n?-n:n;return (n<0n?'−':'')+String(a/100n)+'.'+String(a%100n).padStart(2,'0');
}
export function validDate(value) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number(value.slice(0,4))<1000)return false;
  const d=new Date(value+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
}
const length=s=>[...new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(s)].length;
export function applyLedger(state,request) {
  if(state.version!==1)throw Error('账本版本暂不支持，原记录没有修改');
  if(request.operation==='read')return state;
  if(request.revision!==state.revision)throw Error('账本已更新，请返回后重新打开再保存');
  const next=structuredClone(state);
  if(request.operation==='clearEntries') { next.entries=[];
  } else if(request.operation==='saveEntry') {
    const e=request.entry,c=next.categories.find(c=>c.id===e?.categoryId),index=next.entries.findIndex(x=>x.id===e?.id);
    if(!e||!e.id||e.id.length>100||!['in','out'].includes(e.type)||!Number.isSafeInteger(e.cents)||e.cents<=0||e.cents>999999999999||!validDate(e.date)||typeof e.note!=='string'||length(e.note)>200||!c||![e.type,'both'].includes(c.kind))throw Error('请检查金额、日期和分类');
    if(index>=0)next.entries[index]=e;else{if(c.archived||next.entries.length>=100000)throw Error('这个分类已收起，请换一个分类');next.entries.push(e)}
  } else if(request.operation==='deleteEntry') {
    if(!next.entries.some(e=>e.id===request.id))throw Error('没有找到这条账目');next.entries=next.entries.filter(e=>e.id!==request.id);
  } else if(request.operation==='saveCategory') {
    const c={...request.category};c.name=c.name?.trim();c.emoji=c.emoji?.trim();
    if(!c.id||c.id.length>100||!['in','out','both'].includes(c.kind)||!c.name||length(c.name)>12||!c.emoji||length(c.emoji)>4)throw Error('写一个分类名，再选一个 emoji 呀');
    if(c.kind!=='both'&&next.entries.some(e=>e.categoryId===c.id&&e.type!==c.kind))throw Error('已有账目的分类不能改成另一种收支类型');
    const i=next.categories.findIndex(x=>x.id===c.id);if(i>=0)next.categories[i]=c;else{if(next.categories.length>=1000)throw Error('分类数量太多啦');next.categories.push(c)}
  } else if(request.operation==='saveBudget') {
    const b=request.budget;
    if(!b||!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month)||!Number.isSafeInteger(b.cents)||b.cents<0||b.cents>999999999999||typeof b.categoryId!=='string'||(b.categoryId&&!next.categories.some(c=>c.id===b.categoryId&&['out','both'].includes(c.kind))))throw Error('请检查预算金额、月份和分类');
    next.budgets=(next.budgets||[]).filter(x=>x.month!==b.month||x.categoryId!==b.categoryId);
    if(b.cents)next.budgets.push({month:b.month,categoryId:b.categoryId,cents:b.cents});
  } else if(request.operation==='archiveCategory') {
    const c=next.categories.find(c=>c.id===request.id);if(!c)throw Error('没有找到这个分类');c.archived=true;
  } else throw Error('不支持这个账本操作');
  next.revision++;return next;
}
export function totals(entries) {
  return entries.reduce((s,e)=>{s[e.type]+=BigInt(e.cents);return s},{in:0n,out:0n});
}
