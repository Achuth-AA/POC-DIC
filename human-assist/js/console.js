// Agent console: queue → accept → live transcript + AI assist → wrap-up.
(function () {
  const A = window.ASSIST;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const now = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const state = { status: 'available', queue: A.queue.map((q) => ({ ...q })), active: null, done: 0 };
  let liveTimer = null;

  const $ = (id) => document.getElementById(id);

  function toast(text) {
    const host = document.querySelector('.toasts');
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    host.appendChild(t);
    setTimeout(() => t.classList.add('is-out'), 2800);
    setTimeout(() => t.remove(), 3200);
  }

  // ---------- header ----------
  $('officerName').textContent = A.officer.name;
  $('officerRole').textContent = A.officer.role;
  $('officerAvatar').textContent = A.officer.short;
  $('myStatus').addEventListener('change', (e) => {
    state.status = e.target.value;
    $('statusDot').dataset.status = state.status;
    renderQueue();
    toast(state.status === 'available' ? 'You will receive new handoffs.' : 'New handoffs go to other officers, or citizens are offered a callback.');
  });

  // ---------- queue ----------
  function renderQueue() {
    const items = [...state.queue].sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0) || b.waitedSec - a.waitedSec);
    $('queueCount').textContent = items.length;
    const canAccept = !state.active && state.status === 'available';
    $('queueList').innerHTML = items.length ? items.map((q) => `
      <li class="qitem ${q.priority ? 'qitem--priority' : ''}">
        <div class="qitem__top">
          <span class="qitem__ch" aria-label="${q.channel === 'voice' ? 'Voice call' : 'Web chat'}">${q.channel === 'voice' ? '📞' : '💬'}</span>
          <strong>${esc(q.caller.label)}</strong>
          <span class="tag">${esc(q.lang)}</span>
          ${q.priority ? '<span class="tag tag--bad">Priority</span>' : ''}
          <span class="qitem__wait" data-wait="${esc(q.id)}">${mmss(q.waitedSec)}</span>
        </div>
        <p class="qitem__reason">${esc(q.reason)}</p>
        <p class="qitem__intent">${esc(q.summary.intent)}</p>
        <button type="button" class="btn btn--primary btn--sm" data-accept="${esc(q.id)}" ${canAccept ? '' : 'disabled'}>
          ${q.channel === 'voice' ? 'Answer call' : 'Join chat'}</button>
      </li>`).join('') : '<li class="queue__empty">No one is waiting. 🎉</li>';
  }

  $('queueList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-accept]');
    if (!b) return;
    const item = state.queue.find((q) => q.id === b.dataset.accept);
    state.queue = state.queue.filter((q) => q !== item);
    accept(item);
  });

  // ---------- active conversation ----------
  function accept(item) {
    state.active = {
      ...item, startedSec: 0, muted: false, held: false, ended: false,
      transcript: [...item.history.map(([who, text]) => ({ who, text, at: '' })), { who: 'system', text: `${A.officer.name} joined`, at: now() }],
      liveQueue: [...item.live], lastCitizen: item.history.filter(([w]) => w === 'citizen').pop()?.[1] || '',
      notes: '', disposition: '',
    };
    renderQueue();
    renderConvo();
    renderAssist();
    scheduleLive(3500);
    toast(item.channel === 'voice' ? 'Call connected. The transcript continues live.' : 'You joined the chat. The citizen sees your name.');
  }

  function scheduleLive(delay) {
    clearTimeout(liveTimer);
    const a = state.active;
    if (!a || a.ended || !a.liveQueue.length) return;
    liveTimer = setTimeout(() => {
      if (!state.active || state.active !== a || a.ended) return;
      if (a.held) { scheduleLive(2000); return; }
      const [who, text] = a.liveQueue.shift();
      addLine(who, text);
      if (who === 'citizen') { a.lastCitizen = text; renderSuggestions(); }
      if (a.channel === 'voice') scheduleLive(9000);
    }, delay);
  }

  function addLine(who, text) {
    const a = state.active;
    a.transcript.push({ who, text, at: now() });
    const list = document.querySelector('.transcript');
    if (list) {
      list.insertAdjacentHTML('beforeend', lineHtml({ who, text, at: now() }, true));
      list.scrollTop = list.scrollHeight;
    }
  }

  const WHO = { ai: 'AI assistant', citizen: 'Citizen', officer: 'You', system: '' };
  function lineHtml(l, fresh) {
    if (l.who === 'system') return `<li class="line line--system">${esc(l.text)}${l.at ? ` · ${esc(l.at)}` : ''}</li>`;
    return `<li class="line line--${l.who} ${fresh ? 'is-new' : ''}"><span class="line__who">${WHO[l.who]}${l.at ? ` · ${esc(l.at)}` : ''}</span><p>${esc(l.text)}</p></li>`;
  }

  function renderConvo() {
    const a = state.active;
    const el = $('convo');
    if (!a) {
      el.innerHTML = `<div class="convo__empty"><div class="convo__empty-icon" aria-hidden="true">🎧</div>
        <h2>No active conversation</h2><p>${state.done ? `${state.done} completed this session. ` : ''}Accept a handoff from the queue. You will see the AI summary, the full transcript and suggested answers.</p></div>`;
      return;
    }
    const voice = a.channel === 'voice';
    el.innerHTML = `
      <div class="convo__head">
        <div class="convo__who">
          <span class="convo__ch" aria-hidden="true">${voice ? '📞' : '💬'}</span>
          <div><h2>${esc(a.caller.label)} <span class="tag">${esc(a.lang)}</span>
            ${a.caller.verified ? '<span class="tag tag--ok">✓ OTP verified</span>' : '<span class="tag tag--warn">Not verified</span>'}</h2>
            <p>${voice ? esc(a.caller.phone) : 'Web chat'} · session <span class="mono">${esc(a.id)}</span> · <span id="callTime">${mmss(a.startedSec)}</span>${a.ended ? ' · ended' : ''}</p></div>
        </div>
        <div class="convo__controls">${voice ? `
          <button type="button" class="ctl ${a.muted ? 'is-on' : ''}" data-ctl="mute" aria-pressed="${a.muted}" ${a.ended ? 'disabled' : ''}>🎙️ ${a.muted ? 'Unmute' : 'Mute'}</button>
          <button type="button" class="ctl ${a.held ? 'is-on' : ''}" data-ctl="hold" aria-pressed="${a.held}" ${a.ended ? 'disabled' : ''}>⏸ ${a.held ? 'Resume' : 'Hold'}</button>
          <button type="button" class="ctl" data-ctl="transfer" ${a.ended ? 'disabled' : ''}>↪ Transfer</button>
          <button type="button" class="ctl ctl--end" data-ctl="end" ${a.ended ? 'disabled' : ''}>End call</button>`
          : `<button type="button" class="ctl" data-ctl="transfer" ${a.ended ? 'disabled' : ''}>↪ Transfer</button>
          <button type="button" class="ctl ctl--end" data-ctl="end" ${a.ended ? 'disabled' : ''}>End chat</button>`}
        </div>
      </div>
      ${a.held ? '<p class="banner">Caller is on hold with music. The AI will not speak while on hold.</p>' : ''}
      <ol class="transcript">${a.transcript.map((l) => lineHtml(l)).join('')}</ol>
      ${voice ? `<p class="convo__foot">🔴 Live transcript of both sides (speech-to-text). Suggestions update as the caller speaks.</p>`
        : `<form class="composer" id="composer" ${a.ended ? 'hidden' : ''}>
            <label class="sr-only" for="reply">Reply to citizen</label>
            <textarea id="reply" rows="2" placeholder="Type a reply… (Enter to send, Shift+Enter for a new line)"></textarea>
            <button class="btn btn--primary" type="submit">Send</button></form>`}`;
    const t = el.querySelector('.transcript');
    t.scrollTop = t.scrollHeight;
  }

  $('convo').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ctl]');
    if (!b || !state.active) return;
    const a = state.active;
    const ctl = b.dataset.ctl;
    if (ctl === 'mute') a.muted = !a.muted;
    if (ctl === 'hold') { a.held = !a.held; addLine('system', a.held ? 'Caller put on hold' : 'Caller resumed'); }
    if (ctl === 'transfer') { toast('Transfer to supervisor or state nodal officer (demo). The AI summary goes with it.'); return; }
    if (ctl === 'end') {
      a.ended = true;
      clearTimeout(liveTimer);
      addLine('system', a.channel === 'voice' ? 'Call ended' : 'Chat ended');
      a.notes = draftNotes(a);
      toast('Complete the wrap-up on the right. Notes are pre-drafted by the AI.');
    }
    renderConvo();
    renderAssist();
    if (ctl === 'end') document.querySelector('.panel--wrap')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  $('convo').addEventListener('submit', (e) => {
    if (e.target.id !== 'composer') return;
    e.preventDefault();
    const box = $('reply');
    const text = box.value.trim();
    if (!text) return;
    addLine('officer', text);
    box.value = '';
    scheduleLive(2500);
  });
  $('convo').addEventListener('keydown', (e) => {
    if (e.target.id === 'reply' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('composer').requestSubmit(); }
  });

  // ---------- AI assist panel ----------
  function suggestionsFor(text) {
    const words = (text || '').toLowerCase().match(/[a-zऀ-ॿ]+/g) || [];
    return A.knowledge
      .map((k) => ({ k, score: k.keys.filter((key) => words.some((w) => w.startsWith(key) || key.startsWith(w) && w.length > 3)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.k);
  }

  function renderSuggestions() {
    const a = state.active;
    const host = document.getElementById('suggestions');
    if (!host || !a) return;
    const list = suggestionsFor(a.lastCitizen + ' ' + a.summary.intent);
    host.innerHTML = `
      <p class="assist__quote">For: “${esc(a.lastCitizen || a.summary.intent)}”</p>
      ${list.length ? list.map((s, i) => `
        <div class="sugg">
          <p>${esc(s.text)}</p>
          <div class="sugg__foot"><span>📄 ${esc(s.source)} p.${s.page}</span>${s.internal ? '<span class="tag tag--violet">Internal</span>' : ''}
            <button type="button" class="btn btn--sm" data-use="${i}">${a.channel === 'chat' ? 'Insert' : 'Mark as said'}</button></div>
        </div>`).join('') : '<p class="note">No matching knowledge yet. Suggestions appear as the citizen speaks.</p>'}`;
    host.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => {
      const s = list[Number(b.dataset.use)];
      if (a.channel === 'chat') { const box = $('reply'); if (box) { box.value = s.text; box.focus(); } }
      else { addLine('officer', s.text); toast('Logged as said by you.'); }
    }));
  }

  function draftNotes(a) {
    const tickets = a.caller.tickets.length ? ` Grievance ${a.caller.tickets.join(', ')} registered.` : '';
    return `${a.summary.intent} ${a.caller.verified ? 'Caller verified with OTP.' : 'Caller not verified.'} ${a.summary.points.slice(1, 3).join(' ')} Officer explained the instalment periods and next steps.${tickets}`;
  }

  function renderAssist() {
    const a = state.active;
    const el = $('assist');
    if (!a) {
      el.innerHTML = `<div class="panel"><h3>AI assist</h3><p class="note">The AI summary, caller details and live answer suggestions appear here when you take a conversation.</p></div>`;
      return;
    }
    const c = a.caller;
    el.innerHTML = `
      <section class="panel panel--summary">
        <h3>AI summary <span class="note">generated at handoff</span></h3>
        <p class="assist__intent">${esc(a.summary.intent)}</p>
        <ul class="assist__points">${a.summary.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        <p class="note">Sentiment: <strong>${esc(a.summary.sentiment)}</strong> · Handoff reason: ${esc(a.reason)}</p>
      </section>

      <section class="panel">
        <h3>Caller</h3>
        <dl class="kv">
          <dt>Verification</dt><dd>${c.verified ? `OTP · level ${c.authLevel}` : 'Not verified. Verify before sharing personal data.'}</dd>
          ${c.regNo ? `<dt>Registration</dt><dd class="mono">${esc(c.regNo)}</dd><dt>State</dt><dd>${esc(c.state)}</dd>
          <dt>Land records</dt><dd>${esc(c.land)}</dd><dt>e-KYC</dt><dd>${esc(c.ekyc)}</dd><dt>Last instalment</dt><dd>${esc(c.last)}</dd>` : ''}
          <dt>Tickets</dt><dd>${c.tickets.length ? c.tickets.map(esc).join(', ') : 'None'}</dd>
        </dl>
        ${c.verified ? '' : `<button type="button" class="btn btn--sm" id="sendOtp" ${a.ended ? 'disabled' : ''}>Send OTP to caller</button>`}
      </section>

      <section class="panel">
        <h3>Suggested answers <span class="note">from the knowledge base</span></h3>
        <div id="suggestions"></div>
      </section>

      <section class="panel">
        <h3>Actions</h3>
        <div class="actions">
          <button type="button" class="btn btn--sm" data-act="ticket" ${a.ended ? 'disabled' : ''}>📝 Register grievance</button>
          <button type="button" class="btn btn--sm" data-act="callback">📞 Schedule callback</button>
          <button type="button" class="btn btn--sm" data-act="sms" ${a.ended ? 'disabled' : ''}>💬 Send SMS with link</button>
        </div>
        <div id="actionForm"></div>
      </section>

      <section class="panel ${a.ended ? 'panel--wrap' : ''}">
        <h3>Wrap-up</h3>
        ${a.ended ? `
          <label class="field"><span>After-call notes (AI draft, edit as needed)</span><textarea id="notes" rows="5">${esc(a.notes)}</textarea></label>
          <label class="field"><span>Outcome</span><select id="disposition"><option value="">Choose…</option>${A.dispositions.map((d) => `<option>${esc(d)}</option>`).join('')}</select></label>
          <button type="button" class="btn btn--primary" id="complete">Complete &amp; next</button>`
          : '<p class="note">End the call or chat to write notes and set the outcome. Notes are drafted by the AI from the transcript.</p>'}
      </section>`;
    renderSuggestions();

    const otp = $('sendOtp');
    if (otp) otp.addEventListener('click', () => {
      c.verified = true; c.authLevel = 1;
      addLine('system', 'OTP sent and verified · auth level 1');
      renderConvo(); renderAssist();
    });

    el.querySelector('.actions').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const form = $('actionForm');
      if (b.dataset.act === 'ticket') {
        form.innerHTML = `<form class="mini" id="ticketForm">
          <label class="field"><span>Category</span><select name="cat"><option>Instalment not received</option><option>Wrong bank details</option><option>e-KYC problem</option><option>Other</option></select></label>
          <label class="field"><span>Details</span><textarea name="details" rows="2">${esc(a.summary.intent)}</textarea></label>
          <button class="btn btn--primary btn--sm" type="submit">Create ticket</button></form>`;
        $('ticketForm').addEventListener('submit', (ev) => {
          ev.preventDefault();
          const id = 'G-2026-' + Math.floor(1000 + Math.random() * 9000);
          c.tickets.push(id);
          addLine('system', `Grievance ${id} registered by officer (${ev.target.cat.value})`);
          toast(`Ticket ${id} created. The citizen gets an SMS.`);
          renderAssist();
        });
      } else if (b.dataset.act === 'callback') {
        form.innerHTML = `<form class="mini" id="cbForm"><label class="field"><span>When</span><select name="slot"><option>Tomorrow · 9 am – 12 pm</option><option>Tomorrow · 12 pm – 3 pm</option><option>Tomorrow · 3 pm – 6 pm</option></select></label>
          <button class="btn btn--primary btn--sm" type="submit">Book</button></form>`;
        $('cbForm').addEventListener('submit', (ev) => {
          ev.preventDefault();
          A.callbacks.unshift({ ref: 'CB-' + Math.floor(10000 + Math.random() * 90000), when: ev.target.slot.value, lang: a.lang, channel: a.channel, summary: a.summary.intent, verified: c.verified, status: 'scheduled' });
          addLine('system', `Callback booked: ${ev.target.slot.value}`);
          toast('Callback booked. It appears on the Callbacks page.');
          form.innerHTML = '';
        });
      } else {
        addLine('system', 'SMS sent: link to the beneficiary status page');
        toast('SMS sent (demo).');
      }
    });

    const done = $('complete');
    if (done) done.addEventListener('click', () => {
      const disp = $('disposition').value;
      if (!disp) { $('disposition').focus(); toast('Choose an outcome first.'); return; }
      state.done += 1;
      toast(`Saved: ${disp}. Notes attached to session ${a.id}.`);
      state.active = null;
      renderQueue(); renderConvo(); renderAssist();
    });
  }

  // ---------- clock ----------
  setInterval(() => {
    state.queue.forEach((q) => { q.waitedSec += 1; const n = document.querySelector(`[data-wait="${q.id}"]`); if (n) n.textContent = mmss(q.waitedSec); });
    const a = state.active;
    if (a && !a.ended) { a.startedSec += 1; const n = $('callTime'); if (n) n.textContent = mmss(a.startedSec); }
  }, 1000);

  // A new handoff arrives a little later, to show the queue updating live.
  setTimeout(() => {
    state.queue.push({
      id: 's_c_2311', channel: 'chat', lang: 'Hinglish', waitedSec: 0, reason: 'Caller asked for a person',
      caller: { label: 'Web visitor', phone: '—', verified: true, authLevel: 1, regNo: 'MH98•••••21', state: 'Maharashtra', ekyc: 'Pending', land: 'Verified', last: '₹2,000 on 12 Jun 2026', tickets: [] },
      summary: { intent: 'Instalments on hold; wants to know how to finish e-KYC.', points: ['Verified with OTP (form).', 'Status shows e-KYC pending; payments on hold.', 'AI explained OTP and CSC e-KYC; citizen still wants a person.'], sentiment: 'Frustrated' },
      history: [['ai', 'Your e-KYC is pending, so instalments are on hold. You can complete it with an Aadhaar OTP on the portal or at a CSC.'], ['citizen', 'OTP nahi aa raha, kisi se baat karni hai'], ['system', 'Transferred to officer · AI summary attached']],
      live: [['citizen', 'Aadhaar se mobile number link nahi hai shayad. Ab kya karun?']],
    });
    renderQueue();
    toast('New handoff in the queue.');
  }, 20000);

  renderQueue();
  renderConvo();
  renderAssist();
})();
