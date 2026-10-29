export type ChatContextTurn = {id:string;role:'user'|'pet';message:string;archive?:unknown;mode?:'archive'|'chat'};
const strip = (value:string) => value.replace(/<\|[^>]*\|>|<｜[^>]*｜>|<\/?think>/g,'').trim().slice(0,200);
// Keep complete exchanges from the current chat segment only. Archive-mode
// messages are a boundary, even though both modes share the visible record.
export function recentChatContext(history:ChatContextTurn[],currentId?:string) {
  const end=currentId?history.findIndex(turn=>turn.id===currentId):-1;
  const prior=end>=0?history.slice(0,end):history;
  const pairs:Array<[ChatContextTurn,ChatContextTurn]>=[];
  for(let index=prior.length-1;index>=1;index-=2) {
    const answer=prior[index],question=prior[index-1];
    if(answer.mode!=='chat'||question.mode!=='chat'||answer.archive||question.archive)break;
    if(answer.role!=='pet'||question.role!=='user')break;
    if(strip(question.message)&&strip(answer.message))pairs.unshift([question,answer]);
    if(pairs.length===2)break;
  }
  return pairs.flat().map(turn=>({...turn,message:strip(turn.message)}));
}
