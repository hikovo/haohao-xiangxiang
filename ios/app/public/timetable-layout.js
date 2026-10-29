import {minute} from './timetable-model.js';
// A course spans configured periods; its times never invent extra period rows.
export function timetableRows(slots, courses) {
  const sorted = [...slots].sort((a,b) => minute(a.start)-minute(b.start));
  const rows = [];
  const times = courses.flatMap(c => [minute(c.start), minute(c.end)]);
  const first = minute(sorted[0].start), last = minute(sorted.at(-1).end);
  const low = Math.min(first, ...times), high = Math.max(last, ...times);
  if (low < first) rows.push({start:low,end:first,number:null,height:84});
  sorted.forEach((slot,i) => {
    if (i && minute(sorted[i-1].end) < minute(slot.start)) {
      const start=minute(sorted[i-1].end), end=minute(slot.start);
      const occupied=courses.some(c=>minute(c.start)<end && minute(c.end)>start && minute(c.start)>=start && minute(c.end)<=end);
      rows.push({start,end,number:null,height:occupied?84:8});
    }
    rows.push({start:minute(slot.start),end:minute(slot.end),number:i+1,height:84});
  });
  if (high > last) rows.push({start:last,end:high,number:null,height:84});
  return rows;
}
export function courseRows(course, rows) {
  const indices=rows.flatMap((r,i)=>minute(course.start)<r.end && minute(course.end)>r.start?[i]:[]);
  return {start:indices[0]+2,end:indices.at(-1)+3};
}
