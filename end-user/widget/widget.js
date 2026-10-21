// Embeddable AI assistant widget.
//   <script src="widget/widget.js" data-tenant="pm-kisan-demo"></script>
// Talks to window.TNBackend (mock-backend.js today, the orchestrator API later).
// Accessibility: dialog semantics, keyboard support (Esc closes), aria-live message log,
// per-message lang attribute, visible focus. Targets WCAG 2.1 AA / GIGW 3.0.
(function () {
  const script = document.currentScript;
  const TENANT = (script && script.dataset.tenant) || 'demo';
  const STORE_KEY = 'tn-assistant:' + TENANT;
  const backend = window.TNBackend;
  if (!backend) { console.error('TN assistant: no backend loaded'); return; }

  const L = {
    en: {
      title: 'PM-KISAN Assistant', sub: 'Automated assistant', subAgent: 'Chatting with an officer',
      placeholder: 'Type your question…', send: 'Send', open: 'Open the AI assistant', close: 'Close assistant',
      voice: 'Start a voice call', helpful: 'Was this helpful?', thanks: 'Thanks for the feedback.',
      sources: 'Source', regNo: 'Registration number', mobile: 'Registered mobile number', sendOtp: 'Send OTP',
      otp: 'Enter the 6-digit OTP', verify: 'Verify', submit: 'Submit', edit: 'Edit', cancel: 'Cancel',
      callback: 'Request a callback', email: 'Get the reply by email', joined: 'has joined the chat',
      disclaimer: 'AI can make mistakes. Answers come from the scheme guidelines. Don’t share Aadhaar or bank numbers here.',
    },
    hi: {
      title: 'PM-KISAN सहायक', sub: 'स्वचालित सहायक', subAgent: 'अधिकारी से बातचीत',
      placeholder: 'अपना सवाल लिखें…', send: 'भेजें', open: 'AI सहायक खोलें', close: 'सहायक बंद करें',
      voice: 'वॉइस कॉल शुरू करें', helpful: 'क्या यह मददगार था?', thanks: 'प्रतिक्रिया के लिए धन्यवाद।',
      sources: 'स्रोत', regNo: 'पंजीकरण संख्या', mobile: 'दर्ज मोबाइल नंबर', sendOtp: 'OTP भेजें',
      otp: '6 अंकों का OTP डालें', verify: 'पुष्टि करें', submit: 'जमा करें', edit: 'बदलें', cancel: 'रद्द करें',
      callback: 'कॉलबैक का अनुरोध', email: 'जवाब ईमेल पर पाएँ', joined: 'चैट में शामिल हुए',
      disclaimer: 'AI से गलती हो सकती है। जवाब योजना के दिशानिर्देशों से आते हैं। यहाँ आधार या बैंक नंबर न लिखें।',
    },
  };

  const state = { open: false, lang: 'en', sessionId: null, history: [], busy: false, withAgent: false };
  let t = L.en;

  // ---------- helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const save = () => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({
        sessionId: state.sessionId, lang: state.lang, history: state.history.slice(-60),
        backend: state.sessionId ? backend.snapshot(state.sessionId) : null,
      }));
    } catch (e) { /* storage unavailable: chat still works, it just won't survive a refresh */ }
  };
  const load = () => { try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null'); } catch (e) { return null; } };

  // ---------- DOM ----------
  const root = el(`
    <div class="tnw" data-open="false">
      <button type="button" class="tnw-launcher" aria-haspopup="dialog" aria-expanded="false" aria-controls="tnw-panel">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="9" cy="10.5" r="1.2" fill="currentColor"/><circle cx="12" cy="10.5" r="1.2" fill="currentColor"/><circle cx="15" cy="10.5" r="1.2" fill="currentColor"/></svg>
        <span class="tnw-launcher__label"></span>
      </button>
      <section id="tnw-panel" class="tnw-panel" role="dialog" aria-modal="false" aria-labelledby="tnw-title" hidden>
        <header class="tnw-head">
          <div class="tnw-avatar" aria-hidden="true">AI</div>
          <div class="tnw-head__text">
            <h2 id="tnw-title" class="tnw-title"></h2>
            <p class="tnw-sub"><span class="tnw-dot" aria-hidden="true"></span><span class="tnw-sub__text"></span></p>
          </div>
          <div class="tnw-head__actions">
            <button type="button" class="tnw-icon tnw-lang" aria-label="Switch language"></button>
            <button type="button" class="tnw-icon tnw-voice">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
            <button type="button" class="tnw-icon tnw-close">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </header>
        <div class="tnw-log" role="log" aria-live="polite" aria-relevant="additions"></div>
        <form class="tnw-input" autocomplete="off">
          <label class="tnw-sr" for="tnw-text"></label>
          <textarea id="tnw-text" rows="1" maxlength="500"></textarea>
          <button type="submit" class="tnw-send">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2-6z" fill="currentColor"/></svg>
          </button>
        </form>
        <p class="tnw-disclaimer"></p>
        <div class="tnw-call" hidden>
          <div class="tnw-call__pulse" aria-hidden="true"><span></span><span></span><span></span></div>
          <p class="tnw-call__status" role="status">Connecting…</p>
          <p class="tnw-call__note">In the full build this opens a browser voice call to the same AI agent (LiveKit WebRTC). This static demo shows the screen only.</p>
          <button type="button" class="tnw-btn tnw-btn--danger tnw-call__end">End call</button>
        </div>
      </section>
    </div>`);
  document.body.appendChild(root);

  const $ = (sel) => root.querySelector(sel);
  const launcher = $('.tnw-launcher');
  const panel = $('.tnw-panel');
  const log = $('.tnw-log');
  const form = $('.tnw-input');
  const input = $('#tnw-text');
  const callView = $('.tnw-call');

  function applyLang() {
    t = L[state.lang];
    $('.tnw-title').textContent = t.title;
    $('.tnw-sub__text').textContent = state.withAgent ? t.subAgent : t.sub;
    $('.tnw-lang').textContent = state.lang === 'en' ? 'हिं' : 'EN';
    $('.tnw-lang').setAttribute('lang', state.lang === 'en' ? 'hi' : 'en');
    $('.tnw-voice').setAttribute('aria-label', t.voice);
    $('.tnw-voice').title = t.voice;
    $('.tnw-close').setAttribute('aria-label', t.close);
    launcher.setAttribute('aria-label', t.open);
    $('.tnw-launcher__label').textContent = state.lang === 'en' ? 'Ask PM-KISAN' : 'सवाल पूछें';
    input.placeholder = t.placeholder;
    $('label[for="tnw-text"]').textContent = t.placeholder;
    $('.tnw-send').setAttribute('aria-label', t.send);
    $('.tnw-disclaimer').textContent = t.disclaimer;
    panel.setAttribute('lang', state.lang);
  }

  function scrollDown() { log.scrollTop = log.scrollHeight; }

  // ---------- message rendering ----------
  function addUser(text, record = true) {
    log.appendChild(el(`<div class="tnw-msg tnw-msg--user"><p>${esc(text)}</p></div>`));
    if (record) { state.history.push({ role: 'user', text }); save(); }
    scrollDown();
  }

  function addSystem(text, record = true) {
    log.appendChild(el(`<p class="tnw-system">${esc(text)}</p>`));
    if (record) { state.history.push({ role: 'system', text }); save(); }
    scrollDown();
  }

  function sourcesHtml(sources) {
    if (!sources || !sources.length) return '';
    return `<ul class="tnw-sources" aria-label="${esc(t.sources)}">${sources.map((s) =>
      `<li><a href="#" data-source title="Opens the document at this page (demo)">📄 ${esc(s.title)} · p.${esc(s.page)}</a></li>`).join('')}</ul>`;
  }

  async function addBotText(text, { sources, lang, stream = true, feedback = true, record = true } = {}) {
    const id = 'm' + Date.now() + Math.random().toString(36).slice(2, 5);
    const node = el(`<div class="tnw-msg tnw-msg--bot" lang="${esc(lang || state.lang)}" data-id="${id}"><p></p></div>`);
    log.appendChild(node);
    const p = node.querySelector('p');
    if (stream) {
      p.classList.add('tnw-streaming');
      const words = text.split(' ');
      for (let i = 0; i < words.length; i++) {
        p.textContent += (i ? ' ' : '') + words[i];
        scrollDown();
        await sleep(28);
      }
      p.classList.remove('tnw-streaming');
    } else {
      p.textContent = text;
    }
    if (sources && sources.length) node.insertAdjacentHTML('beforeend', sourcesHtml(sources));
    if (feedback && sources && sources.length) {
      node.insertAdjacentHTML('beforeend', `
        <div class="tnw-feedback"><span>${esc(t.helpful)}</span>
          <button type="button" class="tnw-fb" data-v="up" aria-label="Helpful">👍</button>
          <button type="button" class="tnw-fb" data-v="down" aria-label="Not helpful">👎</button>
        </div>`);
    }
    if (record) { state.history.push({ role: 'bot', text, sources, lang }); save(); }
    scrollDown();
  }

  function addAgent(name, text, record = true) {
    log.appendChild(el(`<div class="tnw-msg tnw-msg--agent"><span class="tnw-msg__who">${esc(name)}</span><p>${esc(text)}</p></div>`));
    if (record) { state.history.push({ role: 'agent', name, text }); save(); }
    scrollDown();
  }

  function addQuick(options) {
    const node = el(`<div class="tnw-quick" role="group" aria-label="Suggested replies">${options.map((o) =>
      `<button type="button" class="tnw-chip">${esc(o)}</button>`).join('')}</div>`);
    node.addEventListener('click', (e) => {
      const b = e.target.closest('.tnw-chip');
      if (!b || state.busy) return;
      node.remove();
      ask(b.textContent);
    });
    log.appendChild(node);
    scrollDown();
  }

  function addStatus(r, record = true) {
    const rows = [['Registration no.', r.regNo], ['Name', r.name], ['State', r.state], ['Land records', r.land], ['e-KYC', r.ekyc], ['Latest instalment', r.last], ['Next instalment', r.next]];
    log.appendChild(el(`
      <div class="tnw-card">
        <h3 class="tnw-card__title">Beneficiary status</h3>
        <dl class="tnw-dl">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        <p class="tnw-card__foot">Verified with OTP · personal data is never cached</p>
      </div>`));
    if (record) { state.history.push({ role: 'status', record: r }); save(); }
    scrollDown();
  }

  function addOtpForm() {
    const node = el(`
      <form class="tnw-card tnw-otp" novalidate>
        <h3 class="tnw-card__title">Verify it's you</h3>
        <div class="tnw-otp__step1">
          <label>${esc(t.regNo)}<input name="reg" inputmode="text" autocomplete="off" placeholder="UP123456789" required></label>
          <label>${esc(t.mobile)}<input name="mobile" inputmode="numeric" autocomplete="tel" placeholder="10-digit number" maxlength="10" required></label>
          <button type="submit" class="tnw-btn tnw-btn--primary">${esc(t.sendOtp)}</button>
        </div>
        <div class="tnw-otp__step2" hidden>
          <p class="tnw-hint" role="status"></p>
          <label>${esc(t.otp)}<input name="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></label>
          <button type="button" class="tnw-btn tnw-btn--primary tnw-verify">${esc(t.verify)}</button>
        </div>
        <p class="tnw-error" role="alert"></p>
        <p class="tnw-card__foot">The OTP is sent through the form, so it never appears in the chat history.</p>
      </form>`);
    const err = node.querySelector('.tnw-error');
    node.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      const reg = node.reg.value.trim().toUpperCase();
      const res = await backend.sendOtp(state.sessionId, reg, node.mobile.value.trim());
      if (!res.ok) { err.textContent = res.error; return; }
      node.querySelector('.tnw-otp__step1').hidden = true;
      node.querySelector('.tnw-otp__step2').hidden = false;
      node.querySelector('.tnw-hint').textContent = res.hint;
      node.otp.focus();
    });
    node.querySelector('.tnw-verify').addEventListener('click', async () => {
      err.textContent = '';
      const res = await backend.verifyOtp(state.sessionId, node.otp.value.trim());
      if (!res.ok) { err.textContent = res.error; return; }
      node.replaceWith(el(`<p class="tnw-system">✓ Verified with OTP</p>`));
      state.history.push({ role: 'system', text: '✓ Verified with OTP' });
      await renderBlocks(res.blocks, state.lang);
      save();
    });
    log.appendChild(node);
    scrollDown();
    node.reg.focus();
  }

  function addConfirm(block) {
    const node = el(`
      <div class="tnw-card tnw-confirm">
        <h3 class="tnw-card__title">${esc(block.title)}</h3>
        <table class="tnw-table"><tbody>${block.rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
        <div class="tnw-actions">
          <button type="button" class="tnw-btn tnw-btn--primary" data-a="submit">✓ ${esc(t.submit)}</button>
          <button type="button" class="tnw-btn" data-a="edit">✎ ${esc(t.edit)}</button>
          <button type="button" class="tnw-btn" data-a="cancel">✕ ${esc(t.cancel)}</button>
        </div>
        <p class="tnw-card__foot">Nothing is submitted until you press Submit.</p>
      </div>`);
    node.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      node.querySelectorAll('button').forEach((x) => { x.disabled = true; });
      b.classList.add('is-chosen');
      const res = b.dataset.a === 'edit'
        ? await backend.editGrievance(state.sessionId)
        : await backend.confirmAction(state.sessionId, block.action, b.dataset.a === 'submit');
      if (res.ticket) {
        node.insertAdjacentHTML('beforeend', `<p class="tnw-ticket">Complaint no. <strong>${esc(res.ticket)}</strong>
          <button type="button" class="tnw-link" data-copy="${esc(res.ticket)}">Copy</button></p>`);
      }
      await renderBlocks(res.blocks, state.lang);
    });
    log.appendChild(node);
    scrollDown();
  }

  function addHandoff(block) {
    if (block.online) {
      const waiting = el(`<p class="tnw-system tnw-waiting"><span class="tnw-spinner" aria-hidden="true"></span>${esc(block.text)}</p>`);
      log.appendChild(waiting);
      scrollDown();
      backend.connectAgent(state.sessionId).then((agent) => {
        waiting.remove();
        state.withAgent = true;
        applyLang();
        root.classList.add('tnw--agent');
        addSystem(`${agent.name} ${t.joined}`);
        addAgent(agent.name, agent.text);
      });
      return;
    }
    const node = el(`
      <div class="tnw-card">
        <p>${esc(block.text)}</p>
        <div class="tnw-actions tnw-actions--stack">
          <button type="button" class="tnw-btn tnw-btn--primary" data-a="callback">📞 ${esc(t.callback)}</button>
          <button type="button" class="tnw-btn" data-a="email">✉️ ${esc(t.email)}</button>
        </div>
        <div class="tnw-handoff__more"></div>
      </div>`);
    const more = node.querySelector('.tnw-handoff__more');
    node.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'callback') {
        more.innerHTML = `<fieldset class="tnw-slots"><legend>Choose a time tomorrow</legend>
          ${['9 am – 12 pm', '12 pm – 3 pm', '3 pm – 6 pm'].map((s, i) => `<label><input type="radio" name="slot" value="${s}" ${i ? '' : 'checked'}> ${s}</label>`).join('')}
          <button type="button" class="tnw-btn tnw-btn--primary" data-a="book">Book callback</button></fieldset>`;
      } else if (b.dataset.a === 'email') {
        more.innerHTML = `<label class="tnw-field">Email address<input type="email" name="email" autocomplete="email"></label>
          <button type="button" class="tnw-btn tnw-btn--primary" data-a="sendmail">Send</button>`;
      } else if (b.dataset.a === 'book') {
        const slot = more.querySelector('input[name=slot]:checked').value;
        const res = await backend.scheduleCallback(state.sessionId, slot);
        node.replaceWith(el(`<p class="tnw-system">📞 Callback booked for tomorrow, ${esc(slot)}. Reference ${esc(res.ref)}. The officer will see this conversation.</p>`));
      } else if (b.dataset.a === 'sendmail') {
        const v = more.querySelector('input[name=email]').value.trim();
        if (!/^\S+@\S+\.\S+$/.test(v)) return;
        node.replaceWith(el(`<p class="tnw-system">✉️ An officer will reply to ${esc(v)} by the next working day.</p>`));
      }
      scrollDown();
    });
    log.appendChild(node);
    scrollDown();
  }

  async function renderBlocks(blocks, lang) {
    for (const b of blocks) {
      if (b.type === 'text') await addBotText(b.text, { sources: b.sources, lang });
      else if (b.type === 'quick') addQuick(b.options);
      else if (b.type === 'otp') addOtpForm();
      else if (b.type === 'status') addStatus(b.record);
      else if (b.type === 'confirm') addConfirm(b);
      else if (b.type === 'handoff') addHandoff(b);
      else if (b.type === 'agent') addAgent(b.name, b.text);
    }
  }

  function showTyping() {
    const node = el(`<div class="tnw-typing" aria-label="Assistant is typing"><span></span><span></span><span></span></div>`);
    log.appendChild(node);
    scrollDown();
    return node;
  }

  // ---------- conversation ----------
  async function ensureSession() {
    if (state.sessionId) return;
    const res = await backend.startSession({ tenant: TENANT, channel: 'chat', language: state.lang });
    state.sessionId = res.sessionId;
    await addBotText(res.greeting[state.lang], { stream: false, feedback: false });
    addQuick(res.quick);
  }

  async function ask(text) {
    text = text.trim();
    if (!text || state.busy) return;
    state.busy = true;
    form.querySelector('.tnw-send').disabled = true;
    await ensureSession();
    addUser(text);
    const typing = showTyping();
    try {
      const res = await backend.sendTurn(state.sessionId, text, state.lang);
      typing.remove();
      await renderBlocks(res.blocks, res.lang);
    } catch (err) {
      typing.remove();
      addSystem('Something went wrong. Please try again.', false);
    } finally {
      state.busy = false;
      form.querySelector('.tnw-send').disabled = false;
      save();
    }
  }

  function restore() {
    const saved = load();
    if (!saved || !saved.sessionId) return false;
    state.sessionId = saved.sessionId;
    state.lang = saved.lang || 'en';
    state.history = saved.history || [];
    backend.resume(saved.sessionId, saved.backend);
    state.withAgent = !!(saved.backend && saved.backend.withAgent);
    if (state.withAgent) root.classList.add('tnw--agent');
    applyLang();
    for (const m of state.history) {
      if (m.role === 'user') addUser(m.text, false);
      else if (m.role === 'bot') addBotText(m.text, { sources: m.sources, lang: m.lang, stream: false, record: false });
      else if (m.role === 'agent') addAgent(m.name, m.text, false);
      else if (m.role === 'system') addSystem(m.text, false);
      else if (m.role === 'status') addStatus(m.record, false);
    }
    return true;
  }

  async function openPanel(opts = {}) {
    if (opts.language && opts.language !== state.lang) { state.lang = opts.language; applyLang(); }
    state.open = true;
    root.dataset.open = 'true';
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    input.focus();
    if (!state.sessionId) await ensureSession();
    if (opts.ask) ask(opts.ask);
  }

  function closePanel() {
    state.open = false;
    root.dataset.open = 'false';
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }

  // ---------- events ----------
  launcher.addEventListener('click', () => (state.open ? closePanel() : openPanel()));
  $('.tnw-close').addEventListener('click', closePanel);
  $('.tnw-lang').addEventListener('click', () => { state.lang = state.lang === 'en' ? 'hi' : 'en'; applyLang(); save(); });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.open) closePanel(); });

  form.addEventListener('submit', (e) => { e.preventDefault(); const v = input.value; input.value = ''; autosize(); ask(v); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  const autosize = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; };
  input.addEventListener('input', autosize);

  log.addEventListener('click', async (e) => {
    const fb = e.target.closest('.tnw-fb');
    if (fb) {
      const box = fb.parentElement;
      await backend.feedback(state.sessionId, box.parentElement.dataset.id, fb.dataset.v);
      box.innerHTML = `<span>${esc(t.thanks)}</span>`;
      return;
    }
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      try { await navigator.clipboard.writeText(copy.dataset.copy); copy.textContent = 'Copied'; } catch (err) { copy.textContent = copy.dataset.copy; }
      return;
    }
    if (e.target.closest('[data-source]')) e.preventDefault();
  });

  // Voice call screen (UI only in the static demo).
  let callTimer;
  $('.tnw-voice').addEventListener('click', () => {
    callView.hidden = false;
    const status = callView.querySelector('.tnw-call__status');
    status.textContent = 'Connecting to the voice assistant…';
    callTimer = setTimeout(() => { status.textContent = 'Connected · speak in English, Hindi or your language'; callView.classList.add('is-live'); }, 1500);
    callView.querySelector('.tnw-call__end').focus();
  });
  callView.querySelector('.tnw-call__end').addEventListener('click', () => {
    clearTimeout(callTimer);
    callView.hidden = true;
    callView.classList.remove('is-live');
    $('.tnw-voice').focus();
  });

  applyLang();
  restore();

  window.TNAssistant = { open: openPanel, close: closePanel };
})();
