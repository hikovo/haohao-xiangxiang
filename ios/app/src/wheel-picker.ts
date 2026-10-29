export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
const two = (value: number) => String(value).padStart(2, '0');
export const dateString = (year: number, month: number, day: number) => `${year}-${two(month)}-${two(Math.min(day, daysInMonth(year, month)))}`;

/** Native WebKit controls receive real taps. The wrapper contains the intrinsic
 * date-control width without replacing the system calendar or time picker. */
export function setupSystemPickers(root: HTMLElement) {
  const enhanced = new WeakSet<HTMLInputElement>();
  const observed = new WeakSet<HTMLElement>();
  const refreshers = new Map<HTMLInputElement, () => void>();
  function enhance(scope: HTMLElement) {
    scope.querySelectorAll<HTMLInputElement>('input[type=date],input[type=time],input[type=month],input[type=datetime-local]').forEach(target => {
      if (enhanced.has(target)) return;
      enhanced.add(target);
      const control = document.createElement('span');
      control.className = `${target.className} wheel-value-button system-date-control`;
      control.dataset.pickerFor = target.id;
      const value = document.createElement('span');
      const arrow = document.createElement('i');
      arrow.className = 'wheel-right-arrow'; arrow.setAttribute('aria-hidden', 'true');
      target.before(control); control.append(value); if(!target.dataset.compactDate)control.append(arrow); control.append(target);
      target.classList.add('system-date-input'); target.readOnly = false;
      const refresh = () => {
        const text = target.value ? target.dataset.compactDate ? (target.type==='datetime-local' ? target.value.slice(5).replace('-', '.').replace('T',' ') : target.value.replace(/-/g,'.')) : target.value.replace('T', ' ') : target.type === 'time' ? '选个时间' : '年 / 月 / 日';
        if (value.textContent !== text) value.textContent = text;
        control.classList.toggle('disabled', target.disabled);
      };
      refreshers.set(target, refresh);
      target.addEventListener('input', refresh); target.addEventListener('change', refresh);
      new MutationObserver(refresh).observe(target, {attributes:true, attributeFilter:['disabled','value']});
      refresh();
    });
    refreshers.forEach((refresh, target) => { if (target.isConnected) refresh(); else refreshers.delete(target); });
  }
  function observe(scope: HTMLElement) {
    if (observed.has(scope)) return;
    observed.add(scope); enhance(scope);
    new MutationObserver(() => enhance(scope)).observe(scope, {childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  }
  observe(root);
  return {observe};
}
