const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const scenes = {
  morning: { title: '晨雾松林', kicker: 'THE FOREST AWAKENS', description: '深呼吸。听见风，也听见自己。', phase: 'morning', weather: 'mist', position: '50% 50%' },
  rain: { title: '雨落青苔', kicker: 'A SOFT RAIN, A QUIET MIND', description: '让雨声落下，把心事轻轻放下。', phase: 'afternoon', weather: 'rain', position: '30% 65%' },
  night: { title: '萤火之境', kicker: 'WHERE LITTLE LIGHTS WANDER', description: '世界安静下来，微光慢慢亮起。', phase: 'night', weather: 'clear', position: '70% 40%' }
};
const phaseNames = { morning: '晨间', afternoon: '午后', night: '夜晚' };
const weatherNames = { clear: '晴朗', mist: '薄雾', rain: '小雨' };
const state = { scene: 'morning', phase: 'morning', weather: 'mist', playing: false, master: .6, channels: { wind: { enabled: true, volume: .55 }, birds: { enabled: true, volume: .4 }, water: { enabled: false, volume: .35 }, rain: { enabled: false, volume: .45 } } };
let moments = [];
try { const stored = JSON.parse(localStorage.getItem('senjian-moments') || '[]'); if (Array.isArray(stored)) moments = stored.filter(m => m && scenes[m.scene] && phaseNames[m.phase] && weatherNames[m.weather] && Number.isFinite(m.created) && typeof m.id === 'string').slice(0, 100); } catch { /* A fresh notebook remains usable if storage is unavailable. */ }
const view = $('#forest-view');
let toastTimeout;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('#toast').classList.remove('show'), 3200); }
function setSelected(container, key, value) { $$(`button[data-${key}]`, $(container)).forEach(button => { const selected = button.dataset[key] === value; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); }); }
function renderEnvironment() {
  view.dataset.phase = state.phase; view.dataset.weather = state.weather;
  setSelected('#phase-options', 'phase', state.phase); setSelected('#weather-options', 'weather', state.weather);
  $('#scene-condition').textContent = `${phaseNames[state.phase]} · ${weatherNames[state.weather]}`;
  $('#weather-icon use').setAttribute('href', state.weather === 'rain' ? '#i-rain' : state.phase === 'night' ? '#i-moon' : '#i-sun');
  updateSaveButton();
}
function selectScene(name, saved) {
  const scene = scenes[name]; if (!scene) return;
  state.scene = name; state.phase = saved?.phase || scene.phase; state.weather = saved?.weather || scene.weather;
  $$('.scene-card').forEach(button => { const active = button.dataset.scene === name; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); const badge = $('.scene-live', button); if (badge) badge.remove(); if (active) { const span = document.createElement('span'); span.className = 'scene-live'; span.textContent = '正在漫游'; $('.scene-thumb', button).append(span); } });
  $('#scene-title').textContent = scene.title; $('#scene-kicker').textContent = scene.kicker; $('#scene-description').textContent = scene.description;
  $('#forest-image').style.objectPosition = scene.position; view.setAttribute('aria-label', `${scene.title}风景`);
  state.channels.rain.enabled = state.weather === 'rain'; state.channels.birds.enabled = state.phase !== 'night';
  renderEnvironment(); renderChannels();
}
$$('.scene-card').forEach(button => button.addEventListener('click', () => selectScene(button.dataset.scene)));
$$('#phase-options button').forEach(button => button.addEventListener('click', () => { state.phase = button.dataset.phase; renderEnvironment(); }));
$$('#weather-options button').forEach(button => button.addEventListener('click', () => { state.weather = button.dataset.weather; renderEnvironment(); }));
$$('input[type=range]').forEach(input => { const paint = () => input.style.setProperty('--range', `${input.value}%`); paint(); input.addEventListener('input', paint); });

// All ambience is synthesized locally. Nothing is downloaded or recorded.
let audio, masterGain, birdTimer;
const noiseGains = {};
function createAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) throw new Error('Audio unavailable');
  audio = new AudioContext(); masterGain = audio.createGain(); masterGain.gain.value = 0; masterGain.connect(audio.destination);
  const buffer = audio.createBuffer(1, audio.sampleRate * 6, audio.sampleRate);
  const data = buffer.getChannelData(0); let last = 0;
  for (let i = 0; i < data.length; i++) { const white = Math.random() * 2 - 1; last = (last + white * .02) / 1.02; data[i] = last * 3.5; }
  for (const [name, frequency, q] of [['wind', 330, .55], ['water', 1700, .65], ['rain', 4200, .4]]) {
    const source = audio.createBufferSource(); source.buffer = buffer; source.loop = true;
    const filter = audio.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = q;
    const gain = audio.createGain(); gain.gain.value = 0; source.connect(filter); filter.connect(gain); gain.connect(masterGain); source.start(); noiseGains[name] = gain;
    if (name === 'wind') { const lfo = audio.createOscillator(); lfo.frequency.value = .09; const modulation = audio.createGain(); modulation.gain.value = 100; lfo.connect(modulation); modulation.connect(filter.frequency); lfo.start(); }
  }
}
function chirp() {
  if (!audio || !state.playing || !state.channels.birds.enabled || state.channels.birds.volume === 0) return;
  const time = audio.currentTime; const base = 1800 + Math.random() * 1600;
  for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
    const oscillator = audio.createOscillator(); const envelope = audio.createGain(); const pan = audio.createStereoPanner(); pan.pan.value = Math.random() * 1.5 - .75;
    const t = time + i * .17; oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(base, t); oscillator.frequency.exponentialRampToValueAtTime(base * 1.45, t + .065); oscillator.frequency.exponentialRampToValueAtTime(base * .87, t + .14);
    envelope.gain.setValueAtTime(0, t); envelope.gain.linearRampToValueAtTime(state.channels.birds.volume * .09, t + .02); envelope.gain.exponentialRampToValueAtTime(.0001, t + .15);
    oscillator.connect(envelope); envelope.connect(pan); pan.connect(masterGain); oscillator.start(t); oscillator.stop(t + .18);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); pan.disconnect(); };
  }
}
function scheduleBird() { clearTimeout(birdTimer); if (!state.playing) return; birdTimer = setTimeout(() => { chirp(); scheduleBird(); }, 2200 + Math.random() * 5200); }
function updateAudio() {
  if (!audio) return; const time = audio.currentTime;
  masterGain.gain.setTargetAtTime(state.playing ? state.master : 0, time, .3);
  for (const [name, gain] of Object.entries(noiseGains)) gain.gain.setTargetAtTime(state.channels[name].enabled ? state.channels[name].volume * (name === 'wind' ? .7 : 1.1) : 0, time, .25);
}
function renderChannels() {
  $$('[data-sound]').forEach(button => { const enabled = state.channels[button.dataset.sound].enabled; button.classList.toggle('enabled', enabled); button.setAttribute('aria-pressed', String(enabled)); $('.channel-state', button).textContent = enabled ? '开启' : '关闭'; });
  updateAudio();
}
$('#sound-toggle').addEventListener('click', async () => {
  try {
    if (!audio) createAudio(); await audio.resume(); state.playing = !state.playing; updateAudio(); scheduleBird();
    view.classList.toggle('playing', state.playing); $('#sound-toggle').setAttribute('aria-pressed', String(state.playing)); $('#sound-toggle').setAttribute('aria-label', state.playing ? '暂停自然声音' : '播放自然声音');
    $('#sound-toggle use').setAttribute('href', state.playing ? '#i-pause' : '#i-play'); $('#sound-status').textContent = state.playing ? '正在听见森林' : '让森林有声音'; $('#sound-subtitle').textContent = state.playing ? '让自然陪你，安静一会儿' : '轻触播放，听见自然';
  } catch { toast('当前浏览器无法播放环境音，可以继续欣赏森林。'); }
});
$$('[data-sound]').forEach(button => button.addEventListener('click', () => { const channel = state.channels[button.dataset.sound]; channel.enabled = !channel.enabled; renderChannels(); }));
$$('[data-volume]').forEach(input => input.addEventListener('input', () => { state.channels[input.dataset.volume].volume = Number(input.value) / 100; updateAudio(); }));
$('#master-volume').addEventListener('input', event => { state.master = Number(event.target.value) / 100; $('#master-value').textContent = `${event.target.value}%`; updateAudio(); });

// Small atmospheric details are drawn on a single canvas.
const canvas = $('#nature-canvas'); const context = canvas.getContext('2d');
let width = 0, height = 0, lastFrame = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const particles = Array.from({ length: 85 }, () => ({ x: Math.random(), y: Math.random(), speed: .4 + Math.random(), size: 1 + Math.random() * 1.6, offset: Math.random() * Math.PI * 2 }));
new ResizeObserver(() => { const rect = view.getBoundingClientRect(); width = rect.width; height = rect.height; const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = width * dpr; canvas.height = height * dpr; context.setTransform(dpr, 0, 0, dpr, 0, 0); }).observe(view);
function animate(time) {
  requestAnimationFrame(animate); if (document.hidden || time - lastFrame < 33) return; const delta = Math.min(time - lastFrame, 80) / 1000; lastFrame = time;
  context.clearRect(0, 0, width, height);
  if (state.weather === 'rain') { context.strokeStyle = state.phase === 'night' ? '#c9dde329' : '#e0ece864'; context.lineWidth = .6; for (const p of particles) { if (!reducedMotion.matches) { p.y += delta * p.speed * .5; p.x -= delta * .018; if (p.y > 1.05) p.y = -.05; if (p.x < 0) p.x = 1; } context.beginPath(); context.moveTo(p.x * width, p.y * height); context.lineTo(p.x * width - 3, p.y * height + 12 * p.speed); context.stroke(); } }
  else if (state.phase === 'night') { for (const p of particles.slice(0, 24)) { const t = reducedMotion.matches ? p.offset : time / 2200 + p.offset; const x = p.x * width + Math.sin(t * .3) * 15, y = height * .28 + p.y * height * .65 + Math.cos(t * .4) * 13; const opacity = .15 + (Math.sin(t * p.speed) + 1) * .25; const glow = context.createRadialGradient(x, y, 0, x, y, 9); glow.addColorStop(0, `rgba(225,244,140,${opacity})`); glow.addColorStop(1, 'rgba(225,244,140,0)'); context.fillStyle = glow; context.fillRect(x - 9, y - 9, 18, 18); context.fillStyle = `rgba(240,251,170,${opacity + .15})`; context.beginPath(); context.arc(x, y, p.size * .6, 0, Math.PI * 2); context.fill(); } }
  else { for (const p of particles.slice(0, 16)) { const t = reducedMotion.matches ? p.offset : time / 12000 + p.offset; context.fillStyle = '#f5edc34d'; context.beginPath(); context.arc(p.x * width + Math.sin(t) * 20, p.y * height + Math.cos(t) * 15, p.size * .5, 0, Math.PI * 2); context.fill(); } }
}
requestAnimationFrame(animate);

function enterImmersive() { view.classList.add('immersed'); document.body.style.overflow = 'hidden'; $('#leave-immersive').focus(); }
function leaveImmersive() { view.classList.remove('immersed'); document.body.style.overflow = ''; $('#immersive').focus(); }
$('#immersive').addEventListener('click', enterImmersive); $('#leave-immersive').addEventListener('click', leaveImmersive);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && view.classList.contains('immersed')) leaveImmersive(); });

function currentMoment() { return moments.find(m => m.scene === state.scene && m.phase === state.phase && m.weather === state.weather); }
function updateSaveButton() { const saved = Boolean(currentMoment()); $('#save-moment').classList.toggle('saved', saved); $('#save-moment').setAttribute('aria-pressed', String(saved)); $('#save-moment').setAttribute('aria-label', saved ? '取消收藏此刻' : '收藏此刻'); const counter = $('.saved-count'); counter.textContent = String(moments.length); counter.hidden = !moments.length; }
function persistMoments() { try { localStorage.setItem('senjian-moments', JSON.stringify(moments)); return true; } catch { toast('浏览器未允许存储，拾光仅保留到本次页面关闭。'); return false; } }
$('#save-moment').addEventListener('click', () => { const existing = currentMoment(); if (existing) { moments = moments.filter(m => m.id !== existing.id); persistMoments(); toast('已从拾光中移除'); } else { moments.unshift({ id: crypto.randomUUID?.() || String(Date.now()), scene: state.scene, phase: state.phase, weather: state.weather, created: Date.now() }); moments = moments.slice(0, 100); if (persistMoments()) toast('这一刻，已收进你的拾光。'); } updateSaveButton(); });
function renderJournal() {
  const list = $('#journal-list'); list.replaceChildren();
  if (!moments.length) { list.innerHTML = '<div class="journal-empty"><svg><use href="#i-leaf"/></svg><p>还没有收好的瞬间</p><small>点击风景右侧的爱心，留下你喜欢的此刻。</small></div>'; return; }
  for (const m of moments) {
    const entry = document.createElement('article'); entry.className = 'journal-entry';
    const thumb = document.createElement('div'); thumb.className = 'journal-entry-thumb'; thumb.style.filter = m.phase === 'night' ? 'brightness(.3)' : m.weather === 'rain' ? 'brightness(.65)' : ''; thumb.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('div'); copy.className = 'journal-entry-copy'; const title = document.createElement('strong'); title.textContent = scenes[m.scene].title; const detail = document.createElement('small'); detail.textContent = `${phaseNames[m.phase]} · ${weatherNames[m.weather]} · ${new Date(m.created).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}`; copy.append(title, detail);
    const revisit = document.createElement('button'); revisit.textContent = '再看看'; revisit.addEventListener('click', () => { selectScene(m.scene, m); $('#journal-dialog').close(); });
    const remove = document.createElement('button'); remove.className = 'remove-moment'; remove.setAttribute('aria-label', `删除${scenes[m.scene].title}拾光`); remove.innerHTML = '<svg><use href="#i-close"/></svg>'; remove.addEventListener('click', () => { moments = moments.filter(item => item.id !== m.id); persistMoments(); updateSaveButton(); renderJournal(); });
    entry.append(thumb, copy, revisit, remove); list.append(entry);
  }
}
$('#journal-nav').addEventListener('click', () => { renderJournal(); $('#journal-dialog').showModal(); });
$('#about-button').addEventListener('click', () => $('#about-dialog').showModal());
$('#explore-nav').addEventListener('click', () => $('#main').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth' }));
$$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target !== dialog) return; const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); }));

$('#snapshot').addEventListener('click', async () => {
  const image = $('#forest-image'); if (!image.complete || !image.naturalWidth) { toast('风景还在加载，请稍后再试。'); return; }
  const button = $('#snapshot'); button.disabled = true;
  try {
    const card = document.createElement('canvas'); card.width = 1600; card.height = 1100; const ctx = card.getContext('2d');
    ctx.fillStyle = '#f5f6ef'; ctx.fillRect(0, 0, 1600, 1100);
    ctx.filter = state.phase === 'night' ? 'brightness(.3) saturate(.55)' : state.weather === 'rain' ? 'brightness(.68) saturate(.72)' : state.phase === 'afternoon' ? 'sepia(.15) brightness(1.08)' : 'none';
    const targetRatio = 1520 / 875; const ratio = image.naturalWidth / image.naturalHeight;
    const cropWidth = ratio > targetRatio ? image.naturalHeight * targetRatio : image.naturalWidth;
    const cropHeight = ratio > targetRatio ? image.naturalHeight : image.naturalWidth / targetRatio;
    ctx.drawImage(image, (image.naturalWidth - cropWidth) / 2, (image.naturalHeight - cropHeight) / 2, cropWidth, cropHeight, 40, 40, 1520, 875); ctx.filter = 'none';
    const shade = ctx.createLinearGradient(0, 700, 0, 915); shade.addColorStop(0, 'transparent'); shade.addColorStop(1, '#102219a8'); ctx.fillStyle = shade; ctx.fillRect(40, 40, 1520, 875);
    ctx.fillStyle = '#f6f7eb'; ctx.font = '46px "Noto Serif SC", SimSun, serif'; ctx.fillText(scenes[state.scene].title, 100, 835);
    ctx.fillStyle = '#61734f'; ctx.font = '32px "Noto Serif SC", SimSun, serif'; ctx.fillText('森间 · 不用抵达哪里。在这里，就很好。', 60, 995);
    ctx.fillStyle = '#939f86'; ctx.font = '19px sans-serif'; ctx.fillText(`${phaseNames[state.phase]} / ${weatherNames[state.weather]}     ${new Date().toLocaleDateString('zh-CN')}`, 62, 1045);
    const blob = await new Promise(resolve => card.toBlob(resolve, 'image/png')); if (!blob) throw new Error('No image');
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `森间-${scenes[state.scene].title}.png`; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); toast('森林明信片已准备好下载。');
  } catch { toast('明信片未能生成，请稍后再试。'); } finally { button.disabled = false; }
});

let breathDuration = 60, breathTimer, breathStart = 0, lastCycle = -1;
function resetBreath() { clearInterval(breathTimer); breathTimer = null; lastCycle = -1; $('.breath-circle').classList.remove('inhale', 'exhale'); $('#breath-cue').textContent = '准备好了吗'; $('#breath-count').textContent = '跟随光圈，缓慢呼吸'; $('#start-breath').textContent = '开始呼吸'; $$('.duration-options button').forEach(button => button.disabled = false); }
function openBreath() { resetBreath(); $('#breath-dialog').showModal(); }
$('#breath-nav').addEventListener('click', openBreath); $('#breath-shortcut').addEventListener('click', openBreath);
$('#breath-dialog').addEventListener('close', resetBreath);
$$('[data-duration]').forEach(button => button.addEventListener('click', () => { breathDuration = Number(button.dataset.duration); setSelected('.duration-options', 'duration', button.dataset.duration); }));
$('#start-breath').addEventListener('click', () => {
  if (breathTimer) { resetBreath(); return; }
  breathStart = performance.now(); lastCycle = -1; $('#start-breath').textContent = '结束练习'; $$('.duration-options button').forEach(button => button.disabled = true);
  function tick() {
    const elapsed = (performance.now() - breathStart) / 1000; const remaining = Math.max(0, breathDuration - elapsed);
    if (!remaining) { resetBreath(); $('#breath-cue').textContent = '做得很好'; $('#breath-count').textContent = '把这份平静，带回生活里'; toast('呼吸练习完成，慢慢睁开眼睛。'); return; }
    const cycle = Math.floor(elapsed / 10); const inhale = elapsed % 10 < 4; const circle = $('.breath-circle');
    if (cycle !== lastCycle || circle.classList.contains('inhale') !== inhale) { circle.classList.toggle('inhale', inhale); circle.classList.toggle('exhale', !inhale); lastCycle = cycle; }
    $('#breath-cue').textContent = inhale ? '轻轻吸气' : '慢慢呼气'; $('#breath-count').textContent = `还剩 ${Math.ceil(remaining)} 秒`;
  }
  breathTimer = setInterval(tick, 100); tick();
});
let visibleSeconds = 0; let previousTime = performance.now();
setInterval(() => { const now = performance.now(); if (!document.hidden) visibleSeconds += Math.min((now - previousTime) / 1000, 2); previousTime = now; const seconds = Math.floor(visibleSeconds); $('#session-time').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }, 1000);
updateSaveButton();
