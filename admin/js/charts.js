// Minimal SVG charts (no external libraries, so pages work offline).
window.Charts = (function () {
  const NS = 'http://www.w3.org/2000/svg';

  // series: [{name, values, color, dashed}], labels: x labels, opts: {height, yMax, threshold:{value,label}}
  function line(host, { labels, series, height = 240, yMax, threshold, unit = 'ms' }) {
    const w = host.clientWidth || 640;
    const h = height;
    const pad = { l: 48, r: 16, t: 16, b: 28 };
    const max = yMax || Math.ceil(Math.max(...series.flatMap((s) => s.values), threshold ? threshold.value : 0) / 200) * 200;
    const x = (i) => pad.l + (i * (w - pad.l - pad.r)) / (labels.length - 1);
    const y = (v) => pad.t + (1 - v / max) * (h - pad.t - pad.b);

    let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="${series.map((s) => s.name).join(', ')} over time">`;
    for (let g = 0; g <= 4; g++) {
      const v = (max / 4) * g;
      svg += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pad.l - 8}" y="${y(v) + 4}" class="axis" text-anchor="end">${Math.round(v)}</text>`;
    }
    labels.forEach((l, i) => { if (i % 3 === 0) svg += `<text x="${x(i)}" y="${h - 8}" class="axis" text-anchor="middle">${l}</text>`; });
    if (threshold) {
      svg += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(threshold.value)}" y2="${y(threshold.value)}" class="threshold"/>
        <text x="${w - pad.r}" y="${y(threshold.value) - 6}" class="threshold-label" text-anchor="end">${threshold.label}</text>`;
    }
    series.forEach((s) => {
      const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2" ${s.dashed ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round"/>`;
      const last = s.values.length - 1;
      svg += `<circle cx="${x(last)}" cy="${y(s.values[last])}" r="3.5" fill="${s.color}"><title>${s.name}: ${s.values[last]} ${unit}</title></circle>`;
    });
    // Invisible hover targets with tooltips.
    labels.forEach((l, i) => {
      const tip = series.map((s) => `${s.name}: ${s.values[i]} ${unit}`).join('\n');
      svg += `<rect x="${x(i) - 8}" y="${pad.t}" width="16" height="${h - pad.t - pad.b}" fill="transparent"><title>${l}\n${tip}</title></rect>`;
    });
    svg += '</svg>';
    host.innerHTML = svg;
  }

  // items: [{label, value(0..1), color}]
  function bars(host, items, { format = (v) => Math.round(v * 100) + '%' } = {}) {
    host.innerHTML = `<ul class="hbars">${items.map((it) => `
      <li><span class="hbars__label">${it.label}</span>
        <span class="hbars__track"><span class="hbars__fill" style="width:${Math.max(2, it.value * 100)}%;background:${it.color || 'var(--accent)'}"></span></span>
        <span class="hbars__value">${format(it.value)}</span></li>`).join('')}</ul>`;
  }

  // Ring gauge for a single 0..1 value.
  function ring(host, value, { label = '', color = 'var(--accent)', target } = {}) {
    const r = 46, c = 2 * Math.PI * r;
    host.innerHTML = `<svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="${label} ${Math.round(value * 100)}%">
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--track)" stroke-width="12"/>
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="${(value * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/>
      ${target ? `<line x1="60" y1="8" x2="60" y2="20" stroke="var(--ink)" stroke-width="2" transform="rotate(${target * 360} 60 60)"/>` : ''}
      <text x="60" y="64" text-anchor="middle" class="ring-num">${Math.round(value * 100)}%</text></svg>`;
  }

  // Stacked bar of latency stages: [{label, ms, color}]
  function stack(host, parts, total) {
    const sum = total || parts.reduce((a, p) => a + p.ms, 0);
    host.innerHTML = `<div class="stack" role="img" aria-label="${parts.map((p) => `${p.label} ${p.ms} ms`).join(', ')}">${parts.filter((p) => p.ms > 0).map((p) =>
      `<span style="flex:${p.ms};background:${p.color}" title="${p.label}: ${p.ms} ms"></span>`).join('')}</div>`;
    return sum;
  }

  return { line, bars, ring, stack, NS };
})();
