// Shared shell (sidebar + top bar) and small UI helpers for every admin page.
window.UI = (function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (v, d = 0) => (v * 100).toFixed(d) + '%';
  const ms = (v) => v.toLocaleString('en-IN') + ' ms';

  const NAV = [
    { id: 'dashboard', href: 'index.html', label: 'Dashboard', icon: '<path d="M4 13h6V4H4zm0 7h6v-5H4zm10 0h6v-9h-6zm0-16v5h6V4z"/>' },
    { id: 'knowledge', href: 'knowledge.html', label: 'Knowledge base', icon: '<path d="M5 4h10l4 4v12H5zM14 4v5h5M8 13h8M8 17h6"/>' },
    { id: 'providers', href: 'providers.html', label: 'Providers & cache', icon: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6"/>' },
    { id: 'calls', href: 'calls.html', label: 'Calls & chats', icon: '<path d="M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>' },
    { id: 'evaluation', href: 'evaluation.html', label: 'Evaluation', icon: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>' },
  ];

  const STATUS = {
    published: ['ok', 'Published'], draft: ['warn', 'Draft'], processing: ['info', 'Processing'], failed: ['bad', 'Failed'], archived: ['muted', 'Archived'],
    resolved: ['ok', 'Resolved'], handoff: ['info', 'Handoff'], callback: ['warn', 'Callback'], abandoned: ['muted', 'Abandoned'], live: ['live', 'Live'],
    ok: ['ok', 'Healthy'], degraded: ['warn', 'Degraded'], down: ['bad', 'Down'],
    public: ['info', 'Public'], internal: ['violet', 'Internal'], tool: ['muted', 'Tool data'],
  };
  const badge = (key, label) => {
    const [tone, text] = STATUS[key] || ['muted', key];
    return `<span class="badge badge--${tone}">${esc(label || text)}</span>`;
  };

  function toast(text) {
    let host = document.querySelector('.toasts');
    if (!host) { host = document.createElement('div'); host.className = 'toasts'; host.setAttribute('role', 'status'); document.body.appendChild(host); }
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    host.appendChild(t);
    setTimeout(() => t.classList.add('is-out'), 2800);
    setTimeout(() => t.remove(), 3200);
  }

  function renderShell() {
    const page = document.body.dataset.page;
    const side = document.getElementById('sidebar');
    side.innerHTML = `
      <a class="side-brand" href="index.html">
        <span class="side-brand__mark" aria-hidden="true">VA</span>
        <span><strong>Voice AI Platform</strong><small>Admin console · POC</small></span>
      </a>
      <nav aria-label="Admin">
        <ul class="side-nav">${NAV.map((n) => `
          <li><a href="${n.href}" ${n.id === page ? 'aria-current="page"' : ''}>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${n.icon}</svg>
            <span>${n.label}</span></a></li>`).join('')}
        </ul>
      </nav>
      <div class="side-foot">
        <a href="../human-assist/index.html">Open agent console ↗</a>
        <a href="../end-user/index.html">Open citizen demo ↗</a>
      </div>`;

    const top = document.getElementById('topbar');
    top.innerHTML = `
      <button type="button" class="icon-btn menu-btn" aria-label="Open menu" aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <label class="tenant">
        <span class="sr-only">Helpline</span>
        <select aria-label="Helpline"><option>${esc(MOCK.kb.tenantName)}</option><option disabled>+ Add helpline (later)</option></select>
      </label>
      <span class="pill" title="Knowledge base version used by live calls">KB v<span data-kb-version>${MOCK.kb.version}</span></span>
      <span class="pill pill--ok" title="Where the POC runs"><span class="dot"></span>POC · India-hosted</span>
      <span class="top-spacer"></span>
      <span class="who"><span class="avatar" aria-hidden="true">AD</span><span class="who__name">admin@dic</span></span>`;

    const btn = top.querySelector('.menu-btn');
    btn.addEventListener('click', () => {
      const open = document.body.classList.toggle('nav-open');
      btn.setAttribute('aria-expanded', String(open));
    });
  }

  document.addEventListener('DOMContentLoaded', renderShell);

  return { esc, pct, ms, badge, toast };
})();
