import { invoke } from '@tauri-apps/api/core';
import { showReminderSettingsHelp } from './reminder-settings-help';
export type ReminderKind = 'daily' | 'todo' | 'countdown' | 'focus' | 'course' | 'habit' | 'meal' | 'weather';
export type ReminderOptions = { popup: boolean; vibration: boolean; sound: boolean; rhythm: string; tone: string; soundSeconds: number; vibrationSeconds: number; toneName?: string };
type Options = ReminderOptions;
export type ReminderEntry = {kind: ReminderKind; id?: string; title: string; detail?: string; edit?: () => void};
const key = 'hhxx.reminder-styles.v1';
const defaults: Options = {popup: true, vibration: false, sound: false, rhythm: 'double', tone: 'gentle', soundSeconds:15, vibrationSeconds:15};
const names = {daily: '每日询问', todo: '待办事项', countdown: '倒数日', focus: '专注时间',course:'课程提醒',habit:'习惯打卡',meal:'三餐提醒',weather:'天气小叮咛'};
const patterns: Record<string, number[]> = {single: [110], double: [80, 150, 80], slow: [120, 240, 120, 240, 120]};
function read(): Record<string, Options> { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; } }
const scope = (kind: ReminderKind, id?: string) => id ? `${kind}/${id}` : kind;
export function reminderOptions(kind: ReminderKind, id?: string): Options { const all = read(); return {...defaults, ...all[kind], ...all[scope(kind, id)]}; }
export async function fireReminder(kind: ReminderKind, eventId: string, id?: string) {
  if (!('__TAURI_INTERNALS__' in window)) return;
  await invoke('plugin:mobile-pet|reminder_style', {payload:JSON.stringify({kind, reminderId:id, action:'fire', eventId})});
}
// Produce the same small mono PCM format that the native importer validates.
export function encodeReminderWave(samples: Float32Array): Uint8Array {
  if (!samples.length || samples.length > 16000 * 15) throw new Error('Audio length');
  const bytes = new Uint8Array(44 + samples.length * 2); const view = new DataView(bytes.buffer);
  const word = (at: number, text: string) => [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  word(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); word(8, 'WAVE'); word(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  word(36, 'data'); view.setUint32(40, samples.length * 2, true);
  samples.forEach((value, i) => view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, value)) * 32767), true));
  return bytes;
}
export function setupReminderStyles(open: (panel: HTMLElement) => void, toast: (text: string) => void, sources: {entries: () => ReminderEntry[]; todo: () => ReminderEntry; countdown: () => ReminderEntry; changed: () => void}) {
  const panel = document.querySelector<HTMLElement>('#reminder-style-panel')!;

  const popup = panel.querySelector<HTMLInputElement>('#reminder-popup')!;
  const vibration = panel.querySelector<HTMLInputElement>('#reminder-vibration')!;
  const sound = panel.querySelector<HTMLInputElement>('#reminder-sound')!;
  const rhythm = panel.querySelector<HTMLSelectElement>('#reminder-rhythm')!;
  const tone = panel.querySelector<HTMLSelectElement>('#reminder-tone')!;
  const soundSeconds = panel.querySelector<HTMLSelectElement>('#reminder-sound-seconds')!;
  const vibrationSeconds = panel.querySelector<HTMLSelectElement>('#reminder-vibration-seconds')!;
  for (const select of [soundSeconds, vibrationSeconds]) {
    for (let seconds = 1; seconds <= 15; seconds++) select.add(new Option(`${seconds} 秒`, String(seconds)));
  }
  const input = panel.querySelector<HTMLInputElement>('#reminder-audio-file')!;
  const audioInfo = panel.querySelector<HTMLElement>('#reminder-audio-info')!;
  const save = panel.querySelector<HTMLButtonElement>('#save-reminder-style')!;
  let kind: ReminderKind = 'daily', reminderId: string | undefined, parent: HTMLElement, buffer: AudioBuffer | undefined, audioName = '';
  let context: AudioContext | undefined, source: AudioBufferSourceNode | undefined;
  const native = '__TAURI_INTERNALS__' in window;
  const current = (): Options => ({popup: popup.checked, vibration: vibration.checked, sound: sound.checked, rhythm: rhythm.value, tone: tone.value, soundSeconds:Number(soundSeconds.value), vibrationSeconds:Number(vibrationSeconds.value), toneName: tone.value.startsWith('custom-') ? tone.selectedOptions[0]?.textContent || '我的小铃声' : tone.value === 'import' ? audioName : undefined});
  const optionsChanged = () => {
    panel.querySelector<HTMLElement>('#reminder-sound-options')!.hidden = !sound.checked;
    panel.querySelector<HTMLElement>('#reminder-vibration-options')!.hidden = !vibration.checked;
    audioInfo.hidden = !sound.checked || tone.value !== 'import';
  };
  const updateSummary = (button: HTMLButtonElement, entry: ReminderEntry) => {
    const value = reminderOptions(entry.kind, entry.id);
    button.querySelector('small')!.textContent = [value.popup && '弹窗', value.vibration && '震动', value.sound && '铃声'].filter(Boolean).join(' · ') || '安安静静地记着';
  };
  const showStyle = (entry: ReminderEntry, previous: HTMLElement) => {
    kind = entry.kind; reminderId = entry.id; parent = previous; buffer = undefined; input.value = '';
    const options = reminderOptions(kind, reminderId);
    tone.querySelectorAll('option[data-custom]').forEach(option => option.remove());
    const customTones = new Map<string, string>();
    Object.values(read()).forEach(item => { if (item.tone?.startsWith('custom-')) customTones.set(item.tone, item.toneName || '我的小铃声'); });
    for (const [value, label] of customTones) { const option = new Option(label, value); option.dataset.custom = 'true'; tone.add(option); }
    popup.checked = options.popup; vibration.checked = options.vibration; sound.checked = options.sound;
    rhythm.value = options.rhythm; tone.value = options.tone;
    soundSeconds.value = String(options.soundSeconds); vibrationSeconds.value = String(options.vibrationSeconds);
    panel.querySelector('#reminder-style-for')!.textContent = entry.title;
    optionsChanged(); open(panel);
  };
  window.addEventListener('sanhao:routine-style',event=>{const value=(event as CustomEvent).detail;if(value&&['course','habit','meal'].includes(value.kind))showStyle({kind:value.kind,title:names[value.kind as ReminderKind]},document.querySelector<HTMLElement>('#routine-reminder-panel')!)});
  const rows: Array<[string, () => ReminderEntry]> = [['weather-settings-panel', () => ({kind:'weather',title:'天气小叮咛'})], ['daily-panel', () => ({kind:'daily', title:'每日询问'})], ['memo-reminder-options', sources.todo], ['countdown-reminder-options', sources.countdown], ['timer-panel', () => ({kind:'focus', title:'专注时间'})]];
  const refreshers: Array<() => void> = [];
  for (const [id, getEntry] of rows) {
    const target = document.getElementById(id)!;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'setting-button reminder-style-entry';
    button.innerHTML = '<span><b>提醒方式</b><small></small></span><i>›</i>';
    button.classList.add('reminder-inline-card');
    if (id === 'memo-reminder-options') {
      const field = document.createElement('div'); field.className = 'field-label reminder-mode-field';
      const label = document.createElement('span'); label.textContent = '提醒方式';
      button.querySelector('b')!.remove(); button.setAttribute('aria-label', '选择待办提醒方式');
      field.append(label, button); target.append(field);
    } else if (id.endsWith('panel')) (target.querySelector('.wide-primary, .timer-actions') || target.querySelector('.sheet-ending'))!.before(button); else target.append(button);
    const refresh = () => updateSummary(button, getEntry()); refreshers.push(refresh); refresh();
    const editor = button.closest<HTMLElement>('.mobile-sheet')!;
    new MutationObserver(() => { if (!editor.hidden) refresh(); }).observe(editor, {attributes:true, attributeFilter:['hidden']});
    button.addEventListener('click', () => {
      showStyle(getEntry(), editor);
    });
  }
  const manager = document.querySelector<HTMLElement>('#reminder-settings-panel')!;
  const renderManager = () => {
    const list = document.querySelector<HTMLElement>('#reminder-settings-list')!; list.replaceChildren();
    const all = sources.entries();
    for (const category of ['daily', 'todo', 'countdown', 'focus','course','habit','meal','weather'] as ReminderKind[]) {
      const group = document.createElement('section'); group.className = 'reminder-list-group';
      const heading = document.createElement('h3'); heading.textContent = names[category]; group.append(heading);
      const entries = all.filter(entry => entry.kind === category);
      if (!entries.length) { const empty = document.createElement('p'); empty.className = 'reminder-empty'; empty.textContent = category === 'todo' ? '还没有待办，写下小事后就能在这里选提醒啦' : '还没有倒数日，圈好日子后就能来这里看看啦'; group.append(empty); }
      for (const entry of entries) {
        const row = document.createElement('div'); row.className = 'reminder-management-row';
        const button = document.createElement('button'); button.type = 'button'; button.className = 'setting-button';
        const copy = document.createElement('span'), title = document.createElement('b'), time = document.createElement('small'), summary = document.createElement('small'), arrow = document.createElement('i');
        title.textContent = entry.title; time.textContent = entry.detail || ''; time.className = 'reminder-entry-time'; arrow.textContent = '›';
        copy.append(title, summary, time); button.append(copy); if (!entry.edit) button.append(arrow); updateSummary(button, entry);
        button.addEventListener('click', () => showStyle(entry, manager)); row.append(button);
        if (entry.edit) { const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'reminder-time-edit'; edit.textContent = '调整时间'; edit.addEventListener('click', entry.edit); row.append(edit); }
        group.append(row);
      }
      list.append(group);
    }
  };
  document.querySelector('#open-reminder-settings')!.addEventListener('click', () => { renderManager(); open(manager); });
  for (const element of [popup, vibration, sound, rhythm, tone]) element.addEventListener('change', optionsChanged);
  input.addEventListener('change', async () => {
    const file = input.files?.[0]; if (!file) return;
    if (file.size > 30 * 1024 * 1024) { toast('选一段小一点的声音吧，30 MB 以内就好'); return; }
    try {
      context ||= new AudioContext(); buffer = await context.decodeAudioData(await file.arrayBuffer());
      if (!Number.isFinite(buffer.duration) || buffer.duration <= 0 || buffer.duration > 15) {
        buffer = undefined; toast('选一个 15 秒以内的铃声吧，不会修改原音频喔'); return;
      }
      audioName = file.name.replace(/\.[^.]+$/, '');
      panel.querySelector('#reminder-audio-name')!.textContent = audioName; tone.value = 'import'; optionsChanged();
    } catch { buffer = undefined; toast('这段声音还没读出来，换一个音频文件试试吧'); }
  });
  const selectedAudio = () => {
    if (!buffer) throw new Error('请选择一个 15 秒以内的铃声');
    return buffer;
  };
  panel.querySelector('#reminder-preview')!.addEventListener('click', async () => {
    try {
      source?.stop(); source = undefined;
      const value = current();
      if (value.tone === 'import' && value.sound) {
        const audio = selectedAudio(); context ||= new AudioContext(); await context.resume();
        source = context.createBufferSource(); source.buffer = audio; source.connect(context.destination); source.start(); source.stop(context.currentTime + value.soundSeconds);
      }
      if (native) {
        const result = await invoke<{snapshot?:string}>('plugin:mobile-pet|reminder_style', {payload: JSON.stringify({...value, kind, reminderId, action: 'preview', tone: value.tone === 'import' ? 'gentle' : value.tone, sound: value.sound && value.tone !== 'import'})});
        const warning = JSON.parse(result.snapshot || '{}').warning;
        if (warning) toast(warning);
      }
      else {
        if (value.vibration) {
          const pattern = patterns[value.rhythm], repeated: number[] = [];
          let remaining = value.vibrationSeconds * 1000;
          while (remaining > 0) for (const part of [...pattern, 700]) {
            if (!remaining) break; repeated.push(Math.min(part, remaining)); remaining -= Math.min(part, remaining);
          }
          navigator.vibrate?.(repeated);
        }
        if (value.sound && value.tone !== 'import') {
          context ||= new AudioContext(); await context.resume();
          const notes = value.tone === 'chime' ? [880, 1320] : value.tone === 'three' ? [660, 784, 988] : [784];
          for (let cycle = 0; cycle < value.soundSeconds; cycle += 2) notes.forEach((frequency, i) => { const offset = cycle + i * .32; if (offset >= value.soundSeconds) return; const osc = context!.createOscillator(), gain = context!.createGain(), at = context!.currentTime + offset, length = Math.min(.8, value.soundSeconds - offset); osc.frequency.value = frequency; gain.gain.setValueAtTime(.18, at); gain.gain.exponentialRampToValueAtTime(.001, at + length); osc.connect(gain); gain.connect(context!.destination); osc.start(at); osc.stop(at + length); });
        }
        if (value.vibration) toast('震动的感觉需要在手机上试一试喔');
      }
    } catch (error) { toast(error instanceof Error && error.message.startsWith('请选择') ? error.message : '还没试听成功，再试一下吧'); }
  });
  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      const value = current(); let audio: string | undefined;
      if (!value.sound && value.tone === 'import') value.tone = 'gentle';
      if (value.tone === 'import') {
        const selected = selectedAudio();
        const renderer = new OfflineAudioContext(1, Math.round(selected.duration * 16000), 16000);
        const clip = renderer.createBufferSource(); clip.buffer = selected; clip.connect(renderer.destination); clip.start();
        const rendered = await renderer.startRendering(); const bytes = encodeReminderWave(rendered.getChannelData(0));
        let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192)); audio = btoa(binary);
      }
      if (native) {
        const result = await invoke<{status: string; snapshot?: string}>('plugin:mobile-pet|reminder_style', {payload: JSON.stringify({...value, kind, reminderId, action: 'save', audio})});
        if (result.status !== 'saved') throw new Error('Unsupported');
        const snapshot = JSON.parse(result.snapshot!);
        value.tone = snapshot.tone;
        if (snapshot.warning) window.setTimeout(() => toast(snapshot.warning), 1200);
      } else if (audio) { toast('自选铃声要在 App 里保存喔，这里可以先试听'); return; }
      const all = read(); all[scope(kind, reminderId)] = value; localStorage.setItem(key, JSON.stringify(all));
      refreshers.forEach(refresh => refresh()); renderManager(); sources.changed(); window.dispatchEvent(new CustomEvent('sanhao:reminder-style-saved',{detail:{kind}}));
      open(parent); toast('小提醒选好啦');
      if (value.sound || value.vibration) showReminderSettingsHelp(kind);
    } catch (error) { toast(error instanceof Error && error.message.startsWith('请选择') ? error.message : '还没保存好，再试一次吧'); }
    finally { save.disabled = false; }
  });
  panel.querySelector('#reminder-style-back')!.addEventListener('click', () => open(parent));
  new MutationObserver(() => {
    if (panel.hidden) { source?.stop(); source = undefined; if (native) void invoke('plugin:mobile-pet|reminder_style', {payload: JSON.stringify({kind, action:'stop'})}).catch(() => {}); }
  }).observe(panel, {attributes: true, attributeFilter:['hidden']});
}
