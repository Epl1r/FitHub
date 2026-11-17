'use strict';
// Сквозная проверка приложения в Playwright: эмуляция iPhone 13, страница — локальный index.html,
// Telegram и сервер подменены (никаких реальных запросов, Метрика не загружается).
// Запуск: node tests/smoke.js [dark|light]   — код выхода 1, если что-то сломалось; скриншоты в tests/out-<тема>/
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'index.html');
const scheme = process.argv[2] === 'light' ? 'light' : 'dark';
const OUT = path.join(__dirname, 'out-' + scheme);
fs.mkdirSync(OUT, { recursive: true });
const errors = [], fails = [], notes = [];
const ok = (cond, what) => { if (!cond) fails.push(what); else notes.push('✓ ' + what); };

const TG = `window.Telegram={WebApp:{initData:"query_id=1&user=%7B%22id%22%3A42%7D",initDataUnsafe:{user:{id:42,first_name:"Тест"}},
colorScheme:"${scheme}",themeParams:{},platform:"ios",version:"8.0",viewportHeight:700,viewportStableHeight:700,
isVersionAtLeast:function(){return true},ready:function(){},expand:function(){},onEvent:function(){},offEvent:function(){},
setHeaderColor:function(){},setBackgroundColor:function(){},setBottomBarColor:function(){},enableClosingConfirmation:function(){},disableVerticalSwipes:function(){},
HapticFeedback:{impactOccurred:function(){},notificationOccurred:function(){},selectionChanged:function(){}},
BackButton:{show:function(){},hide:function(){},onClick:function(){},offClick:function(){}},
MainButton:{show:function(){},hide:function(){},setText:function(){},onClick:function(){},offClick:function(){}},
showConfirm:function(t,cb){cb(true)},showAlert:function(t,cb){cb&&cb()},openLink:function(u){window.__links=(window.__links||[]).concat(u)},openTelegramLink:function(){},openInvoice:function(){},
CloudStorage:{_d:{},getItem:function(k,cb){cb(null,this._d[k]||"")},setItem:function(k,v,cb){this._d[k]=v;cb&&cb(null,true)},getItems:function(ks,cb){var o={};ks.forEach(k=>o[k]=this._d[k]||"");cb(null,o)},getKeys:function(cb){cb(null,Object.keys(this._d))},removeItem:function(k,cb){delete this._d[k];cb&&cb(null,true)}}}};`;

let voiceCall = 0;
function server(body) {
  if (body.action === 'premium') return { premium: false, left: 3, free: 3, daily: 30, price: 150, chatDaily: 50, chatFree: 5, chatLeft: 5, auto: false, videoFree: 1, videoDaily: 10, videoLeft: 1 };
  if (body.action === 'reminders' || body.action === 'seen') return { ok: true, rem: body.rem || null };
  if (body.action === 'voice') {
    voiceCall++;
    const water = (body.existing || []).find(x => /Вода/.test(x.text));
    if (voiceCall === 1) return { ok: true, text: 'волейбол в 19:00 каждый вторник и четверг', tasks: [
      { text: 'Волейбол', date: body.today, time: '19:00', end: '21:00', place: 'Зал, ул. Ленина, 5', repeat: 'weekly', days: [2, 4], until: '' }], remove: [] };
    return { ok: true, text: 'убери воду из плана', tasks: [], remove: water ? [{ id: water.id, date: '' }] : [] };
  }
  if (body.image && !body.action) return { is_food: true, comment: 'Гречка с котлетой', left: 2, items: [
    { name: 'гречка отварная', grams: 180, kcal: 198, protein: 7.6, fat: 2, carbs: 38, confidence: 'high' },
    { name: 'котлета куриная', grams: 120, kcal: 230, protein: 22, fat: 14, carbs: 5, confidence: 'medium' }] };
  return { ok: true };
}

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'ru-RU', timezoneId: 'Europe/Moscow', colorScheme: scheme });
  await ctx.grantPermissions(['microphone', 'camera'], { origin: 'https://epl1r.github.io' });
  const p = await ctx.newPage(); p.setDefaultTimeout(8000);
  p.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)); });
  p.on('dialog', d => d.accept());
  await p.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('https://epl1r.github.io/FitHub/')) return r.fulfill({ contentType: 'text/html; charset=utf-8', body: fs.readFileSync(FILE, 'utf8') });
    if (u.includes('telegram-web-app.js')) return r.fulfill({ contentType: 'text/javascript', body: TG });
    if (u.includes('functions.yandexcloud.net')) {
      let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(server(body)) });
    }
    return r.fulfill({ status: 404, body: '' });   // всё остальное (Метрика, CDN) — не трогаем
  });
  const shot = n => p.screenshot({ path: path.join(OUT, n + '.png') });
  const tab = async t => { await p.click('nav [data-tab="' + t + '"]'); await p.waitForTimeout(400); };

  try {
    // 1. Путь новичка: вопросы → «План готов» → позже
    await p.goto('https://epl1r.github.io/FitHub/'); await p.waitForTimeout(1200);
    await p.click('[data-g="Набрать мышечную массу"]'); await p.click('#onbN1');
    await p.click('#onbSex [data-v="m"]'); await p.fill('#onbAge', '20'); await p.fill('#onbH', '180'); await p.fill('#onbW', '75');
    await p.click('#onbN2'); await p.waitForTimeout(300);
    ok(/18:00/.test(await p.textContent('#onbMoreSum')), 'вопросы: ограничения и время свёрнуты, по умолчанию 18:00');
    await p.click('#onbN3'); await p.waitForTimeout(800);
    ok(await p.isVisible('#onbTry'), '«План готов»: кнопка первой тренировки');
    ok((await p.$$('#onbWhen .chip')).length >= 7, '«План готов»: выбор дня первой тренировки');
    await shot('1_plan_ready');
    await p.click('#onbGo'); await p.waitForTimeout(1500);
    ok(await p.isVisible('#fsCard'), 'главная: «Первые шаги» у новичка');
    ok((await p.$$('#homeTasks .trow')).length > 0, 'главная: задачи дня из плана');
    await shot('2_home');

    // 2. Тренировка: вводная
    await tab('train');
    ok(await p.isVisible('#thIntro'), 'тренировка: ссылка на вводную, пока не было тренировок');
    await p.click('#thIntro'); await p.waitForTimeout(800);
    ok(await p.evaluate(() => document.getElementById('ws').classList.contains('open')), 'тренировка: вводная запускается');
    await p.evaluate(() => { const x = document.getElementById('wsX') || document.querySelector('#ws [data-act="close"]'); if (x) x.click(); });
    await p.reload(); await p.waitForTimeout(2000);

    // 3. Питание: фото → «Добавить в …» → дневник
    await tab('food');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await p.setInputFiles('#galIn', { name: 'dish.png', mimeType: 'image/png', buffer: png });
    await p.waitForSelector('#aiCard', { state: 'visible', timeout: 15000 });
    ok(/^Добавить в .+ · \d+ ккал$/.test((await p.textContent('#aiAdd')).trim()), 'питание: кнопка «Добавить в <приём> · N ккал»');
    await shot('3_food_ai');
    await p.click('#aiAdd'); await p.waitForTimeout(500);
    ok(/гречка/i.test(await p.textContent('#diary')), 'питание: еда попала в дневник');

    // 4. Календарь: голосом — повтор по дням и «убери воду»
    await tab('home'); await p.click('#qCal'); await p.waitForTimeout(400);
    await p.click('#vBtn'); await p.waitForTimeout(1500); await p.click('#vStop');
    await p.waitForSelector('#vRes', { state: 'visible', timeout: 10000 });
    ok(/По вт, чт/.test(await p.textContent('#vList')), 'голос: повтор по вт и чт в разборе');
    await shot('4_voice');
    await p.click('#vSave'); await p.waitForTimeout(500);
    const volley = await p.evaluate(() => JSON.parse(localStorage.getItem('fithub_routine')).find(r => r.text === 'Волейбол'));
    ok(volley && volley.wds.join() === '2,4' && volley.until && volley.end === '21:00' && volley.place, 'голос: волейбол сохранён с днями, сроком, концом и местом');
    await p.click('#vBtn'); await p.waitForTimeout(1500); await p.click('#vStop');
    await p.waitForSelector('#vRes', { state: 'visible', timeout: 10000 });
    ok(/Убрать: .*Вода/.test(await p.textContent('#vList')), 'голос: «убери воду» — строка удаления');
    await p.click('#vSave'); await p.waitForTimeout(500);
    ok(!(await p.evaluate(() => JSON.parse(localStorage.getItem('fithub_routine')).some(r => /Вода/.test(r.text)))), 'голос: вода убрана из распорядка');

    // 5. Календарь вручную: по дням
    await p.fill('#tText', 'Бассейн'); await p.fill('#tTime', '10:00');
    await p.click('#tRep [data-r="weekly"]'); await p.click('#tWds [data-w="6"]');
    await p.click('#taskAdd'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => JSON.parse(localStorage.getItem('fithub_routine')).some(r => r.text === 'Бассейн' && r.wds && r.wds.indexOf(6) >= 0)), 'календарь: задача по дням вручную');

    // 6. Профиль: свёрнутые разделы
    await p.click('#calBack'); await tab('profile');
    ok(/подряд/.test(await p.textContent('#fireSum')) && (await p.textContent('#themeSum')).length > 0, 'профиль: итоги в свёрнутых разделах');
    await shot('5_profile');

    // 7. Все вкладки без ошибок
    for (const t of ['home', 'food', 'train', 'profile']) await tab(t);
  } catch (e) { fails.push('сценарий прервался: ' + e.message.split('\n')[0]); }

  await b.close();
  console.log(notes.join('\n'));
  if (errors.length) console.log('Ошибки в консоли:\n' + errors.join('\n'));
  if (fails.length) console.log('НЕ ПРОШЛО:\n' + fails.map(f => '✗ ' + f).join('\n'));
  console.log((fails.length || errors.length ? '✗ ' : '✓ ') + scheme + ': проверок ' + (notes.length + fails.length) + ', не прошло ' + fails.length + ', ошибок в консоли ' + errors.length);
  process.exit(fails.length || errors.length ? 1 : 0);
})();
