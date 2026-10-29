import {invoke} from '@tauri-apps/api/core';
import type {SolarDay} from './home-light-cycle';
const menuKey = 'sanhao-tu.companion.meals.v1';
const weatherKey = 'sanhao-tu.companion.weather.v1';
export const defaultMeals = ['葱烧鸡腿饭', '番茄肉酱拌饭', '土豆胡萝卜牛腩饭', '广式腊味煲仔饭', '扬州炒饭', '黑椒牛肉焗饭', '番茄金针菇烫饭', '培根蘑菇烩饭', '肥牛煎蛋拌饭', '海苔鸡肉炒饭', '老北京炸酱面', '陕西臊子面', '宁波三鲜面', '孜然炒面', '梅州腌面', '酸辣拌面', '番茄虾仁汤面', '葱油拌面', '青菜鸡蛋汤面', '重庆小面'];
export function cleanMeals(items: string[]) {
  return [...new Set(items.map(item => item.trim().slice(0, 40)).filter(Boolean))].slice(0, 100);
}
export const weatherRules = ['cold', 'heat', 'rain', 'sunWind'] as const;
export type WeatherRule = typeof weatherRules[number];
export type WeatherSettings = {enabled: boolean; time: string; times: string[]; rules: WeatherRule[]};
export function normalizeWeather(value: {enabled?: boolean; time?: string; times?: unknown; rules?: unknown} | null): WeatherSettings {
  const valid = (time: unknown): time is string => typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const supplied = Array.isArray(value?.times) ? value.times : [value?.time];
  const times = [...new Set(supplied.filter(valid))].sort().slice(0, 6);
  if (!times.length) times.push('08:00');
  const rules = Array.isArray(value?.rules) ? weatherRules.filter(rule => (value.rules as unknown[]).includes(rule)) : [...weatherRules];
  return {enabled: value?.enabled === true, time: times[0], times, rules};
}
export function setupCompanionSettings(options: {openSheet: (panel: HTMLElement) => void; toast: (message: string) => void; sync: (action?: string) => Promise<boolean>; preview: boolean}) {
  let mealName='今天', awaitingMealChoice=false;
  let meals = [...defaultMeals], weather = normalizeWeather({}), force = false, choice = '', bulletin = '';
  try { const saved = JSON.parse(localStorage.getItem(menuKey) || 'null'); if (Array.isArray(saved) && saved.every(item => typeof item === 'string')) meals = cleanMeals(saved); } catch { /* Preserve malformed stored data. */ }
  try { weather = normalizeWeather(JSON.parse(localStorage.getItem(weatherKey) || '{}')); } catch { /* Default 08:00. */ }
  const mealPanel = document.querySelector<HTMLElement>('#meal-settings-panel')!;
  const weatherPanel = document.querySelector<HTMLElement>('#weather-settings-panel')!;
  const list = document.querySelector<HTMLElement>('#meal-options')!;
  const input = document.querySelector<HTMLInputElement>('#meal-add-input')!;
  const timeList = document.querySelector<HTMLElement>('#weather-times')!;
  const ruleInputs = [...document.querySelectorAll<HTMLInputElement>('[data-weather-rule]')];
  const enabled = document.querySelector<HTMLInputElement>('#weather-enabled')!;
  const result = document.querySelector<HTMLElement>('#meal-result')!;
  const status = document.querySelector<HTMLElement>('#weather-status')!;
  const summary = document.querySelector<HTMLElement>('#weather-setting-summary')!;
  function render() {
    list.replaceChildren();
    for (const item of meals) {
      const chip = document.createElement('span'); chip.className = 'meal-chip';
      const title = document.createElement('span'); title.textContent = item;
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `移除${item}`);
      remove.addEventListener('click', () => { meals = meals.filter(value => value !== item); saveMeals(); });
      chip.append(title, remove); list.append(chip);
    }
    if (!meals.length) list.textContent = '菜单空啦，加一道喜欢的菜吧';
    summary.textContent = `${weather.enabled ? '已开启' : '未开启'} · ${weather.times.join('、')}`;
    enabled.checked = weather.enabled;
    ruleInputs.forEach(input => { input.checked = weather.rules.includes(input.dataset.weatherRule as WeatherRule); });
    timeList.replaceChildren();
    weather.times.forEach((value, index) => {
      const row = document.createElement('div'); row.className = 'weather-time-row';
      const input = document.createElement('input'); input.type = 'time'; input.value = value; input.setAttribute('aria-label', `提醒时间 ${index + 1}`);
      input.addEventListener('change', () => { const times = [...weather.times]; times[index] = input.value; weather = normalizeWeather({...weather, times}); saveWeather(); });
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'weather-time-remove'; remove.textContent = '移除'; remove.disabled = weather.times.length === 1;
      remove.setAttribute('aria-label', `移除 ${value} 提醒`);
      remove.addEventListener('click', () => { weather = normalizeWeather({...weather, times: weather.times.filter((_, i) => i !== index)}); saveWeather(); });
      row.append(input, remove); timeList.append(row);
    });
    (document.querySelector('#weather-add-time') as HTMLButtonElement).disabled = weather.times.length >= 6;
  }
  function saveMeals() { localStorage.setItem(menuKey, JSON.stringify(meals)); render(); void options.sync(); }
  function add() {
    const item = input.value.trim();
    if (!item) return;
    if (meals.length >= 100) { options.toast('菜单最多放 100 道菜'); return; }
    meals = cleanMeals([...meals, item]); input.value = ''; saveMeals();
  }
  document.querySelector('#meal-add')!.addEventListener('click', add);
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); add(); } });
  function openMeal(id?:string){awaitingMealChoice=false;mealName=({breakfast:'早餐',lunch:'午餐',dinner:'晚餐'} as Record<string,string>)[id||'']||'今天';mealPanel.querySelector('h2')!.textContent=mealName+'吃什么';document.querySelector('#meal-pick')!.textContent='帮我选'+(mealName==='今天'?'一顿':mealName);result.textContent=mealName==='今天'?'兔兔帮你从喜欢的菜单里选一顿':`让兔兔帮你决定${mealName}吃什么吧`;render();options.openSheet(mealPanel)}
  document.querySelector('#open-meal-settings')!.addEventListener('click',()=>openMeal());
  window.addEventListener('sanhao:open-meal',event=>openMeal((event as CustomEvent).detail));
  document.querySelector('#meal-pick')!.addEventListener('click', async () => {
    if (!meals.length) { result.textContent = '先加一道喜欢的菜吧'; return; }
    if (options.preview) {
      const choices = meals.length > 1 ? meals.filter(item => item !== choice) : meals;
      choice = choices[Math.floor(Math.random() * choices.length)]; result.textContent = `${mealName}吃：${choice}`;
    } else {awaitingMealChoice=true;if(!await options.sync('meal')){awaitingMealChoice=false;options.toast('这次没有选好，稍后再试一下')}};
  });
  document.querySelector('#open-weather-settings')!.addEventListener('click', () => { render(); options.openSheet(weatherPanel); });
  function saveWeather() {
    weather = normalizeWeather({...weather, enabled: enabled.checked, rules: ruleInputs.filter(input => input.checked).map(input => input.dataset.weatherRule)});
    localStorage.setItem(weatherKey, JSON.stringify(weather)); force = true; render();
    if (options.preview) { status.textContent = '开启后，到时间会收到天气小叮咛'; status.hidden = !weather.enabled; }
    void options.sync();
  }
  enabled.addEventListener('change', saveWeather);
  ruleInputs.forEach(input => input.addEventListener('change', saveWeather));
  document.querySelector('#weather-add-time')!.addEventListener('click', () => {
    if (weather.times.length >= 6) return;
    const candidates = ['12:00', '18:00', '07:00', '09:00', '21:00', '08:00', '15:00'];
    const next = candidates.find(time => !weather.times.includes(time))!;
    weather = normalizeWeather({...weather, times: [...weather.times, next]}); saveWeather();
  });
  document.querySelector('#weather-refresh')!.addEventListener('click', saveWeather);
  window.addEventListener('sanhao:reminder-style-saved',event=>{if((event as CustomEvent).detail?.kind==='weather')void saveWeather()});
  function accept(data: {openMeal?:string;openWeather?:boolean;weather?: {message?: string; mark?: string; legal?: string; current?:{date:string;bulletin?:string}; solar?:SolarDay[]}; meal?: {lastChoice?: string}}) {
    if(data.openWeather) options.openSheet(weatherPanel);if(data.openMeal)openMeal(data.openMeal);
    const report=data.weather?.current, currentDay=new Date(), day=[currentDay.getFullYear(),String(currentDay.getMonth()+1).padStart(2,'0'),String(currentDay.getDate()).padStart(2,'0')].join('-');
    bulletin=report?.date===day?report.bulletin||'':'';
    document.querySelector<HTMLElement>('#weather-bulletin')!.hidden=!bulletin;
    document.querySelector<HTMLElement>('#weather-bulletin-text')!.textContent=bulletin;
    if(data.weather?.solar)window.dispatchEvent(new CustomEvent('sanhao:solar-update',{detail:data.weather.solar}));
    if (!data.openMeal && data.meal?.lastChoice) { choice = data.meal.lastChoice;if(awaitingMealChoice){result.textContent = `${mealName}吃：${choice}`;awaitingMealChoice=false} }
    if (data.weather?.message) {
      status.textContent = data.weather.message;
      // Keep actionable failures and progress visible, omit implementation notes.
      status.hidden = /天气已更新|提醒已更新|灯光时间已更新|已关闭|开启后使用|没有需要提醒/.test(data.weather.message);
    }
    const credit = document.querySelector<HTMLAnchorElement>('#weather-credit')!;
    const logo = credit.querySelector<HTMLImageElement>('img')!;
    // Only display WeatherKit's official attribution endpoints.
    const valid = (value?: string) => { try { return new URL(value || '').protocol === 'https:' && /(^|\.)apple\.com$/.test(new URL(value!).hostname); } catch { return false; } };
    credit.hidden = !valid(data.weather?.legal);
    if (valid(data.weather?.legal)) credit.href = data.weather!.legal!;
    logo.hidden = !valid(data.weather?.mark);
    if (valid(data.weather?.mark)) logo.src = data.weather!.mark!;
  }
  document.querySelector('#weather-speak')!.addEventListener('click',async()=>{if(!bulletin)return;try{if(options.preview){const voice=new SpeechSynthesisUtterance(bulletin);voice.lang='zh-CN';speechSynthesis.cancel();speechSynthesis.speak(voice)}else await invoke('plugin:mobile-pet|speak_weather',{payload:JSON.stringify({text:bulletin})})}catch{options.toast('暂时没能读出来，再试一次吧')}});
  document.querySelector('#weather-stop')!.addEventListener('click',()=>{if(options.preview)speechSynthesis.cancel();else void invoke('plugin:mobile-pet|speak_weather',{payload:JSON.stringify({stop:true})})});
  render();
  return {payload: () => ({meals, weather:{...weather,autoLights:true}, weatherRefresh: force}), acknowledged: () => { force = false; }, accept};
}
