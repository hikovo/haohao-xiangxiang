import {invoke} from '@tauri-apps/api/core';
import {confirmAction} from './confirm-action';

type Document = Record<string,unknown> & {version:number;revision:number};
type Kind = 'ledger'|'health'|'habits'|'timetable';
const definitions = {
  ledger:{title:'兔兔的小账本',key:'sanhao-tu.ledger.v1',command:'ledger_store',operation:'clearEntries',fields:['entries'],kept:'分类和预算会保留。'},
  health:{title:'陪伴健康',key:'sanhao-tu.health.v1',command:'health_store',operation:'clearHealthRecords',fields:['meals','weights','exercises'],kept:'只清理餐食、体重和运动记录，习惯打卡会保留。'},
  habits:{title:'习惯打卡',key:'sanhao-tu.health.v1',command:'health_store',operation:'clearCheckins',fields:['checkins'],kept:'习惯和自己的小约定会保留，只清理打卡记录。'},
  timetable:{title:'课程表',key:'sanhao-tu.timetable.v1',command:'timetable_store',operation:'clearCourses',fields:['courses','tasks'],kept:'清理课程和课程待办，时间段设置会保留。'},
} as const;
async function transact(kind:Kind,operation='read',revision?:number):Promise<Document> {
  const definition=definitions[kind], request={operation,...(revision===undefined?{}:{revision})};
  if('__TAURI_INTERNALS__' in window) {
    const result=await invoke<{snapshot?:string}>('plugin:mobile-pet|'+definition.command,{payload:JSON.stringify(request)});
    if(!result.snapshot)throw Error('记录暂时无法读取');
    return JSON.parse(result.snapshot) as Document;
  }
  const stored=localStorage.getItem(definition.key);
  const state=stored?JSON.parse(stored) as Document:{version:1,revision:0};
  if(state.version!==1||!Number.isSafeInteger(state.revision))throw Error('记录暂时无法读取');
  if(operation==='read')return state;
  if(operation!==definition.operation||revision!==state.revision)throw Error('记录已更新，请重新打开后再清理');
  const next=structuredClone(state);
  for(const field of definition.fields)next[field]=[];
  if(kind==='timetable')next.importedBatches=[];
  next.revision++;
  localStorage.setItem(definition.key,JSON.stringify(next));
  return next;
}
const countRecords=(kind:Kind,document:Document)=>definitions[kind].fields.reduce((sum,field)=>sum+(Array.isArray(document[field])?document[field].length:0),0);

export async function appendDailyCleanupRows(parent:Element,onChanged:()=>Promise<void>,onError:(message:string)=>void) {
  const group=document.createElement('section');group.className='records-group';
  const heading=document.createElement('h3');heading.textContent='陪伴小本';group.append(heading);parent.append(group);
  await Promise.all((Object.keys(definitions) as Kind[]).map(async kind=>{
    const definition=definitions[kind],row=document.createElement('div');row.className='records-row';
    const title=document.createElement('b');title.textContent=definition.title;
    const count=document.createElement('small');count.textContent='读取中';
    const action=document.createElement('button');action.type='button';action.textContent='清理';action.disabled=true;action.dataset.recordCleanup=kind;
    row.append(title,count,action);group.append(row);
    const refresh=async()=>{
      try {const total=countRecords(kind,await transact(kind));count.textContent=total+' 条';action.disabled=total===0;}
      catch {count.textContent='暂未读到';action.disabled=true;}
    };
    action.addEventListener('click',async()=>{
      action.disabled=true;
      try {
        const state=await transact(kind),total=countRecords(kind,state);
        if(!total)return;
        if(!await confirmAction(`清理${definition.title}的 ${total} 条记录？\n${definition.kept}\n清理后无法恢复。`))return;
        await transact(kind,definition.operation,state.revision);
        await onChanged();
      } catch {onError('这次还没清理成功，请重新打开后再试。');}
      finally {await refresh();}
    });
    await refresh();
  }));
}
