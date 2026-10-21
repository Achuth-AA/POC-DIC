// AI assistant widget. Talks to ./mockBackend.js today, the orchestrator API later.
// Accessibility: dialog semantics, Esc closes, aria-live message log, per-message lang attribute,
// visible focus. Targets WCAG 2.1 AA / GIGW 3.0.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ConfirmCard, OfflineHandoffCard, OtpCard, StatusCard } from './cards.jsx';
import { backend } from './mockBackend.js';
import { STRINGS } from './strings.js';
import './widget.css';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Only plain messages are restored after a refresh; forms and cards are not.
const PERSISTED = new Set(['user', 'bot', 'agent', 'system', 'status']);

function load(key) {
  try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; }
}

const Widget = forwardRef(function Widget({ tenant = 'demo' }, ref) {
  const storeKey = `tn-assistant:${tenant}`;
  const saved = useRef(load(storeKey));
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState(saved.current?.lang || 'en');
  const [messages, setMessages] = useState(() => (saved.current?.messages || []).map((m) => ({ ...m, streaming: false })));
  const [busy, setBusy] = useState(false);
  const [withAgent, setWithAgent] = useState(!!saved.current?.backend?.withAgent);
  const [call, setCall] = useState('off'); // off | connecting | live
  const [text, setText] = useState('');
  const sessionRef = useRef(saved.current?.sessionId || null);
  const langRef = useRef(lang);
  const nextId = useRef(0);
  const logRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const t = STRINGS[lang];
  langRef.current = lang;

  useEffect(() => { if (sessionRef.current) backend.resume(sessionRef.current, saved.current?.backend); }, []);

  // Persist the conversation for this browser tab.
  useEffect(() => {
    if (!sessionRef.current) return;
    try {
      sessionStorage.setItem(storeKey, JSON.stringify({
        sessionId: sessionRef.current, lang,
        messages: messages.filter((m) => PERSISTED.has(m.kind)).map((m) => (m.kind === 'bot' ? { ...m, text: m.full ?? m.text } : m)).slice(-60),
        backend: backend.snapshot(sessionRef.current),
      }));
    } catch { /* storage unavailable: chat still works, it just won't survive a refresh */ }
  }, [messages, lang, storeKey]);

  useEffect(() => { const l = logRef.current; if (l) l.scrollTop = l.scrollHeight; }, [messages]);

  // ---------- message helpers ----------
  const push = useCallback((msg) => {
    const id = `m${Date.now()}-${nextId.current++}`;
    setMessages((m) => [...m, { id, ...msg }]);
    return id;
  }, []);
  const patch = useCallback((id, fields) => setMessages((m) => m.map((x) => (x.id === id ? { ...x, ...fields } : x))), []);
  const removeMsg = useCallback((id) => setMessages((m) => m.filter((x) => x.id !== id)), []);
  const replaceMsg = useCallback((id, msg) => setMessages((m) => m.map((x) => (x.id === id ? { id, ...msg } : x))), []);

  const addBot = useCallback(async (full, { sources, lng, stream = true } = {}) => {
    const id = push({ kind: 'bot', text: stream ? '' : full, full, sources, lang: lng || langRef.current, streaming: stream });
    if (!stream) return;
    const words = full.split(' ');
    for (let i = 1; i <= words.length; i++) {
      patch(id, { text: words.slice(0, i).join(' ') });
      await sleep(28); // eslint-disable-line no-await-in-loop
    }
    patch(id, { streaming: false });
  }, [push, patch]);

  const renderBlocks = useCallback(async (blocks, lng) => {
    for (const b of blocks) {
      if (b.type === 'text') await addBot(b.text, { sources: b.sources, lng }); // eslint-disable-line no-await-in-loop
      else if (b.type === 'quick') push({ kind: 'quick', options: b.options });
      else if (b.type === 'otp') push({ kind: 'otp' });
      else if (b.type === 'status') push({ kind: 'status', record: b.record });
      else if (b.type === 'confirm') push({ kind: 'confirm', block: b });
      else if (b.type === 'agent') push({ kind: 'agent', name: b.name, text: b.text });
      else if (b.type === 'handoff') {
        if (!b.online) { push({ kind: 'offline', text: b.text }); continue; }
        const waitId = push({ kind: 'waiting', text: b.text });
        backend.connectAgent(sessionRef.current).then((agent) => {
          removeMsg(waitId);
          setWithAgent(true);
          push({ kind: 'system', text: `${agent.name} ${STRINGS[langRef.current].joined}` });
          push({ kind: 'agent', name: agent.name, text: agent.text });
        });
      }
    }
  }, [addBot, push, removeMsg]);

  // ---------- conversation ----------
  const ensureSession = useCallback(async () => {
    if (sessionRef.current) return;
    const res = await backend.startSession({ tenant, channel: 'chat', language: langRef.current });
    sessionRef.current = res.sessionId;
    await addBot(res.greeting[langRef.current], { stream: false });
    push({ kind: 'quick', options: res.quick });
  }, [tenant, addBot, push]);

  const busyRef = useRef(false);
  const ask = useCallback(async (raw) => {
    const q = raw.trim();
    if (!q || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    await ensureSession();
    push({ kind: 'user', text: q });
    const typing = push({ kind: 'typing' });
    try {
      const res = await backend.sendTurn(sessionRef.current, q, langRef.current);
      removeMsg(typing);
      await renderBlocks(res.blocks, res.lang);
    } catch {
      removeMsg(typing);
      push({ kind: 'system', text: 'Something went wrong. Please try again.' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [ensureSession, push, removeMsg, renderBlocks]);

  const openPanel = useCallback(async (opts = {}) => {
    if (opts.language) setLang(opts.language);
    langRef.current = opts.language || langRef.current;
    setOpen(true);
    await ensureSession();
    if (opts.ask) ask(opts.ask);
  }, [ensureSession, ask]);

  const closePanel = useCallback(() => { setOpen(false); setCall('off'); requestAnimationFrame(() => launcherRef.current?.focus()); }, []);

  useImperativeHandle(ref, () => ({ open: openPanel, close: closePanel }), [openPanel, closePanel]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  // Voice call screen (UI only until the LiveKit voice agent is connected).
  useEffect(() => {
    if (call !== 'connecting') return undefined;
    const tm = setTimeout(() => setCall('live'), 1500);
    return () => clearTimeout(tm);
  }, [call]);

  function submit(e) {
    e.preventDefault();
    const v = text;
    setText('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    ask(v);
  }

  function onInput(e) {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }

  async function feedback(m, value) {
    await backend.feedback(sessionRef.current, m.id, value);
    patch(m.id, { fb: value });
  }

  // ---------- render ----------
  function renderMessage(m) {
    switch (m.kind) {
      case 'user':
        return <div key={m.id} className="tnw-msg tnw-msg--user"><p>{m.text}</p></div>;
      case 'bot':
        return (
          <div key={m.id} className="tnw-msg tnw-msg--bot" lang={m.lang}>
            <p className={m.streaming ? 'tnw-streaming' : ''}>{m.text}</p>
            {!m.streaming && m.sources?.length > 0 && (
              <>
                <ul className="tnw-sources" aria-label={t.sources}>
                  {m.sources.map((s) => (
                    <li key={`${s.title}-${s.page}`}><a href="#source" onClick={(e) => e.preventDefault()} title="Opens the document at this page (demo)">📄 {s.title} · p.{s.page}</a></li>
                  ))}
                </ul>
                <div className="tnw-feedback">
                  {m.fb ? <span>{t.thanks}</span> : (
                    <>
                      <span>{t.helpful}</span>
                      <button type="button" className="tnw-fb" aria-label="Helpful" onClick={() => feedback(m, 'up')}>👍</button>
                      <button type="button" className="tnw-fb" aria-label="Not helpful" onClick={() => feedback(m, 'down')}>👎</button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        );
      case 'agent':
        return <div key={m.id} className="tnw-msg tnw-msg--agent"><span className="tnw-msg__who">{m.name}</span><p>{m.text}</p></div>;
      case 'system':
        return <p key={m.id} className="tnw-system">{m.text}</p>;
      case 'waiting':
        return <p key={m.id} className="tnw-system tnw-waiting"><span className="tnw-spinner" aria-hidden="true" />{m.text}</p>;
      case 'typing':
        return <div key={m.id} className="tnw-typing" aria-label="Assistant is typing"><span /><span /><span /></div>;
      case 'quick':
        return (
          <div key={m.id} className="tnw-quick" role="group" aria-label="Suggested replies">
            {m.options.map((o) => (
              <button key={o} type="button" className="tnw-chip" disabled={busy} onClick={() => { removeMsg(m.id); ask(o); }}>{o}</button>
            ))}
          </div>
        );
      case 'otp':
        return (
          <OtpCard key={m.id} t={t} sessionId={sessionRef.current}
            onVerified={(blocks) => { replaceMsg(m.id, { kind: 'system', text: '✓ Verified with OTP' }); renderBlocks(blocks, langRef.current); }} />
        );
      case 'status':
        return <StatusCard key={m.id} record={m.record} />;
      case 'confirm':
        return <ConfirmCard key={m.id} t={t} block={m.block} sessionId={sessionRef.current} onResult={(blocks) => renderBlocks(blocks, langRef.current)} />;
      case 'offline':
        return <OfflineHandoffCard key={m.id} t={t} text={m.text} sessionId={sessionRef.current} onDone={(msg) => replaceMsg(m.id, { kind: 'system', text: msg })} />;
      default:
        return null;
    }
  }

  return (
    <div className={`tnw ${withAgent ? 'tnw--agent' : ''}`} data-open={open} onKeyDown={(e) => { if (e.key === 'Escape' && open) closePanel(); }}>
      {!open && (
        <button ref={launcherRef} type="button" className="tnw-launcher" aria-haspopup="dialog" aria-expanded="false" aria-controls="tnw-panel" aria-label={t.open} onClick={() => openPanel()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="9" cy="10.5" r="1.2" fill="currentColor" /><circle cx="12" cy="10.5" r="1.2" fill="currentColor" /><circle cx="15" cy="10.5" r="1.2" fill="currentColor" /></svg>
          <span className="tnw-launcher__label">{t.launcher}</span>
        </button>
      )}
      {open && (
        <section id="tnw-panel" className="tnw-panel" role="dialog" aria-modal="false" aria-labelledby="tnw-title" lang={lang}>
          <header className="tnw-head">
            <div className="tnw-avatar" aria-hidden="true">AI</div>
            <div className="tnw-head__text">
              <h2 id="tnw-title" className="tnw-title">{t.title}</h2>
              <p className="tnw-sub"><span className="tnw-dot" aria-hidden="true" /><span>{withAgent ? t.subAgent : t.sub}</span></p>
            </div>
            <div className="tnw-head__actions">
              <button type="button" className="tnw-icon tnw-lang" aria-label="Switch language" lang={lang === 'en' ? 'hi' : 'en'}
                onClick={() => setLang((l) => (l === 'en' ? 'hi' : 'en'))}>{lang === 'en' ? 'हिं' : 'EN'}</button>
              <button type="button" className="tnw-icon tnw-voice" aria-label={t.voice} title={t.voice} onClick={() => setCall('connecting')}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
              <button type="button" className="tnw-icon tnw-close" aria-label={t.close} onClick={closePanel}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </div>
          </header>

          <div className="tnw-log" role="log" aria-live="polite" aria-relevant="additions" ref={logRef}>{messages.map(renderMessage)}</div>

          <form className="tnw-input" autoComplete="off" onSubmit={submit}>
            <label className="tnw-sr" htmlFor="tnw-text">{t.placeholder}</label>
            <textarea id="tnw-text" ref={inputRef} rows={1} maxLength={500} value={text} placeholder={t.placeholder} onChange={onInput}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e); }} />
            <button type="submit" className="tnw-send" aria-label={t.send} disabled={busy}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2-6z" fill="currentColor" /></svg>
            </button>
          </form>
          <p className="tnw-disclaimer">{t.disclaimer}</p>

          {call !== 'off' && (
            <div className={`tnw-call ${call === 'live' ? 'is-live' : ''}`}>
              <div className="tnw-call__pulse" aria-hidden="true"><span /><span /><span /></div>
              <p className="tnw-call__status" role="status">{call === 'live' ? 'Connected · speak in English, Hindi or your language' : 'Connecting to the voice assistant…'}</p>
              <p className="tnw-call__note">In the full build this opens a browser voice call to the same AI agent (LiveKit WebRTC). For now this shows the screen only.</p>
              <button type="button" className="tnw-btn tnw-btn--danger tnw-call__end" autoFocus onClick={() => setCall('off')}>End call</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
});

export default Widget;
