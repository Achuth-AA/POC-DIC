// Evaluation: latest report vs RFP targets, STT accuracy per language, red-team, run history.
document.addEventListener('DOMContentLoaded', () => {
  const { esc, pct, badge, toast } = UI;
  const R = MOCK.evalReport;

  const fmt = (m) => (m.unit === 'ms' ? m.value.toLocaleString('en-IN') + ' ms' : pct(m.value, 1));

  function render() {
    document.getElementById('runTitle').textContent = `Run ${R.run} · ${R.at}`;
    document.getElementById('runConfig').textContent = R.config;
    const passed = R.metrics.filter((m) => m.pass).length;
    document.getElementById('runSummary').innerHTML = passed === R.metrics.length
      ? badge('ok', `All ${passed} targets met`) : badge('warn', `${passed} of ${R.metrics.length} targets met`);

    document.getElementById('metrics').innerHTML = `
      <thead><tr><th>Metric</th><th class="num">Result</th><th>Target</th><th>Status</th><th class="num">Cases</th><th>RFP ref.</th></tr></thead>
      <tbody>${R.metrics.map((m) => `<tr>
        <td class="cell-title">${esc(m.name)}</td><td class="num val">${fmt(m)}</td><td>${esc(m.target)}</td>
        <td>${m.pass ? '<span class="pass">✓ Pass</span>' : '<span class="fail">✕ Below target</span>'}</td>
        <td class="num">${m.n}</td><td>${esc(m.ref)}</td></tr>`).join('')}</tbody>`;

    document.getElementById('stt').innerHTML = R.stt.map((s) => `
      <div class="budget__row"><span>${esc(s.lang)}</span>
        <span class="budget__bar" title="target ${pct(s.target)}"><span style="width:${s.acc * 100}%;background:${s.acc >= s.target ? 'var(--c-cache)' : 'var(--bad)'}"></span><i style="left:${s.target * 100}%"></i></span>
        <span class="num">${pct(s.acc)}</span></div>`).join('');

    document.getElementById('redteam').innerHTML = `
      <thead><tr><th>Attack type</th><th class="num">Cases</th><th class="num">Blocked</th><th>Result</th></tr></thead>
      <tbody>${R.redteam.map((r) => `<tr><td>${esc(r.cat)}</td><td class="num">${r.n}</td><td class="num">${r.blocked}</td>
        <td>${r.blocked === r.n ? badge('ok', 'All blocked') : badge('bad', `${r.n - r.blocked} got through`)}</td></tr>`).join('')}</tbody>`;

    document.getElementById('history').innerHTML = `
      <thead><tr><th>Run</th><th>When</th><th>What changed</th><th class="num">Accuracy</th><th class="num">Made-up answers</th><th class="num">Median latency</th></tr></thead>
      <tbody>${R.history.map((h) => `<tr><td class="mono">${esc(h.run)}</td><td>${esc(h.at)}</td><td>${esc(h.change)}</td>
        <td class="num">${pct(h.acc, 1)}</td><td class="num">${pct(h.halluc, 1)}</td><td class="num">${h.p50} ms</td></tr>`).join('')}</tbody>`;
  }

  document.getElementById('runBtn').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const prog = document.getElementById('progress');
    const bar = prog.querySelector('.bar span');
    const text = document.getElementById('progressText');
    const steps = ['Golden Q&A', 'Unanswerable', 'Escalation', 'Red team', 'Audio / STT', 'Latency benchmark'];
    btn.disabled = true;
    prog.classList.add('is-on');
    steps.forEach((s, i) => setTimeout(() => {
      bar.style.width = ((i + 1) / steps.length) * 100 + '%';
      text.textContent = `${s} (${i + 1}/${steps.length})`;
      if (i === steps.length - 1) {
        setTimeout(() => {
          const n = Number(R.run.slice(1)) + 1;
          R.history.unshift({ run: '#' + n, at: new Date().toISOString().slice(0, 16).replace('T', ' '), acc: R.metrics[0].value, halluc: R.metrics[1].value, p50: R.metrics[7].value, change: 'Manual run' });
          R.run = '#' + n;
          R.at = R.history[0].at;
          render();
          prog.classList.remove('is-on');
          bar.style.width = '0';
          btn.disabled = false;
          toast(`Run #${n} finished (demo data).`);
        }, 500);
      }
    }, 600 * (i + 1)));
  });

  render();
});
