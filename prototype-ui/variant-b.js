// PROTOTYPE — Variant B "Control room": table-first operator screen (dark, glanceable). Throwaway.
(function () {
  const { useState, useEffect, useRef, useMemo } = React;
  const { html, useTournament, fmt } = window.Proto;

  const CSS = `
  @keyframes vbAmber { 0%,100% { box-shadow: 0 0 0 2px rgba(251,191,36,.5); } 50% { box-shadow: 0 0 0 3px rgba(251,191,36,1), 0 0 30px 6px rgba(251,191,36,.45); } }
  @keyframes vbRed { 0%,100% { box-shadow: 0 0 0 2px rgba(239,68,68,.6); } 50% { box-shadow: 0 0 0 4px rgba(239,68,68,1), 0 0 40px 10px rgba(239,68,68,.55); } }
  @keyframes vbIdle { 0%,100% { box-shadow: 0 0 0 2px rgba(52,211,153,.6), 0 0 10px rgba(52,211,153,.2); } 50% { box-shadow: 0 0 0 4px rgba(110,231,183,1), 0 0 44px 10px rgba(52,211,153,.5); } }
  @keyframes vbBlink { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
  .vb-amber { animation: vbAmber 2s ease-in-out infinite; }
  .vb-red { animation: vbRed 1s ease-in-out infinite; }
  .vb-idle2 { box-shadow: 0 0 0 2px rgba(52,211,153,.75), 0 0 24px rgba(52,211,153,.25); }
  .vb-idle3 { animation: vbIdle 1.4s ease-in-out infinite; }
  .vb-blink { animation: vbBlink 1.2s ease-in-out infinite; }
  .vb-num { font-variant-numeric: tabular-nums; }
  .vb-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
  .vb-scroll::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
  `;

  // ---------- helpers ----------
  const KO_ROUND = { 1: 'Quarter-final', 2: 'Semi-final', 3: 'Final' };
  function matchTitle(m) {
    if (m.section === 'group') return `Group ${m.group} R${m.round} · ${m.label}`;
    if (m.section === 'main') return KO_ROUND[m.round] === m.label ? m.label : `${KO_ROUND[m.round] || 'R' + m.round} · ${m.label}`;
    if (m.section === 'third') return '3rd place';
    if (m.section === 'winners') return `Winners R${m.round} · ${m.label}`;
    if (m.section === 'losers') return `Losers R${m.round} · ${m.label}`;
    if (m.section === 'second-final') return '2nd final';
    if (m.section === 'playoff') return `Play-off ${m.label}`;
    return m.label;
  }
  const tNum = (tableId) => (tableId ? tableId.replace(/^T/, '') : '');

  // Slot view: resolved player, or placeholder; group-fed slots keep their origin tag ("1A").
  function slotView(m, side, standings) {
    const s = m[side];
    const tag = s.origin ? s.label : null;
    if (s.player) return { name: fmt.name(s.player), full: fmt.fullName(s.player), club: s.player.club, tag, player: s.player };
    if (s.origin) {
      const stage = m.competition.stages.find((x) => x.id === m.stage);
      const st = stage && stage.feedsFrom && standings[stage.feedsFrom] && standings[stage.feedsFrom][s.origin.group];
      const row = st && st.rows[s.origin.place - 1];
      if (row && row.played > 0) return { name: fmt.name(row.player), full: fmt.fullName(row.player), club: row.player.club, tag, provisional: !st.complete };
    }
    return { name: null, tag: s.label, placeholder: true };
  }

  function busyInfo(m, matches) {
    const out = [];
    [m.a.player, m.b.player].forEach((p) => {
      if (!p) return;
      const cur = matches.find((x) => x.state === 'in_progress' && x.id !== m.id && ((x.a.player && x.a.player.id === p.id) || (x.b.player && x.b.player.id === p.id)));
      if (cur) out.push({ p, match: cur });
    });
    return out;
  }

  const gamesWon = (games) => games.reduce((acc, [x, y]) => (x > y ? [acc[0] + 1, acc[1]] : [acc[0], acc[1] + 1]), [0, 0]);

  function findMatch(tok, ctx) {
    const norm = (s) => s.toLowerCase().replace(/–/g, '-').replace(/\s+/g, '');
    const t = norm(tok);
    let m = ctx.matches.find((x) => norm(x.id) === t) || ctx.matches.find((x) => norm(`${x.competition.short}-${x.label}`) === t);
    if (m) return m;
    const byLabel = ctx.matches.filter((x) => norm(x.label) === t);
    return byLabel.length === 1 ? byLabel[0] : null;
  }

  // ---------- small UI bits ----------
  const CompChip = ({ c, big }) => html`<span className=${`inline-block rounded font-black tracking-wider text-white ${big ? 'px-2 py-0.5 text-sm' : 'px-1.5 text-[11px]'}`} style=${{ background: c.color }}>${c.short}</span>`;
  const Tag = ({ t, prov }) => (t ? html`<span className=${`ml-1 rounded px-1 text-[11px] font-bold align-middle ${prov ? 'bg-slate-800 text-slate-400' : 'bg-slate-700 text-slate-100'}`}>${t}${prov ? '?' : ''}</span>` : null);
  const SlotName = ({ sv, cls }) => html`<span className=${`truncate ${cls || ''}`}>${sv.name ? html`${sv.name}<${Tag} t=${sv.tag} prov=${sv.provisional} />` : html`<span className="italic text-slate-500">${sv.tag}</span>`}</span>`;

  function Ring({ pct, color, size = 116, stroke = 10, children }) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
    const over = Math.max(0, Math.min(1, pct - 1));
    return html`<div className="relative shrink-0" style=${{ width: size, height: size }}>
      <svg width=${size} height=${size} className="-rotate-90">
        <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke="rgba(148,163,184,.14)" strokeWidth=${stroke} />
        <circle cx=${size / 2} cy=${size / 2} r=${r} fill="none" stroke=${color} strokeWidth=${stroke} strokeLinecap="round" strokeDasharray=${`${c * p} ${c}`} />
        ${over > 0 ? html`<circle cx=${size / 2} cy=${size / 2} r=${r - stroke} fill="none" stroke="#ef4444" strokeWidth=${stroke / 2} strokeDasharray=${`${2 * Math.PI * (r - stroke) * over} 9999`} />` : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">${children}</div>
    </div>`;
  }

  function Toggle({ on, onClick, label }) {
    return html`<button onClick=${(e) => { e.stopPropagation(); onClick(); }} className="inline-flex items-center gap-2 text-sm">
      <span className=${`relative w-10 h-5 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-slate-700'}`}><span className=${`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? 'left-5' : 'left-0.5'}`}></span></span>
      ${label ? html`<span className=${on ? 'text-emerald-300' : 'text-slate-400'}>${label}</span>` : null}
    </button>`;
  }

  // ---------- status strip ----------
  function StatusStrip({ ctx, tab, setTab, openCmd, toggleLog }) {
    const { tables, stats, tournament, log, now } = ctx;
    const free = tables.filter((t) => t.status === 'free').length;
    const playing = tables.filter((t) => t.status === 'playing').length;
    const over = tables.filter((t) => t.status === 'overdue');
    const red = over.some((t) => t.match.overdue === 2);
    const tabBtn = (k, label, key) => html`<button onClick=${() => setTab(k)} className=${`px-4 h-9 rounded-lg font-semibold ${tab === k ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:bg-slate-800'}`}>${label} <span className="text-[10px] opacity-60 ml-1">${key}</span></button>`;
    const Cnt = ({ n, label, cls, extra }) => html`<div className=${`flex items-baseline gap-1.5 px-3 h-10 rounded-lg ${cls} ${extra || ''} flex items-center`}><span className="text-2xl font-black vb-num">${n}</span><span className="text-[11px] font-bold tracking-widest">${label}</span></div>`;
    const clock = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return html`<div className="h-16 shrink-0 flex items-center gap-4 px-4 border-b border-slate-800 bg-[#070b14]">
      <div className="leading-tight mr-2 whitespace-nowrap"><div className="font-black text-base">${tournament.name}</div><div className="text-[11px] text-slate-500 uppercase tracking-widest">${tournament.venue} · Control room</div></div>
      <div className="flex gap-1 bg-slate-900 p-1 rounded-xl">${tabBtn('floor', 'Floor', 'F')}${tabBtn('draws', 'Draws', 'D')}</div>
      <div className="flex gap-2 ml-2">
        <${Cnt} n=${free} label="FREE" cls=${free ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-900 text-slate-500'} />
        <${Cnt} n=${playing} label="PLAYING" cls="bg-sky-500/15 text-sky-300" />
        <${Cnt} n=${over.length} label="OVERDUE" cls=${over.length ? (red ? 'bg-red-500/25 text-red-300' : 'bg-amber-500/20 text-amber-300') : 'bg-slate-900 text-slate-500'} extra=${over.length ? 'vb-blink' : ''} />
      </div>
      <div className="flex gap-4 ml-2">
        ${stats.byCompetition.map((b) => html`<div key=${b.competition.id} className="w-28">
          <div className="flex justify-between text-xs"><${CompChip} c=${b.competition} /><span className="vb-num text-slate-300">${b.finished}/${b.total}</span></div>
          <div className="h-1.5 mt-1 rounded bg-slate-800 overflow-hidden"><div className="h-full" style=${{ width: `${(100 * b.finished) / Math.max(1, b.total)}%`, background: b.competition.color }}></div></div>
        </div>`)}
        <div className="text-xs leading-tight text-slate-400">avg match<div className="text-lg font-bold text-slate-100 vb-num">${Math.round(stats.avgDurationMin)}′</div></div>
      </div>
      <div className="flex-1"></div>
      <button onClick=${openCmd} className="flex items-center gap-3 h-10 px-3 w-64 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:border-slate-500 text-sm">
        <span>⌘</span><span className="flex-1 text-left">Command…</span><kbd className="text-[11px] bg-slate-800 rounded px-1.5 py-0.5">Ctrl K</kbd><kbd className="text-[11px] bg-slate-800 rounded px-1.5 py-0.5">/</kbd>
      </button>
      <button onClick=${toggleLog} className="h-10 px-3 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-sm">Log <span className="ml-1 text-slate-400">${log.length}</span> <span className="text-[10px] opacity-60 ml-1">L</span></button>
      <div className="text-2xl font-black vb-num text-slate-300 w-20 text-right">${clock}</div>
    </div>`;
  }

  // ---------- table tile ----------
  function TableTile({ t, ctx, ui }) {
    const { selTable, selMatch, drag, setDrag } = ui;
    const m = t.match;
    const onDragOver = (e) => { if (t.status === 'free') { e.preventDefault(); if (drag.over !== t.id) setDrag((d) => ({ ...d, over: t.id })); } };
    const onDrop = (e) => {
      e.preventDefault();
      const id = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || drag.id;
      setDrag({ id: null, over: null });
      if (id) ui.assign(id, t.id);
    };
    const onDragLeave = () => drag.over === t.id && setDrag((d) => ({ ...d, over: null }));
    const base = 'relative rounded-2xl border overflow-hidden flex flex-col min-h-0 transition-colors';
    const head = (right) => html`<div className="px-4 pt-3 flex items-start justify-between gap-2">
      <div><div className="text-6xl font-black leading-none vb-num">${t.number}</div><div className="text-[11px] uppercase tracking-widest text-slate-500 mt-1">${t.name || 'Table'}</div></div>
      ${right}
    </div>`;

    if (t.status === 'inactive') {
      return html`<div className=${`${base} border-dashed border-slate-800 bg-slate-950 opacity-50`}>
        ${head(null)}
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="text-2xl font-black tracking-widest text-slate-600">INACTIVE</div>
          <${Toggle} on=${false} onClick=${() => ctx.actions.toggleTable(t.id)} label="Activate" />
        </div>
      </div>`;
    }

    if (m) {
      const sa = slotView(m, 'a', ctx.standings), sb = slotView(m, 'b', ctx.standings);
      const pct = m.elapsedMin / m.expectedMin;
      const col = m.overdue === 2 ? '#ef4444' : m.overdue === 1 ? '#fbbf24' : '#38bdf8';
      const glow = m.overdue === 2 ? 'vb-red border-red-500 bg-red-950/30' : m.overdue === 1 ? 'vb-amber border-amber-400 bg-amber-950/20' : 'border-slate-700 bg-slate-900';
      return html`<div onClick=${() => ui.openMatch(m.id)} className=${`${base} ${glow} cursor-pointer hover:border-slate-400`}>
        <div className="h-2 shrink-0" style=${{ background: m.competition.color }}></div>
        ${head(html`<div className="text-right min-w-0"><${CompChip} c=${m.competition} /><div className="text-[11px] text-slate-400 mt-1 leading-tight">${matchTitle(m)}</div></div>`)}
        <div className="px-4 mt-3 space-y-0.5 min-w-0">
          <div className="text-lg font-bold leading-tight flex min-w-0"><${SlotName} sv=${sa} /></div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest">vs</div>
          <div className="text-lg font-bold leading-tight flex min-w-0"><${SlotName} sv=${sb} /></div>
        </div>
        <div className="flex-1 flex items-center justify-center min-h-0">
          <${Ring} pct=${pct} color=${col}>
            <div className=${`text-3xl font-black vb-num ${m.overdue === 2 ? 'text-red-300' : m.overdue ? 'text-amber-300' : 'text-white'}`}>${fmt.clock(m.elapsedMin)}</div>
            <div className="text-[11px] text-slate-400">of ${m.expectedMin}′</div>
          </${Ring}>
        </div>
        <div className=${`px-3 pb-3 text-center text-xs font-bold tracking-wide ${m.overdue === 2 ? 'text-red-300' : m.overdue ? 'text-amber-300' : 'text-slate-500'}`}>
          ${m.overdue ? `OVERDUE +${Math.round(m.elapsedMin - m.expectedMin)}′ · ask for score` : html`press <kbd className="bg-slate-800 rounded px-1 text-slate-300">${t.number}</kbd> to enter score`}
        </div>
      </div>`;
    }

    // free
    const idle = t.idleMin;
    const level = idle == null || idle < 5 ? 1 : idle < 12 ? 2 : 3;
    const armed = selMatch || drag.id;
    const isSel = selTable === t.id;
    const over = drag.over === t.id;
    const lvlCls = level === 3 ? 'vb-idle3 border-emerald-300 bg-emerald-950/50' : level === 2 ? 'vb-idle2 border-emerald-400 bg-emerald-950/30' : 'border-emerald-800 bg-emerald-950/10';
    const cls = over ? 'border-cyan-300 bg-cyan-900/40 ring-4 ring-cyan-300' : armed ? `border-cyan-400 border-dashed bg-cyan-950/30 ${level === 3 ? 'vb-idle3' : ''}` : isSel ? 'border-white bg-slate-900 ring-2 ring-white' : lvlCls;
    const armedMatch = armed && ctx.matchById[selMatch || drag.id];
    const sugg = isSel ? ctx.queue.filter((x) => x.status === 'ready').slice(0, 3) : [];
    return html`<div onClick=${() => ui.clickFreeTable(t.id)} onDragOver=${onDragOver} onDragLeave=${onDragLeave} onDrop=${onDrop} className=${`${base} ${cls} cursor-pointer`}>
      <div className="h-2 shrink-0 bg-emerald-500/40"></div>
      ${head(html`<button title="Deactivate table" onClick=${(e) => { e.stopPropagation(); ctx.actions.toggleTable(t.id); }} className="text-slate-600 hover:text-slate-300 text-sm">⏻</button>`)}
      ${isSel ? html`<div className="flex-1 flex flex-col px-3 pt-3 pb-3 gap-2 min-h-0">
          <div className="text-[11px] uppercase tracking-widest text-slate-400">Next up for table ${t.number}</div>
          ${sugg.length ? sugg.map((s, i) => html`<button key=${s.id} onClick=${(e) => { e.stopPropagation(); ui.assign(s.id, t.id); }} className=${`text-left rounded-lg border px-2 py-1.5 ${i === 0 ? 'border-cyan-400 bg-cyan-950/60' : 'border-slate-700 bg-slate-950 hover:border-cyan-600'}`}>
              <div className="flex items-center gap-1"><${CompChip} c=${s.competition} /><span className="text-[11px] text-slate-400 truncate">${s.label}</span>${i === 0 ? html`<span className="ml-auto text-[10px] text-cyan-300">↵</span>` : null}</div>
              <div className="text-sm font-semibold leading-tight truncate">${fmt.name(s.a.player)}</div>
              <div className="text-sm font-semibold leading-tight truncate">${fmt.name(s.b.player)}</div>
            </button>`) : html`<div className="text-slate-500 text-sm">Nothing ready.</div>`}
          <div className="text-[11px] text-slate-500 mt-auto">Enter = top · Esc = cancel</div>
        </div>`
      : html`<div className="flex-1 flex flex-col items-center justify-center text-center px-2">
          ${armed ? html`<div className="text-2xl font-black text-cyan-300">ASSIGN HERE</div>
              <div className="text-sm text-cyan-100 mt-2 font-semibold">${armedMatch ? `${armedMatch.competition.short} ${armedMatch.label}` : ''}</div>
              <div className="text-xs text-slate-400 mt-1">${drag.id ? 'drop' : html`click or press <kbd className="bg-slate-800 rounded px-1">${t.number}</kbd>`}</div>`
          : html`<div className=${`font-black tracking-widest text-emerald-400 ${level === 3 ? 'text-5xl text-emerald-200' : level === 2 ? 'text-5xl' : 'text-4xl'}`}>FREE</div>
              <div className=${`mt-2 vb-num font-bold ${level === 3 ? 'text-2xl text-emerald-200' : level === 2 ? 'text-xl text-emerald-300' : 'text-base text-emerald-600'}`}>${idle == null ? 'ready' : `idle ${Math.floor(idle)} min`}</div>
              <div className="text-xs text-slate-500 mt-4">click for suggestions</div>`}
        </div>`}
    </div>`;
  }

  // ---------- queue ----------
  function QueueColumn({ ctx, ui, lastFinish }) {
    const ready = ctx.queue.filter((m) => m.status === 'ready');
    const busy = ctx.queue.filter((m) => m.status === 'busy');
    const pending = ctx.matches.filter((m) => m.status === 'pending').length;
    const suggested = ui.selTable ? ready.slice(0, 3).map((m) => m.id) : [];
    const card = (m, i) => {
      const isBusy = m.status === 'busy';
      const sel = ui.selMatch === m.id;
      const sa = slotView(m, 'a', ctx.standings), sb = slotView(m, 'b', ctx.standings);
      const rest = [m.a.player, m.b.player].map((p) => (p && lastFinish[p.id] ? { p, min: (ctx.now - lastFinish[p.id]) / 60000 } : null)).filter(Boolean);
      const wait = m.readySince ? (ctx.now - m.readySince) / 60000 : null;
      const bi = isBusy ? busyInfo(m, ctx.matches) : [];
      return html`<div key=${m.id} draggable=${!isBusy}
          onDragStart=${(e) => { e.dataTransfer.setData('text/plain', m.id); e.dataTransfer.effectAllowed = 'move'; ui.setDrag({ id: m.id, over: null }); }}
          onDragEnd=${() => ui.setDrag({ id: null, over: null })}
          onClick=${() => ui.clickQueue(m.id)}
          className=${`group relative rounded-xl border pl-3 pr-3 py-2 cursor-pointer transition ${sel ? 'border-cyan-300 bg-cyan-900/40 ring-2 ring-cyan-300' : isBusy ? 'border-cyan-950 bg-slate-900/50 opacity-70' : suggested.includes(m.id) ? 'border-cyan-500 bg-cyan-950/40' : 'border-slate-800 bg-slate-900 hover:border-cyan-700'}`}>
        <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r" style=${{ background: m.competition.color }}></div>
        <div className="flex items-center gap-2">
          <span className=${`text-xl font-black w-7 vb-num ${isBusy ? 'text-slate-600' : 'text-cyan-400'}`}>${isBusy ? '⏳' : i + 1}</span>
          <${CompChip} c=${m.competition} />
          <span className="text-xs text-slate-400 truncate">${matchTitle(m)}</span>
          <span className="ml-auto text-[11px] text-slate-500 vb-num whitespace-nowrap">${wait != null ? `ready ${Math.floor(wait)}′` : ''}</span>
          <button title="Details" onClick=${(e) => { e.stopPropagation(); ui.openMatch(m.id); }} className="text-slate-500 hover:text-white px-1">⋯</button>
        </div>
        <div className="pl-9 mt-0.5 text-[17px] font-bold leading-snug">
          <div className="flex min-w-0"><${SlotName} sv=${sa} /></div>
          <div className="flex min-w-0"><${SlotName} sv=${sb} /></div>
        </div>
        ${isBusy
          ? html`<div className="pl-9 mt-1 text-xs text-cyan-300/80">${bi.map((x) => html`<div key=${x.p.id}>⏳ ${fmt.name(x.p)} playing on <b>T${tNum(x.match.table)}</b> (${x.match.competition.short} ${x.match.label})</div>`)}</div>`
          : rest.length ? html`<div className="pl-9 mt-1 text-[11px] text-slate-500">rest: ${rest.map((r, k) => html`<span key=${k} className=${r.min < 5 ? 'text-amber-400 font-bold' : ''}>${k ? ' · ' : ''}${r.p.last} ${Math.floor(r.min)}′</span>`)}</div>` : null}
      </div>`;
    };
    return html`<div className="w-[390px] shrink-0 border-l border-slate-800 bg-[#060a12] flex flex-col min-h-0">
      <div className="px-4 pt-3 pb-2 flex items-baseline justify-between">
        <div className="text-sm font-black tracking-[.2em] text-cyan-300">UP NEXT <span className="text-slate-500 ml-1">${ready.length}</span></div>
        <div className="text-[11px] text-slate-500">drag to table · ↑↓ + table no.</div>
      </div>
      ${ui.selTable ? html`<div className="mx-4 mb-2 text-xs rounded bg-white/10 px-2 py-1">Picking for <b>table ${ctx.tables.find((t) => t.id === ui.selTable).number}</b> — click a card or Enter for #1</div>` : null}
      ${ui.selMatch ? html`<div className="mx-4 mb-2 text-xs rounded bg-cyan-500/20 text-cyan-100 px-2 py-1">Selected — click a free table or type its number · Esc</div>` : null}
      <div className="flex-1 min-h-0 overflow-y-auto vb-scroll px-3 pb-20 space-y-2">
        ${ready.map(card)}
        ${!ready.length ? html`<div className="text-slate-500 text-sm p-4">No match ready.</div>` : null}
        ${busy.length ? html`<div className="pt-3 pb-1 text-[11px] font-black tracking-[.2em] text-slate-500">BUSY — PLAYER STILL ON A TABLE</div>` : null}
        ${busy.map(card)}
        <div className="pt-3 text-[11px] text-slate-600">${pending} more waiting for earlier results</div>
      </div>
    </div>`;
  }

  // ---------- score entry ----------
  function ScoreEntry({ m, ctx, initial, onDone, onCancel, sa, sb }) {
    const [val, setVal] = useState(initial || '');
    const ref = useRef(null);
    useEffect(() => { if (ref.current) { ref.current.focus(); const n = ref.current.value.length; ref.current.setSelectionRange(n, n); } }, []);
    const res = val.trim() ? ctx.parseScore(val, m.gamesToWin) : null;
    const tokens = val.trim().split(/[\s,;]+/).filter(Boolean).map((p) => {
      const mm = p.match(/^(\d{1,2})[-:](\d{1,2})$/);
      if (!mm) return { p, bad: true };
      const x = +mm[1], y = +mm[2], hi = Math.max(x, y), lo = Math.min(x, y);
      return { p: `${x}-${y}`, bad: hi < 11 || hi - lo < 2 || (hi > 11 && hi - lo !== 2), win: x > y ? 'A' : 'B' };
    });
    const tally = tokens.filter((t) => !t.bad).reduce((acc, t) => (t.win === 'A' ? [acc[0] + 1, acc[1]] : [acc[0], acc[1] + 1]), [0, 0]);
    const ok = res && res.games;
    const submit = () => {
      if (!ok) return;
      ctx.actions.enterScore(m.id, res.games);
      const [ga, gb] = gamesWon(res.games);
      onDone(`${m.competition.short} ${m.label}: ${(ga > gb ? sa : sb).name} wins ${Math.max(ga, gb)}:${Math.min(ga, gb)}`);
    };
    return html`<div>
      <div className="flex items-center gap-4">
        <input ref=${ref} value=${val} onChange=${(e) => setVal(e.target.value)} spellCheck=${false}
          onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } else if (e.key === 'Escape') { e.preventDefault(); onCancel(); } }}
          placeholder="11-7 9-11 11-5 11-8"
          className=${`flex-1 min-w-0 bg-slate-950 border-2 rounded-xl px-5 py-4 text-4xl font-mono tracking-wide outline-none placeholder:text-slate-700 ${ok ? 'border-emerald-400' : res && res.error ? 'border-amber-500' : 'border-slate-600 focus:border-cyan-400'}`} />
        <div className="text-center w-32">
          <div className="text-5xl font-black vb-num"><span className=${tally[0] > tally[1] ? 'text-white' : 'text-slate-500'}>${tally[0]}</span><span className="text-slate-600">:</span><span className=${tally[1] > tally[0] ? 'text-white' : 'text-slate-500'}>${tally[1]}</span></div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest">games A : B</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-3 min-h-[32px]">
        ${tokens.map((t, i) => html`<span key=${i} className=${`px-2.5 py-1 rounded-lg font-mono text-lg ${t.bad ? 'bg-amber-500/20 text-amber-300 line-through' : t.win === 'A' ? 'bg-sky-500/20 text-sky-200' : 'bg-fuchsia-500/20 text-fuchsia-200'}`}>${t.p}${t.bad ? '' : html`<span className="text-[10px] ml-1 opacity-70">${t.win}</span>`}</span>`)}
      </div>
      <div className=${`mt-2 text-lg font-semibold ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>
        ${ok ? (() => { const [ga, gb] = gamesWon(res.games); return `✓ ${(ga > gb ? sa : sb).full || (ga > gb ? sa : sb).name} wins ${Math.max(ga, gb)}:${Math.min(ga, gb)} — Enter to save`; })() : res ? `⚠ ${res.error}` : html`<span className="text-slate-500">Type games from <b>${sa.name}</b>'s side (A first). Best of ${m.gamesToWin * 2 - 1}. Enter saves, Esc cancels.</span>`}
      </div>
    </div>`;
  }

  // ---------- match modal (score / assign / details) ----------
  function MatchModal({ ctx, matchId, initial, onClose, ui }) {
    const [correcting, setCorrecting] = useState(false);
    useEffect(() => {
      const k = (e) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', k);
      return () => window.removeEventListener('keydown', k);
    }, []);
    const m = ctx.matchById[matchId];
    if (!m) return null;
    const sa = slotView(m, 'a', ctx.standings), sb = slotView(m, 'b', ctx.standings);
    const live = m.status === 'in_progress' || m.status === 'overdue';
    const freeTables = ctx.tables.filter((t) => t.status === 'free');
    const done = (msg) => { ui.say(msg); onClose(); };
    const btn = 'px-4 py-2.5 rounded-lg font-semibold border';
    const player = (sv, side) => html`<div className=${`rounded-xl bg-slate-950/60 border px-4 py-3 min-w-0 ${m.result && m.result.winSide === side ? 'border-emerald-500' : 'border-slate-800'}`}>
      <div className="text-[11px] uppercase tracking-widest text-slate-500">${side === 'A' ? 'Player A (left)' : 'Player B (right)'}</div>
      <div className="text-3xl font-black truncate">${sv.full || sv.name || html`<span className="italic text-slate-500">${sv.tag}</span>`}${sv.name && sv.tag ? html`<span className="ml-2 text-base align-middle rounded bg-slate-700 px-1.5">${sv.tag}${sv.provisional ? '?' : ''}</span>` : null}</div>
      <div className="text-sm text-slate-400">${sv.club || (sv.placeholder ? 'to be decided' : '')}</div>
    </div>`;
    const wo = html`<div className="flex gap-2 flex-wrap">
      <span className="text-sm text-slate-400 self-center mr-1">Walkover:</span>
      <button className=${`${btn} border-slate-700 hover:border-slate-400`} onClick=${() => { ctx.actions.walkover(m.id, 'A'); done(`${m.label}: walkover, ${sa.name} advances`); }}>${sa.name} wins w.o.</button>
      <button className=${`${btn} border-slate-700 hover:border-slate-400`} onClick=${() => { ctx.actions.walkover(m.id, 'B'); done(`${m.label}: walkover, ${sb.name} advances`); }}>${sb.name} wins w.o.</button>
    </div>`;
    const statusTxt = {
      pending: 'Waiting for players', ready: 'Ready to play', busy: 'A player is still on another table', in_progress: 'In progress',
      overdue: 'OVERDUE', finished: 'Finished', walkover: 'Walkover', disabled: 'Play-off switched off',
    }[m.status];
    let body;
    if (live || correcting) {
      body = html`<div className="space-y-5">
        <${ScoreEntry} m=${m} ctx=${ctx} initial=${initial} sa=${sa} sb=${sb} onDone=${done} onCancel=${onClose} />
        ${sa.player && sb.player ? wo : null}
        ${live ? html`<div className="flex gap-2 flex-wrap items-center text-sm text-slate-400">
          <span>Clock:</span>
          <button className="px-2 py-1 rounded border border-slate-700 hover:border-slate-400" onClick=${() => ctx.actions.setStartedMinutesAgo(m.id, m.elapsedMin + 5)}>started 5′ earlier</button>
          <button className="px-2 py-1 rounded border border-slate-700 hover:border-slate-400" onClick=${() => ctx.actions.setStartedMinutesAgo(m.id, Math.max(0, m.elapsedMin - 5))}>5′ later</button>
          <button className="px-2 py-1 rounded border border-slate-700 hover:border-slate-400" onClick=${() => ctx.actions.setStartedMinutesAgo(m.id, 0)}>restart</button>
          <span className="flex-1"></span>
          <button className="px-3 py-1.5 rounded border border-red-900 text-red-300 hover:border-red-500" onClick=${() => { ctx.actions.unassign(m.id); done(`${m.label} taken off table ${tNum(m.table)}`); }}>Take off table</button>
        </div>` : null}
      </div>`;
    } else if (m.status === 'ready' || m.status === 'busy') {
      const bi = busyInfo(m, ctx.matches);
      body = html`<div className="space-y-4">
        ${bi.length ? html`<div className="rounded-lg bg-cyan-950/50 border border-cyan-900 px-3 py-2 text-cyan-200">${bi.map((x) => html`<div key=${x.p.id}>⏳ ${fmt.fullName(x.p)} is playing on table ${tNum(x.match.table)} (${x.match.competition.short} ${x.match.label})</div>`)}</div>` : null}
        <div className="text-sm text-slate-400">Assign to a free table${bi.length ? ' (forces it despite the busy player)' : ''}:</div>
        <div className="flex flex-wrap gap-2">
          ${freeTables.length ? freeTables.map((t) => html`<button key=${t.id} onClick=${() => { if (ui.assign(m.id, t.id, true)) onClose(); }} className=${`w-20 h-20 rounded-xl border-2 text-3xl font-black ${bi.length ? 'border-cyan-900 text-cyan-200' : 'border-emerald-500 text-emerald-300 hover:bg-emerald-500/20'}`}>${t.number}<div className="text-[10px] font-normal text-slate-400">${t.idleMin != null ? `idle ${Math.floor(t.idleMin)}′` : 'free'}</div></button>`) : html`<div className="text-slate-500">No free table right now.</div>`}
        </div>
        ${wo}
      </div>`;
    } else if (m.status === 'finished' || m.status === 'walkover') {
      body = html`<div className="flex items-center gap-4">
        <div className="text-4xl font-black vb-num">${fmt.games(m)}</div>
        <div className="font-mono text-xl text-slate-300">${fmt.gameList(m)}</div>
        ${m.status === 'walkover' ? html`<span className="rounded bg-slate-700 px-2 py-0.5 text-sm font-bold">W.O.</span>` : null}
        <span className="flex-1"></span>
        ${m.durationMin != null && !m.walkover ? html`<span className="text-slate-400">${fmt.mins(m.durationMin)} on T${tNum(m.table)}</span>` : null}
        <button className=${`${btn} border-slate-700 hover:border-slate-400`} onClick=${() => setCorrecting(true)}>Correct score</button>
      </div>`;
    } else if (m.status === 'disabled') {
      body = html`<div className="flex items-center gap-4"><div className="text-slate-400">Optional play-off for places ${m.playoff} is switched off.</div><${Toggle} on=${false} onClick=${() => ctx.actions.togglePlayoff(m.comp, m.playoff)} label="Enable play-off" /></div>`;
    } else {
      body = html`<div className="text-slate-400">Players not known yet — waiting for <b className="text-slate-200">${m.a.label || sa.name}</b> and <b className="text-slate-200">${m.b.label || sb.name}</b>.${m.a.origin || m.b.origin ? ' (Fed from group standings.)' : ''}</div>`;
    }
    return html`<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[9vh]" onMouseDown=${onClose}>
      <div className="w-[820px] max-w-[95vw] rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden" onMouseDown=${(e) => e.stopPropagation()}>
        <div className="h-2" style=${{ background: m.competition.color }}></div>
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-4">
            ${m.table && live ? html`<div className="text-center"><div className="text-[10px] uppercase tracking-widest text-slate-500">Table</div><div className="text-6xl font-black leading-none vb-num">${tNum(m.table)}</div></div>` : null}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2"><${CompChip} c=${m.competition} big=${true} /><span className="text-xl font-bold">${matchTitle(m)}</span><span className="text-xs text-slate-500 font-mono">${m.id}</span></div>
              <div className=${`mt-1 font-semibold ${m.overdue === 2 ? 'text-red-300' : m.overdue ? 'text-amber-300' : 'text-slate-400'}`}>${statusTxt}${live ? ` · ${fmt.clock(m.elapsedMin)} of ${m.expectedMin}′` : ''}${m.places && Object.keys(m.places).length ? ` · places ${Object.entries(m.places).map(([k, v]) => `${k} → ${v}`).join(', ')}` : ''}</div>
            </div>
            <button onClick=${onClose} className="text-slate-500 hover:text-white text-2xl leading-none">×</button>
          </div>
          <div className="grid grid-cols-2 gap-3">${player(sa, 'A')}${player(sb, 'B')}</div>
          ${body}
        </div>
      </div>
    </div>`;
  }

  // ---------- command bar ----------
  function parseCommand(raw, ctx, api) {
    const v = raw.trim().toLowerCase().replace(/–/g, '-').replace(/\s+/g, ' ');
    if (!v) return { hint: true };
    const tbl = (n) => ctx.tables.find((t) => t.number === +n);
    let mm;
    if (v === 'd' || v === 'draws') return { desc: 'Switch to Draws', run: () => api.setTab('draws') };
    if (v === 'f' || v === 'floor') return { desc: 'Switch to Floor', run: () => api.setTab('floor') };
    if (v === 'l' || v === 'log') return { desc: 'Toggle change log', run: () => api.toggleLog() };
    if ((mm = v.match(/^(\d{1,2})$/))) {
      const t = tbl(mm[1]);
      if (!t) return { error: `No table ${mm[1]}` };
      return { desc: t.match ? `Open score entry — table ${t.number} (${t.match.competition.short} ${t.match.label})` : t.status === 'free' ? `Show suggestions for free table ${t.number}` : `Table ${t.number} is inactive`, run: () => api.openTable(t.number) };
    }
    if ((mm = v.match(/^(\d{1,2}) (.*\d[-:]\d.*)$/))) {
      const t = tbl(mm[1]);
      if (!t) return { error: `No table ${mm[1]}` };
      if (!t.match) return { error: `Table ${t.number} has no match in progress` };
      const r = ctx.parseScore(mm[2], t.match.gamesToWin);
      if (r.error) return { error: `Table ${t.number}: ${r.error}` };
      const [ga, gb] = gamesWon(r.games);
      const w = slotView(t.match, ga > gb ? 'a' : 'b', ctx.standings).name;
      return { desc: `Save score on table ${t.number} (${t.match.competition.short} ${t.match.label}): ${w} wins ${Math.max(ga, gb)}:${Math.min(ga, gb)}`, run: () => { ctx.actions.enterScore(t.match.id, r.games); api.say(`T${t.number}: ${w} wins ${Math.max(ga, gb)}:${Math.min(ga, gb)}`); } };
    }
    if ((mm = v.match(/^a (\d{1,2})$/))) {
      const t = tbl(mm[1]);
      const top = ctx.queue.find((m) => m.status === 'ready');
      if (!t) return { error: `No table ${mm[1]}` };
      if (t.status !== 'free') return { error: `Table ${t.number} is not free` };
      if (!top) return { error: 'Nothing ready' };
      return { desc: `Assign top of queue ${top.competition.short} ${top.label} (${fmt.name(top.a.player)} – ${fmt.name(top.b.player)}) → table ${t.number}`, run: () => api.assign(top.id, t.id) };
    }
    if ((mm = v.match(/^a (\S+) (\d{1,2})$/))) {
      const m = findMatch(mm[1], ctx), t = tbl(mm[2]);
      if (!m) return { error: `No match "${mm[1]}"` };
      if (!t) return { error: `No table ${mm[2]}` };
      if (t.status !== 'free') return { error: `Table ${t.number} is not free` };
      if (m.status !== 'ready') return { error: `${m.id} is ${m.status}` };
      return { desc: `Assign ${m.competition.short} ${m.label} (${fmt.name(m.a.player)} – ${fmt.name(m.b.player)}) → table ${t.number}`, run: () => api.assign(m.id, t.id) };
    }
    if ((mm = v.match(/^a (\S+)$/))) {
      const m = findMatch(mm[1], ctx);
      return m ? { error: `${m.id} (${m.status}) — add a table number` } : { error: `No match "${mm[1]}" — try an id like open-A-31` };
    }
    if ((mm = v.match(/^wo (\d{1,2}) ([ab])$/))) {
      const t = tbl(mm[1]);
      if (!t || !t.match) return { error: `No match on table ${mm[1]}` };
      const side = mm[2].toUpperCase();
      const w = slotView(t.match, mm[2], ctx.standings).name;
      return { desc: `Walkover on table ${t.number}: ${w} advances`, run: () => { ctx.actions.walkover(t.match.id, side); api.say(`T${t.number}: walkover → ${w}`); } };
    }
    if ((mm = v.match(/^u (\d{1,2})$/))) {
      const t = tbl(mm[1]);
      if (!t || !t.match) return { error: `No match on table ${mm[1]}` };
      return { desc: `Take ${t.match.label} off table ${t.number} (back to queue)`, run: () => { ctx.actions.unassign(t.match.id); api.say(`${t.match.label} back to queue`); } };
    }
    if ((mm = v.match(/^t (\d{1,2})$/))) {
      const t = tbl(mm[1]);
      if (!t) return { error: `No table ${mm[1]}` };
      if (t.match) return { error: `Table ${t.number} is in use` };
      return { desc: `${t.active ? 'Deactivate' : 'Activate'} table ${t.number}`, run: () => ctx.actions.toggleTable(t.id) };
    }
    if ((mm = v.match(/^m (\S+)$/))) {
      const m = findMatch(mm[1], ctx);
      return m ? { desc: `Open match ${m.id}`, run: () => api.openMatch(m.id) } : { error: `No match "${mm[1]}"` };
    }
    return { error: 'Unknown command' };
  }

  function CommandBar({ ctx, api, onClose }) {
    const [v, setV] = useState('');
    const ref = useRef(null);
    useEffect(() => { ref.current && ref.current.focus(); }, []);
    const p = parseCommand(v, ctx, api);
    const help = [
      ['5 11-7 11-9 11-4', 'score for the match on table 5'],
      ['5', 'open table 5 (score / suggestions)'],
      ['a 4', 'assign top of queue to table 4'],
      ['a open-A-31 4', 'assign a specific match to table 4'],
      ['wo 5 a', 'walkover on table 5, player A advances'],
      ['u 5', 'take match off table 5'],
      ['t 10', 'activate / deactivate table 10'],
      ['m u15-D', 'open match details'],
      ['d · f · l', 'Draws · Floor · Log'],
    ];
    const ready = ctx.queue.filter((m) => m.status === 'ready').slice(0, 6);
    return html`<div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-[12vh]" onMouseDown=${onClose}>
      <div className="w-[720px] rounded-2xl bg-slate-900 border border-slate-600 shadow-2xl overflow-hidden" onMouseDown=${(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 border-b border-slate-700">
          <span className="text-2xl text-cyan-400">›</span>
          <input ref=${ref} value=${v} onChange=${(e) => setV(e.target.value)} spellCheck=${false}
            onKeyDown=${(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } else if (e.key === 'Enter') { e.preventDefault(); if (p.run) { onClose(); p.run(); } } }}
            placeholder="5 11-7 11-9 11-4   ·   a 4   ·   wo 5 a" className="flex-1 bg-transparent py-5 text-3xl font-mono outline-none placeholder:text-slate-700" />
        </div>
        <div className=${`px-5 py-3 text-lg font-semibold ${p.run ? 'text-emerald-300' : p.error ? 'text-amber-300' : 'text-slate-500'}`}>
          ${p.run ? html`↵ ${p.desc}` : p.error ? `⚠ ${p.error}` : 'Type a command. Enter runs it, Esc closes.'}
        </div>
        <div className="grid grid-cols-2 gap-x-6 px-5 pb-4">
          <div>
            <div className="text-[11px] font-black tracking-widest text-slate-500 mb-1">COMMANDS</div>
            ${help.map(([c, d]) => html`<button key=${c} onClick=${() => { setV(c.includes('·') ? '' : c.replace(/\d+$/, (x) => x)); ref.current.focus(); }} className="block w-full text-left text-sm py-0.5 hover:text-white text-slate-400"><span className="font-mono text-cyan-300 mr-2">${c}</span>${d}</button>`)}
          </div>
          <div>
            <div className="text-[11px] font-black tracking-widest text-slate-500 mb-1">READY MATCH IDS</div>
            ${ready.map((m) => html`<button key=${m.id} onClick=${() => { setV(`a ${m.id} `); ref.current.focus(); }} className="block w-full text-left text-sm py-0.5 text-slate-400 hover:text-white truncate"><span className="font-mono text-cyan-300 mr-2">${m.id}</span>${fmt.name(m.a.player)} – ${fmt.name(m.b.player)}</button>`)}
          </div>
        </div>
      </div>
    </div>`;
  }

  // ---------- log ----------
  function LogPanel({ ctx, onClose }) {
    return html`<div className="fixed right-0 top-16 bottom-0 w-[420px] z-40 bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800"><div className="font-black tracking-widest text-sm">CHANGE LOG</div><button onClick=${onClose} className="text-slate-400 hover:text-white text-xl">×</button></div>
      <div className="flex-1 overflow-y-auto vb-scroll p-4 space-y-2 pb-20">
        ${ctx.log.length ? ctx.log.map((e, i) => html`<div key=${i} className="flex gap-3 text-sm"><span className="font-mono text-slate-500 vb-num">${new Date(e.at).toLocaleTimeString()}</span><span>${e.text}</span></div>`) : html`<div className="text-slate-500 text-sm">No changes yet this session.</div>`}
      </div>
    </div>`;
  }

  // ---------- draws ----------
  const STATUS_BOX = {
    pending: 'border-slate-800 bg-slate-900/70 text-slate-400',
    ready: 'border-cyan-400 bg-cyan-950/50 shadow-[0_0_0_1px_rgba(34,211,238,.35)]',
    busy: 'border-cyan-900 bg-cyan-950/20 text-slate-300',
    in_progress: 'border-sky-500 bg-sky-950/40',
    finished: 'border-slate-800 bg-slate-900/40 opacity-60',
    walkover: 'border-slate-800 bg-slate-900/40 opacity-60',
    disabled: 'border-dashed border-slate-800 bg-transparent opacity-30',
  };
  function MatchCard({ m, ctx, onOpen }) {
    const sa = slotView(m, 'a', ctx.standings), sb = slotView(m, 'b', ctx.standings);
    const box = m.status === 'overdue' ? (m.overdue === 2 ? 'border-red-500 bg-red-950/40 vb-red' : 'border-amber-400 bg-amber-950/30 vb-amber') : STATUS_BOX[m.status];
    const right = {
      in_progress: html`<span className="text-sky-300">T${tNum(m.table)} · ${fmt.clock(m.elapsedMin)}</span>`,
      overdue: html`<span className=${m.overdue === 2 ? 'text-red-300' : 'text-amber-300'}>T${tNum(m.table)} · ${fmt.clock(m.elapsedMin)}</span>`,
      ready: html`<span className="text-cyan-300">READY</span>`,
      busy: html`<span className="text-cyan-600">⏳ BUSY</span>`,
      walkover: html`<span className="bg-slate-700 text-white rounded px-1">W.O.</span>`,
      finished: html`<span className="text-slate-400 font-mono normal-case">${fmt.gameList(m)}</span>`,
      disabled: html`<span>OFF</span>`,
      pending: null,
    }[m.status];
    const row = (sv, side) => {
      const win = m.result && m.result.winSide === side;
      const lose = m.result && !win;
      const g = m.result && !m.result.walkover ? (side === 'A' ? m.result.gamesA : m.result.gamesB) : '';
      return html`<div className=${`flex items-center gap-2 text-sm leading-6 ${win ? 'font-bold text-white' : lose ? 'text-slate-500' : ''}`}>
        <span className="flex-1 flex min-w-0"><${SlotName} sv=${sv} /></span><span className="vb-num w-4 text-right">${g}</span>
      </div>`;
    };
    return html`<button onClick=${() => onOpen(m.id)} className=${`block text-left w-full rounded-lg border px-2.5 py-1.5 hover:brightness-125 ${box}`}>
      <div className="flex justify-between gap-2 text-[11px] uppercase tracking-wider text-slate-500 truncate"><span className="truncate">${m.label}${m.places && m.places.winner ? ` · ${m.places.winner}${m.places.loser ? '/' + m.places.loser : ''}` : ''}</span>${right}</div>
      ${row(sa, 'A')}${row(sb, 'B')}
    </button>`;
  }

  function Columns({ ms, ctx, onOpen, title }) {
    const rounds = [...new Set(ms.map((m) => m.round))].sort((a, b) => a - b);
    return html`<div className="flex gap-6 items-stretch">
      ${rounds.map((r) => html`<div key=${r} className="flex flex-col w-56 shrink-0">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">${title(r)}</div>
        <div className="flex-1 flex flex-col justify-around gap-3">
          ${ms.filter((m) => m.round === r).sort((x, y) => x.order - y.order).map((m) => html`<${MatchCard} key=${m.id} m=${m} ctx=${ctx} onOpen=${onOpen} />`)}
        </div>
      </div>`)}
    </div>`;
  }

  const H = ({ children, sub }) => html`<div className="flex items-baseline gap-3 mt-8 mb-3"><h2 className="text-xl font-black tracking-wide">${children}</h2>${sub ? html`<span className="text-sm text-slate-500">${sub}</span>` : null}</div>`;

  function GroupsStage({ stage, ctx, onOpen }) {
    const st = ctx.standings[stage.id];
    return html`<div>
      <${H} sub=${`top ${stage.advance} advance`}>${stage.name}</${H}>
      <div className="grid grid-cols-4 gap-4">
        ${Object.keys(st).map((g) => {
          const grp = st[g];
          return html`<div key=${g} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center justify-between mb-2"><div className="text-2xl font-black">Group ${g}</div><span className=${`text-[11px] font-bold rounded px-1.5 ${grp.complete ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>${grp.complete ? 'COMPLETE' : `${grp.matches.filter((m) => m.result).length}/${grp.matches.length}`}</span></div>
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500"><th className="text-left w-5">#</th><th className="text-left">Player</th><th>P</th><th>W-L</th><th>G</th><th>Pts</th></tr></thead>
              <tbody>${grp.rows.map((r) => html`<tr key=${r.player.id} className=${`border-t border-slate-800 ${r.place <= stage.advance ? '' : 'text-slate-500'}`}>
                <td className=${`font-black ${r.place <= stage.advance ? 'text-cyan-300' : ''}`}>${r.place}</td>
                <td className="py-1"><div className="font-semibold truncate max-w-[130px]">${fmt.name(r.player)}</div><div className="text-[10px] text-slate-500">${r.player.club}${r.place <= stage.advance ? ` · → ${r.place}${g}` : ''}</div></td>
                <td className="text-center vb-num">${r.played}</td><td className="text-center vb-num">${r.won}-${r.lost}</td><td className="text-center vb-num">${r.gf}:${r.ga}</td><td className="text-center font-bold vb-num">${r.pts}</td>
              </tr>`)}</tbody>
            </table>
            <div className="grid grid-cols-2 gap-1.5 mt-3">${grp.matches.map((m) => html`<${MatchCard} key=${m.id} m=${m} ctx=${ctx} onOpen=${onOpen} />`)}</div>
          </div>`;
        })}
      </div>
    </div>`;
  }

  function SingleElim({ stage, ctx, onOpen }) {
    const ms = ctx.matches.filter((m) => m.stage === stage.id);
    const main = ms.filter((m) => m.section === 'main'), third = ms.filter((m) => m.section === 'third');
    const titles = { 1: 'Quarter-finals', 2: 'Semi-finals', 3: 'Final' };
    return html`<div>
      <${H} sub="slots fed from groups show their origin (1A, 2B …); ? = provisional">${stage.name}</${H}>
      <div className="flex gap-6 items-stretch">
        <${Columns} ms=${main} ctx=${ctx} onOpen=${onOpen} title=${(r) => titles[r] || `Round ${r}`} />
        ${third.length ? html`<div className="w-56 flex flex-col justify-end"><div className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">3rd place</div>${third.map((m) => html`<${MatchCard} key=${m.id} m=${m} ctx=${ctx} onOpen=${onOpen} />`)}</div>` : null}
      </div>
    </div>`;
  }

  function DoubleElim({ stage, ctx, onOpen }) {
    const ms = ctx.matches.filter((m) => m.stage === stage.id);
    const sec = (s) => ms.filter((m) => m.section === s);
    return html`<div>
      <${H} sub="lose twice and you're out">Winners bracket</${H}>
      <${Columns} ms=${sec('winners')} ctx=${ctx} onOpen=${onOpen} title=${(r) => `WB round ${r}`} />
      <div className="flex gap-10 items-start">
        <div>
          <${H}>Losers bracket</${H}>
          <${Columns} ms=${sec('losers')} ctx=${ctx} onOpen=${onOpen} title=${(r) => `LB round ${r}`} />
        </div>
        <div>
          <${H}>2nd final</${H}>
          <div className="w-56 mt-6">${sec('second-final').map((m) => html`<${MatchCard} key=${m.id} m=${m} ctx=${ctx} onOpen=${onOpen} />`)}</div>
        </div>
      </div>
      <${H} sub="optional — switch on to play out places">Place play-offs</${H}>
      <div className="flex flex-wrap gap-4">
        ${(stage.playoffs || []).map((po) => {
          const pm = ms.filter((m) => m.section === 'playoff' && m.playoff === po);
          const on = pm.length ? pm[0].playoffEnabled : false;
          return html`<div key=${po} className=${`rounded-xl border p-3 ${on ? 'border-slate-700 bg-slate-900/60' : 'border-dashed border-slate-800'}`}>
            <div className="flex items-center justify-between gap-6 mb-2"><div className="text-lg font-black">Places ${po}</div><${Toggle} on=${on} onClick=${() => ctx.actions.togglePlayoff(pm[0].comp, po)} label=${on ? 'On' : 'Off'} /></div>
            <${Columns} ms=${pm} ctx=${ctx} onOpen=${onOpen} title=${(r) => (pm.filter((m) => m.round === r).length > 1 && r === 1 ? 'Semis' : r === 1 ? 'Match' : 'Placings')} />
          </div>`;
        })}
      </div>
    </div>`;
  }

  function DrawsView({ ctx, onOpen }) {
    const [compId, setCompId] = useState(ctx.competitions[0].id);
    const comp = ctx.competitions.find((c) => c.id === compId);
    const b = ctx.stats.byCompetition.find((x) => x.competition.id === compId);
    return html`<div className="flex-1 min-h-0 overflow-auto vb-scroll px-6 pt-5 pb-24">
      <div className="flex items-center gap-2">
        ${ctx.competitions.map((c) => html`<button key=${c.id} onClick=${() => setCompId(c.id)} className=${`px-4 h-11 rounded-xl font-bold border-2 ${c.id === compId ? 'text-white' : 'border-slate-800 text-slate-400 hover:text-white'}`} style=${c.id === compId ? { borderColor: c.color, background: c.color + '33' } : {}}>${c.name}</button>`)}
        <span className="ml-4 text-slate-400 text-sm">${b.finished}/${b.total} matches done · avg ${Math.round(b.avgMin)}′</span>
      </div>
      ${comp.stages.map((s) => s.type === 'groups' ? html`<${GroupsStage} key=${s.id} stage=${s} ctx=${ctx} onOpen=${onOpen} />`
        : s.type === 'single_elim' ? html`<${SingleElim} key=${s.id} stage=${s} ctx=${ctx} onOpen=${onOpen} />`
        : html`<${DoubleElim} key=${s.id} stage=${s} ctx=${ctx} onOpen=${onOpen} />`)}
    </div>`;
  }

  // ---------- root ----------
  function VariantB() {
    const ctx = useTournament();
    const { tables, queue, matchById, actions } = ctx;
    const [tab, setTab] = useState('floor');
    const [selMatch, setSelMatch] = useState(null);
    const [selTable, setSelTable] = useState(null);
    const [modal, setModal] = useState(null);
    const [cmdOpen, setCmdOpen] = useState(false);
    const [logOpen, setLogOpen] = useState(false);
    const [toast, setToast] = useState(null);
    const [drag, setDrag] = useState({ id: null, over: null });
    const digitBuf = useRef('');
    const digitTimer = useRef(null);
    const toastTimer = useRef(null);

    const lastFinish = useMemo(() => {
      const o = {};
      ctx.matches.forEach((m) => { if (m.finishedAt && !m.walkover) [m.a.player, m.b.player].forEach((p) => { if (p) o[p.id] = Math.max(o[p.id] || 0, m.finishedAt); }); });
      return o;
    }, [ctx.matches]);

    // Drop stale selections when tables/matches change state.
    const selTableObj = selTable && tables.find((t) => t.id === selTable);
    if (selTable && (!selTableObj || selTableObj.status !== 'free')) setTimeout(() => setSelTable(null));
    if (selMatch && matchById[selMatch] && !['ready', 'busy'].includes(matchById[selMatch].status)) setTimeout(() => setSelMatch(null));

    const say = (text, kind = 'ok') => {
      setToast({ text, kind });
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    };
    const tableByNum = (n) => tables.find((t) => t.number === +n);

    const assign = (matchId, tableId, force) => {
      const m = matchById[matchId], t = tables.find((x) => x.id === tableId);
      if (!m || !t) { say('Unknown match or table', 'err'); return false; }
      if (t.status !== 'free') { say(`Table ${t.number} is not free`, 'err'); return false; }
      if (m.status === 'busy' && !force) { say(`${m.competition.short} ${m.label}: a player is still on another table`, 'err'); return false; }
      if (m.status !== 'ready' && m.status !== 'busy') { say(`${m.competition.short} ${m.label} is not ready`, 'err'); return false; }
      actions.assign(matchId, tableId);
      setSelMatch(null); setSelTable(null);
      say(`${m.competition.short} ${m.label} → table ${t.number}  ·  clock started`);
      return true;
    };
    const openMatch = (id, initial = '') => setModal({ matchId: id, initial });
    const openTable = (num, initial = '') => {
      const t = tableByNum(num);
      if (!t) { say(`No table ${num}`, 'err'); return; }
      setTab('floor');
      if (t.match) openMatch(t.match.id, initial);
      else if (t.status === 'free') { if (selMatch) assign(selMatch, t.id); else setSelTable(t.id); }
      else say(`Table ${t.number} is inactive`, 'err');
    };
    const clickFreeTable = (tableId) => {
      if (selMatch) assign(selMatch, tableId);
      else setSelTable((s) => (s === tableId ? null : tableId));
    };
    const clickQueue = (id) => {
      const m = matchById[id];
      if (selTable && m.status === 'ready') { assign(id, selTable); return; }
      if (m.status === 'busy') { openMatch(id); return; }
      setSelMatch((s) => (s === id ? null : id));
    };

    const ui = { selTable, selMatch, drag, setDrag, assign, openMatch, clickFreeTable, clickQueue, say };
    const api = { assign, openTable, openMatch, say, setTab, toggleLog: () => setLogOpen((o) => !o) };

    useEffect(() => {
      const flush = (extra) => {
        const b = digitBuf.current;
        digitBuf.current = '';
        clearTimeout(digitTimer.current);
        if (b) openTable(b, extra || '');
      };
      const onKey = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setModal(null); setCmdOpen((o) => !o); return; }
        const tg = e.target;
        if (tg.closest && tg.closest('input, textarea, select, [contenteditable]')) return;
        if (modal || cmdOpen) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (/^\d$/.test(e.key)) {
          e.preventDefault();
          if (digitBuf.current) {
            const cand = digitBuf.current + e.key;
            if (tableByNum(cand)) { digitBuf.current = ''; clearTimeout(digitTimer.current); openTable(cand); } else flush(e.key);
            return;
          }
          const prefix = tables.some((t) => String(t.number).length > 1 && String(t.number).startsWith(e.key));
          if (prefix && e.key !== '0') { digitBuf.current = e.key; digitTimer.current = setTimeout(() => flush(), 500); } else openTable(e.key);
          return;
        }
        if (digitBuf.current) flush(e.key.length === 1 ? e.key : '');
        const list = queue;
        if (e.key === '/') { e.preventDefault(); setCmdOpen(true); }
        else if (e.key === 'Escape') { setSelMatch(null); setSelTable(null); setLogOpen(false); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (!list.length) return;
          const i = list.findIndex((m) => m.id === selMatch);
          const n = i < 0 ? 0 : Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
          setSelMatch(list[n].id); setTab('floor');
        } else if (e.key === 'Enter') {
          if (selTable) { const id = selMatch || (list.find((m) => m.status === 'ready') || {}).id; if (id) assign(id, selTable); }
          else if (selMatch) openMatch(selMatch);
        } else if (e.key.toLowerCase() === 'd') setTab((t) => (t === 'draws' ? 'floor' : 'draws'));
        else if (e.key.toLowerCase() === 'f') setTab('floor');
        else if (e.key.toLowerCase() === 'l') setLogOpen((o) => !o);
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    });

    return html`<div className="h-full flex flex-col bg-[#05080f] text-slate-100 overflow-hidden" style=${{ fontFamily: 'Inter, ui-sans-serif, system-ui, Segoe UI, sans-serif' }}>
      <style>${CSS}</style>
      <${StatusStrip} ctx=${ctx} tab=${tab} setTab=${setTab} openCmd=${() => setCmdOpen(true)} toggleLog=${() => setLogOpen((o) => !o)} />
      ${tab === 'floor'
        ? html`<div className="flex-1 min-h-0 flex">
            <div className="flex-1 min-w-0 p-4 pb-16 flex flex-col"
              style=${{ backgroundImage: 'radial-gradient(rgba(148,163,184,.07) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
              <div className="flex items-baseline justify-between mb-3 text-[11px] uppercase tracking-[.25em] text-slate-500">
                <span>Venue floor · ${tables.length} tables</span>
                <span className="normal-case tracking-normal">type a <kbd className="bg-slate-800 rounded px-1">table no.</kbd> to score / pick · <kbd className="bg-slate-800 rounded px-1">↑↓</kbd> select match · <kbd className="bg-slate-800 rounded px-1">Ctrl K</kbd> command</span>
              </div>
              <div className="flex-1 min-h-0 grid grid-cols-5 grid-rows-2 gap-4">
                ${tables.map((t) => html`<${TableTile} key=${t.id} t=${t} ctx=${ctx} ui=${ui} />`)}
              </div>
            </div>
            <${QueueColumn} ctx=${ctx} ui=${ui} lastFinish=${lastFinish} />
          </div>`
        : html`<${DrawsView} ctx=${ctx} onOpen=${(id) => openMatch(id)} />`}
      ${modal ? html`<${MatchModal} key=${modal.matchId} ctx=${ctx} matchId=${modal.matchId} initial=${modal.initial} ui=${ui} onClose=${() => setModal(null)} />` : null}
      ${cmdOpen ? html`<${CommandBar} ctx=${ctx} api=${api} onClose=${() => setCmdOpen(false)} />` : null}
      ${logOpen ? html`<${LogPanel} ctx=${ctx} onClose=${() => setLogOpen(false)} />` : null}
      ${toast ? html`<div className=${`fixed right-6 bottom-20 z-[60] px-5 py-3 rounded-xl text-lg font-semibold shadow-2xl ${toast.kind === 'err' ? 'bg-amber-500 text-black' : 'bg-emerald-500 text-black'}`}>${toast.text}</div>` : null}
    </div>`;
  }

  window.Variants.push({ key: 'B', name: 'Control room', Component: VariantB });
})();
