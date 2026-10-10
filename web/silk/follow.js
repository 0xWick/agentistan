// Follow the world: choose what to hear of (the Mongols, plots, romances, history taking another road, one realm)
// and where: a Discord or Slack channel by its webhook, or a phone through the free ntfy app. The world tags every
// event; n8n sends the ones that match, as cards (server/tidings.js, n8n/workflows/tidings.json).
import { $, esc } from './ui.js';

const dlg = $('#follow'), HOW = {
  discord: ['Discord webhook URL', 'https://discord.com/api/webhooks/…', 'In your Discord server: channel settings → Integrations → Webhooks → New webhook → Copy URL.'],
  slack: ['Slack webhook URL', 'https://hooks.slack.com/services/…', 'In Slack: add the “Incoming Webhooks” app to a channel, and copy its URL.'],
  ntfy: ['Your private topic', '', 'Install the free ntfy app (Android or iPhone), tap +, and subscribe to this topic. Keep the name to yourself: anyone who knows it can read it.'],
};
let topics = null;
const topicName = () => `agentistan-${crypto.getRandomValues(new Uint32Array(2)).join('').slice(0, 12)}`;

async function open() {
  topics ??= await fetch('/api/era/topics').then((r) => r.json()).catch(() => null);
  if (!topics) return;
  $('#follow-topics').innerHTML = Object.entries(topics.topics).map(([id, name]) => `<label class="tag-pick"><input type="checkbox" value="${id}"${['steppe', 'anomaly', 'plots'].includes(id) ? ' checked' : ''}><span>${esc(name)}</span></label>`).join('');
  $('#follow-realm').innerHTML = `<option value="">and one realm, if you like…</option>${topics.realms.map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}`;
  channel('discord');
  $('#follow-out').innerHTML = '';
  if (!dlg.open) dlg.showModal();
}
function channel(c) {
  for (const b of dlg.querySelectorAll('[data-ch]')) b.classList.toggle('on', b.dataset.ch === c);
  const [label, ph, help] = HOW[c];
  dlg.dataset.ch = c;
  $('#follow-target-label').textContent = label;
  $('#follow-target').placeholder = ph;
  $('#follow-target').value = c === 'ntfy' ? topicName() : '';
  $('#follow-help').textContent = help;
}
async function go() {
  const tags = [...dlg.querySelectorAll('#follow-topics input:checked')].map((i) => i.value), realm = $('#follow-realm').value;
  if (realm) tags.push(`realm:${realm}`);
  const btn = $('#follow-go'), out = $('#follow-out');
  btn.disabled = true;
  const r = await fetch('/api/era/follow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ channel: dlg.dataset.ch, target: $('#follow-target').value.trim(), tags }) }).then((x) => x.json()).catch(() => ({ error: 'The world cannot be reached. Try again.' }));
  btn.disabled = false;
  out.innerHTML = r.error ? `<p class="bad">${esc(r.error)}</p>` : `<p class="good">Done. A first card is on its way${dlg.dataset.ch === 'ntfy' ? ' to your phone' : ''}; then the world’s news, as it happens, at most a dozen a day.</p><p class="fine">Every card ends with a link to stop them. Keep this one too: <a href="${esc(r.leave)}">stop these</a>.</p>`;
}
$('#follow-btn')?.addEventListener('click', open);
dlg?.addEventListener('click', (e) => {
  if (e.target === dlg || e.target.closest('[data-close]')) return dlg.close();
  const ch = e.target.closest('[data-ch]');
  if (ch) channel(ch.dataset.ch);
  if (e.target.closest('#follow-go')) go();
});
// a "stop these" link from a card
const leave = new URLSearchParams(location.search).get('unfollow');
if (leave && dlg) {
  const [id, key] = leave.split('.');
  fetch('/api/era/unfollow', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, key }) }).then((r) => r.json()).then((r) => {
    history.replaceState(null, '', location.pathname);
    dlg.querySelector('.follow-form').hidden = true;
    $('#follow-out').innerHTML = r.ok ? '<p class="good">You will hear no more from the world. Come back to it whenever you like.</p>' : '<p class="bad">That link has already been used, or is not known.</p>';
    dlg.showModal();
  }).catch(() => {});
}
