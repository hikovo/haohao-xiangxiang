import {validDate} from './ledger-model.js';
export const healthKey='sanhao-tu.health.v1';
export const fixedHabits=[{id:'water',name:'喝水',emoji:'💧',archived:false},{id:'exercise',name:'运动',emoji:'🏃',archived:false}];
export const newHealth=()=>({version:1,revision:0,meals:[],weights:[],exercises:[],habits:structuredClone(fixedHabits),checkins:[]});
const count=s=>[...new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(s)].length;
const id=s=>typeof s==='string'&&s.length>0&&s.length<=100;
function require(ok,text){if(!ok)throw Error(text)}
export function parseWeight(text){require(/^\d+(\.\d{1,2})?$/.test(text),'体重用千克填写，最多两位小数');const [a,b='']=text.split('.');const grams=Number(a)*1000+Number(b.padEnd(2,'0'))*10;require(Number.isSafeInteger(grams)&&grams>0&&grams<=1000000,'请检查体重数值');return grams}
export function applyHealth(state,r){
  require(state?.version===1,'记录版本暂不支持，原数据没有修改');const s=structuredClone(state);s.habits=[...structuredClone(fixedHabits),...s.habits.filter(h=>!fixedHabits.some(f=>f.id===h.id))];if(r.operation==='read')return s;
  require(state.revision===r.revision,'记录已更新，请返回后重新打开再保存');
  const put=(key,v,field='id')=>{const i=s[key].findIndex(x=>x[field]===v[field]);if(i>=0)s[key][i]=v;else s[key].push(v)};
  const remove=(key,field,value)=>{require(s[key].some(x=>x[field]===value),'没有找到这条记录');s[key]=s[key].filter(x=>x[field]!==value)};
  switch(r.operation){
    case 'clearHealthRecords':s.meals=[];s.weights=[];s.exercises=[];break;
    case 'clearCheckins':s.checkins=[];break;
    case 'saveMeal':{const v={...r.meal,text:r.meal?.text?.trim()};require(id(v.id)&&validDate(v.date)&&['breakfast','lunch','dinner','snack'].includes(v.kind)&&typeof v.text==='string'&&count(v.text)>0&&count(v.text)<=500,'请检查餐食内容和日期');put('meals',v);break}
    case 'saveWeight':{const v=r.weight;require(v&&validDate(v.date)&&Number.isInteger(v.grams)&&v.grams>0&&v.grams<=1000000&&v.grams%10===0,'请检查体重数值和日期');put('weights',v,'date');break}
    case 'saveExercise':{const v={...r.exercise,name:r.exercise?.name?.trim()};require(id(v.id)&&validDate(v.date)&&typeof v.name==='string'&&count(v.name)>0&&count(v.name)<=30&&Number.isInteger(v.minutes)&&v.minutes>0&&v.minutes<=1440&&typeof v.note==='string'&&count(v.note)<=200,'请检查运动名称、时长和日期');put('exercises',v);break}
    case 'saveHabit':{const v={...r.habit,name:r.habit?.name?.trim(),emoji:r.habit?.emoji?.trim()},fixed=fixedHabits.find(h=>h.id===v.id);require(!fixed||(v.name===fixed.name&&v.emoji===fixed.emoji&&!v.archived),'喝水和运动是固定习惯，不能修改或收起');require(id(v.id)&&typeof v.name==='string'&&count(v.name)>0&&count(v.name)<=20&&typeof v.emoji==='string'&&count(v.emoji)>0&&count(v.emoji)<=4&&typeof v.archived==='boolean','习惯名称最多 20 字，再选一个 emoji 呀');require(v.days===undefined||(Array.isArray(v.days)&&v.days.length>0&&v.days.every(d=>Number.isInteger(d)&&d>=1&&d<=7)&&new Set(v.days).size===v.days.length),'每周至少选一天，日期不能重复');require(v.weeklyTarget===undefined||(Number.isInteger(v.weeklyTarget)&&v.weeklyTarget>=1&&v.weeklyTarget<=(v.days?.length||7)),'每周目标不能超过选择的天数');put('habits',v);break}
    case 'setCheckin':require(validDate(r.date)&&typeof r.checked==='boolean'&&s.habits.some(x=>x.id===r.id&&!x.archived),'没有找到这个习惯或日期无效');s.checkins=s.checkins.filter(x=>x.habitId!==r.id||x.date!==r.date);if(r.checked)s.checkins.push({habitId:r.id,date:r.date});break;
    case 'archiveHabit':{require(!fixedHabits.some(h=>h.id===r.id),'喝水和运动是固定习惯，不能收起');const v=s.habits.find(x=>x.id===r.id);require(v,'没有找到这个习惯');v.archived=true;break}
    case 'deleteMeal':remove('meals','id',r.id);break;
    case 'deleteExercise':remove('exercises','id',r.id);break;
    case 'deleteWeight':remove('weights','date',r.date);break;
    default:throw Error('不支持这个操作');
  }
  require(s.meals.length+s.weights.length+s.exercises.length+s.checkins.length<200000&&s.habits.length<=1000,'记录数量太多啦');s.revision++;return s;
}
