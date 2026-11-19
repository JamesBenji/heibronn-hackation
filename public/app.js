const $ = id => document.getElementById(id);
const sampleSource = 'Active recall means trying to bring information to mind before seeing the answer. This effort can strengthen later remembering. Progressive support begins with a challenge and gradually makes the target answer easier to perceive when the learner needs help. When the learner starts responding, support stops increasing, and it resumes if they stop before completing a correct response. The goal is to produce the response yourself with only as much help as you need.';
const sampleItems = [
  { question: 'What is active recall?', answer: 'Trying to bring information to mind before seeing the answer.', excerpt: 'Active recall means trying to bring information to mind before seeing the answer.' },
  { question: 'What happens to support while the learner responds?', answer: 'It stops increasing, then resumes if they stop before completing a correct response.', excerpt: 'When the learner starts responding, support stops increasing, and it resumes if they stop before completing a correct response.' },
  { question: 'What is the goal of progressive support?', answer: 'To produce the response yourself with only as much help as you need.', excerpt: 'The goal is to produce the response yourself with only as much help as you need.' }
];

let items = [], index = 0, recalled = 0, history = [], demo = false;
let progress = 0, lastFrame = 0, lastTyping = 0, manualPause = false, finished = false;
const THINK_MS = 3000, REVEAL_MS = 26000, TYPING_PAUSE_MS = 1400;

function stage(id) {
  for (const node of document.querySelectorAll('.stage')) node.hidden = node.id !== id;
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function error(message) { $('setup-error').textContent = message; $('setup-error').hidden = !message; }
function busy(button, value, text) { button.disabled = value; button.dataset.original ||= button.innerHTML; button.innerHTML = value ? text : button.dataset.original; }
async function post(path, payload) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
function renderReview() {
  const list = $('item-list'); list.replaceChildren();
  items.forEach((item, i) => {
    const row = document.createElement('div'); row.className = 'item';
    const content = document.createElement('div');
    const label = document.createElement('span'); label.className = 'card-label'; label.textContent = `QUESTION ${String(i + 1).padStart(2, '0')}`;
    const question = document.createElement('strong'); question.textContent = item.question;
    const excerpt = document.createElement('small'); excerpt.textContent = `Source: “${item.excerpt}”`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove';
    remove.addEventListener('click', () => { items.splice(i, 1); renderReview(); });
    content.append(label, question, excerpt); row.append(content, remove); list.append(row);
  });
  $('begin').disabled = items.length === 0;
}

function drawReveal() {
  const text = items[index].answer;
  const chars = Array.from(text);
  const visible = progress <= THINK_MS ? 0 : Math.min(1, (progress - THINK_MS) / REVEAL_MS);
  const reach = visible * (chars.length + 4);
  const fragment = document.createDocumentFragment();
  chars.forEach((char, i) => {
    const node = document.createElement('span'); node.textContent = char;
    const clarity = Math.max(0, Math.min(1, (reach - i) / 4));
    node.style.opacity = String(clarity);
    node.style.filter = `blur(${(1 - clarity) * 5}px)`;
    fragment.append(node);
  });
  $('reveal').replaceChildren(fragment);
  $('reveal-percent').textContent = `${Math.round(visible * 100)}%`;
  $('reveal-bar').style.width = `${visible * 100}%`;
}

function tick(now) {
  if (!$('session').hidden && !finished) {
    if (!lastFrame) lastFrame = now;
    const typing = now - lastTyping < TYPING_PAUSE_MS;
    if (!manualPause && !typing) progress = Math.min(THINK_MS + REVEAL_MS, progress + Math.min(now - lastFrame, 200));
    $('reveal-status').textContent = manualPause ? 'Reveal paused. Take your time.' : typing ? 'Paused while you respond.' : progress < THINK_MS ? 'Think it through. You have a moment.' : progress >= THINK_MS + REVEAL_MS ? 'The full answer is visible.' : 'A little more is coming into focus.';
    drawReveal();
  }
  lastFrame = now;
  requestAnimationFrame(tick);
}

function currentItem() {
  finished = false; progress = 0; lastFrame = 0; lastTyping = 0; manualPause = false; history = [];
  $('progress').textContent = `QUESTION ${index + 1} OF ${items.length}`;
  $('question').textContent = items[index].question;
  $('answer').value = ''; $('answer').disabled = demo;
  $('answer').placeholder = demo ? 'Configure an API key to check your response.' : 'Explain it in your own words…';
  $('submit').hidden = demo; $('pause').setAttribute('aria-pressed', 'false'); $('pause').innerHTML = '⏸ &nbsp; Pause reveal';
  $('feedback').hidden = true; $('feedback').classList.remove('correct'); $('result').hidden = true;
  $('show').hidden = false; $('pause').disabled = false;
  $('next').innerHTML = index === items.length - 1 ? 'Finish session <span>↗</span>' : 'Next question <span>↗</span>';
  stage('session'); drawReveal();
}
function complete(success) {
  finished = true; if (success) recalled++;
  progress = THINK_MS + REVEAL_MS; drawReveal();
  $('full-answer').textContent = items[index].answer;
  $('excerpt').textContent = items[index].excerpt;
  $('result').hidden = false; $('show').hidden = true; $('pause').disabled = true;
}

$('source').addEventListener('input', () => { $('count').textContent = `${$('source').value.length.toLocaleString()} / 40,000 characters`; error(''); });
$('file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  if (!/\.(txt|md)$/i.test(file.name) || file.size > 1024 * 1024) { error('Choose a .txt or .md file no larger than 1 MiB.'); return; }
  $('source').value = (await file.text()).slice(0, 40000);
  $('source').dispatchEvent(new Event('input'));
});
$('generate').addEventListener('click', async () => {
  const source = $('source').value.trim();
  if (source.length < 150 || source.length > 40000) { error('Provide 150 to 40,000 characters of study material.'); return; }
  busy($('generate'), true, 'Making questions…'); error('');
  try { items = (await post('/api/items', { source })).items; demo = false; renderReview(); stage('review'); }
  catch (e) { error(e.message); }
  finally { busy($('generate'), false); }
});
$('demo').addEventListener('click', () => { $('source').value = sampleSource; $('source').dispatchEvent(new Event('input')); items = structuredClone(sampleItems); demo = true; renderReview(); stage('review'); });
$('begin').addEventListener('click', () => { if (!items.length) return; index = 0; recalled = 0; currentItem(); });
$('pause').addEventListener('click', () => { manualPause = !manualPause; $('pause').setAttribute('aria-pressed', String(manualPause)); $('pause').innerHTML = manualPause ? '▶ &nbsp; Resume reveal' : '⏸ &nbsp; Pause reveal'; });
$('answer').addEventListener('input', () => { lastTyping = performance.now(); });
$('submit').addEventListener('click', async () => {
  const answer = $('answer').value.trim(); if (!answer || finished) return;
  manualPause = true; busy($('submit'), true, 'Checking…');
  try {
    const result = await post('/api/assess', { item: items[index], answer, history });
    history.push(answer); $('feedback').textContent = result.feedback; $('feedback').hidden = false;
    $('feedback').classList.toggle('correct', result.verdict === 'correct');
    if (result.verdict === 'correct') complete(true);
    else { $('answer').value = ''; $('answer').focus(); manualPause = false; $('pause').setAttribute('aria-pressed', 'false'); $('pause').innerHTML = '⏸ &nbsp; Pause reveal'; }
  } catch (e) { $('feedback').textContent = e.message; $('feedback').hidden = false; manualPause = false; }
  finally { busy($('submit'), false); }
});
$('show').addEventListener('click', () => complete(false));
$('next').addEventListener('click', () => { if (++index < items.length) currentItem(); else { $('summary').textContent = demo ? 'You explored the reveal. Add an AI key to generate questions from your own material and check your answers.' : `You recalled ${recalled} of ${items.length} ideas before seeing their full answers. Bring another passage whenever you’re ready.`; stage('finish'); } });
document.querySelectorAll('.restart').forEach(button => button.addEventListener('click', () => { items = []; stage('setup'); }));
fetch('/api/status').then(r => r.json()).then(status => { if (!status.aiReady) error('AI generation is not configured on this server. You can still try the sample reveal.'); }).catch(() => {});
requestAnimationFrame(tick);
