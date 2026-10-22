// PROTOTYPE — Variant C: "Flow board + timeline". Lifecycle Kanban on top, table Gantt below, draws drawer on the right.
(function () {
  const { html, useTournament, fmt } = window.Proto;
  const { useState, useEffect, useRef, useMemo } = React;
  const MIN = 60000;

  // ---------- helpers ----------
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const hhmm = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const hhmmss = (t) => new Date(t).toLocaleTimeString('en-GB');
  const HATCH_AMBER = 'repeating-linear-gradient(45deg,#f59e0b 0 4px,#fde68a 4px 8px)';
  const HATCH_RED = 'repeating-linear-gradient(45deg,#dc2626 0 4px,#fecaca 4px 8px)';
  const HATCH_IDLE = 'repeating-linear-gradient(-45deg,#fed7aa 0 6px,#fff7ed 6px 12px)';

  const stageTitle = (m) => {
    if (m.section === 'group') return `Grp ${m.group} · R${m.round}`;
    if (m.stage === 'open-ko') return m.section === 'third' ? 'Bronze' : ['QF', 'SF', 'Final'][m.round - 1] || `R${m.round}`;
    if (m.section === 'winners') return `WB R${m.round}`;
    if (m.section === 'losers') return `LB R${m.round}`;
    if (m.section === 'second-final') return '2nd final';
    if (m.section === 'playoff') return `PO ${m.playoff}`;
    return m.section || '';
  };

  // Resolve group-fed placeholders for DISPLAY only (store keeps them unresolved).
  function useSlot() {
    const T = useTournament();
    return (m, side) => {
      const s = m[side];
      if (s.player) {
        const origin = s.origin ? `${s.origin.place}${s.origin.group}` : null;
        return { name: fmt.name(s.player), tag: origin, known: true, player: s.player };
      }
      if (s.origin) {
        const gStage = m.competition.stages.find((st) => st.type === 'groups');
        const g = gStage && T.standings[gStage.id] && T.standings[gStage.id][s.origin.group];
        if (g && g.complete) {
          const p = g.rows[s.origin.place - 1].player;
          return { name: fmt.name(p), tag: s.label, known: true, projected: true, player: p };
        }
        return { name: null, tag: s.label, known: false };
      }
      return { name: null, tag: s.label, known: false };
    };
  }

  function SlotText({ m, side, className = '' }) {
    const slot = useSlot()(m, side);
    const win = m.result && m.result.winSide === (side === 'a' ? 'A' : 'B');
    if (!slot.known) return html`<span className=${'italic text-slate-400 ' + className}>${slot.tag || 'TBD'}</span>`;
    return html`<span className=${className + (win ? ' font-semibold' : '')}>
      ${slot.name}${slot.tag && html`<span className="text-slate-400 font-normal"> · ${slot.tag}</span>`}
      ${slot.projected && html`<span title="Group complete — projected, store has not advanced it" className="text-indigo-400"> *</span>`}
    </span>`;
  }

  function CompDot({ comp }) {
    return html`<span className="inline-block w-2 h-2 rounded-full shrink-0" style=${{ background: comp.color }}></span>`;
  }

  function StatusPill({ m }) {
    const map = {
      pending: ['bg-slate-100 text-slate-500', 'pending'],
      ready: ['bg-emerald-100 text-emerald-700', 'ready'],
      busy: ['bg-emerald-50 text-emerald-600/70', '⏸ busy'],
      in_progress: ['bg-sky-100 text-sky-700', `${m.table ? m.table.replace('T', 'T') : ''} ${fmt.clock(m.elapsedMin)}`],
      overdue: [m.overdue === 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800', `${m.table || ''} ${fmt.clock(m.elapsedMin)}`],
      finished: ['bg-slate-100 text-slate-600', fmt.games(m)],
      walkover: ['bg-slate-200 text-slate-600', 'W.O.'],
      disabled: ['bg-transparent text-slate-300 border border-dashed border-slate-200', 'off'],
    };
    const [cls, txt] = map[m.status] || ['', m.status];
    return html`<span className=${'px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums whitespace-nowrap ' + cls}>${txt}</span>`;
  }

  // ---------- score entry ----------
  function ScoreEntry({ m, initial = '', onClose, correction }) {
    const T = useTournament();
    const [text, setText] = useState(initial);
    const ref = useRef(null);
    useEffect(() => { ref.current && ref.current.focus(); ref.current && ref.current.select(); }, []);
    const parsed = text.trim() ? T.parseScore(text, m.gamesToWin) : null;
    const preview = parsed && parsed.games ? (() => {
      const [wa, wb] = parsed.games.reduce((acc, [x, y]) => (x > y ? [acc[0] + 1, acc[1]] : [acc[0], acc[1] + 1]), [0, 0]);
      const winner = wa > wb ? m.a.player : m.b.player;
      return `${wa}:${wb} → ${fmt.name(winner)} wins`;
    })() : null;
    const submit = () => { if (parsed && parsed.games) { T.actions.enterScore(m.id, parsed.games); onClose(); } };
    const onKey = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') onClose();
    };
    return html`<div className="mt-2 pt-2 border-t border-slate-200" onClick=${(e) => e.stopPropagation()}>
      <div className="flex gap-1.5">
        <input ref=${ref} value=${text} onInput=${(e) => setText(e.target.value)} onKeyDown=${onKey}
          placeholder="11-7 9-11 11-5 11-8"
          className=${'flex-1 min-w-0 font-mono text-sm px-2 py-1 rounded border outline-none focus:ring-2 ' +
            (parsed && parsed.error ? 'border-red-300 focus:ring-red-200' : parsed && parsed.games ? 'border-emerald-400 focus:ring-emerald-200' : 'border-slate-300 focus:ring-indigo-200')} />
        <button onClick=${submit} disabled=${!(parsed && parsed.games)}
          className="px-2 py-1 text-xs rounded bg-indigo-600 text-white disabled:bg-slate-200 disabled:text-slate-400">${correction ? 'Save' : 'Enter ↵'}</button>
      </div>
      <div className=${'text-[11px] mt-1 ' + (parsed && parsed.error ? 'text-red-600' : 'text-emerald-700')}>
        ${parsed ? (parsed.error || preview) : html`<span className="text-slate-400">Best of ${m.gamesToWin * 2 - 1}. Enter to save, Esc to close.</span>`}
      </div>
      <div className="flex flex-wrap gap-1 mt-1.5 text-[11px]">
        <span className="text-slate-400 mr-0.5 self-center">Walkover:</span>
        <button className="px-1.5 py-0.5 rounded border border-slate-300 hover:bg-slate-100" onClick=${() => { T.actions.walkover(m.id, 'A'); onClose(); }}>${fmt.name(m.a.player)} wins</button>
        <button className="px-1.5 py-0.5 rounded border border-slate-300 hover:bg-slate-100" onClick=${() => { T.actions.walkover(m.id, 'B'); onClose(); }}>${fmt.name(m.b.player)} wins</button>
        ${!correction && html`<button className="ml-auto px-1.5 py-0.5 rounded text-slate-500 hover:bg-slate-100" onClick=${() => { T.actions.unassign(m.id); onClose(); }}>↩ off table</button>`}
      </div>
      ${correction && html`<div className="text-[10px] text-amber-700 mt-1">Correction re-stamps finish time; later rounds already started are not rolled back.</div>`}
    </div>`;
  }

  // ---------- table picker ----------
  function TablePicker({ m, onClose }) {
    const T = useTournament();
    const ref = useRef(null);
    const free = T.tables.filter((t) => t.status === 'free')
      .sort((x, y) => (y.idleMin == null ? 1e9 : y.idleMin) - (x.idleMin == null ? 1e9 : x.idleMin));
    useEffect(() => { ref.current && ref.current.focus(); }, []);
    const pick = (t) => { T.actions.assign(m.id, t.id); onClose(); };
    const onKey = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && free[0]) pick(free[0]);
      if (/^[0-9]$/.test(e.key)) { const n = e.key === '0' ? 10 : +e.key; const t = free.find((f) => f.number === n); t && pick(t); }
    };
    return html`<div ref=${ref} tabIndex="0" onKeyDown=${onKey} onClick=${(e) => e.stopPropagation()} className="mt-2 pt-2 border-t border-slate-200 outline-none">
      ${free.length === 0 ? html`<div className="text-[11px] text-slate-500">No free table right now.</div>` : html`
        <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Free tables · longest idle first · Enter = first, digit = table</div>
        <div className="flex flex-wrap gap-1">
          ${free.map((t, i) => html`<button key=${t.id} onClick=${() => pick(t)}
            className=${'px-2 py-1 rounded text-xs border ' + (i === 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-300 hover:border-indigo-400')}>
            <b>T${t.number}</b>${t.name && html`<span className="opacity-70"> ${t.name}</span>`}
            <span className="opacity-70"> · ${t.idleMin == null ? 'unused' : `idle ${Math.round(t.idleMin)}m`}</span>
          </button>`)}
        </div>`}
    </div>`;
  }

  // ---------- board cards ----------
  function CardShell({ m, selected, onSelect, className = '', children, style }) {
    return html`<div data-card=${m.id} onClick=${() => onSelect(m.id)} style=${{ borderLeftColor: m.competition.color, ...style }}
      className=${'rounded-md border border-l-4 bg-white px-2 py-1.5 text-xs cursor-pointer shadow-sm transition ' +
        (selected ? 'ring-2 ring-indigo-500 ring-offset-1 ' : '') + className}>${children}</div>`;
  }

  function CardHead({ m, right }) {
    return html`<div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-0.5">
      <span className="font-semibold text-slate-600">${m.competition.short}</span>
      <span>${stageTitle(m)}</span><span className="text-slate-400">${m.label}</span>
      <span className="ml-auto">${right}</span>
    </div>`;
  }

  function ReadyCard({ m, ui }) {
    const T = useTournament();
    const busy = m.status === 'busy';
    const open = ui.edit === m.id;
    const where = busy ? [m.a.player, m.b.player].map((p) => {
      const other = T.matches.find((x) => x.state === 'in_progress' && x.id !== m.id && ((x.a.player && x.a.player.id === p.id) || (x.b.player && x.b.player.id === p.id)));
      return other ? `${fmt.name(p)} on T${other.table.replace('T', '')} (${other.competition.short} ${other.label})` : null;
    }).filter(Boolean) : [];
    const waited = m.readySince ? (T.now - m.readySince) / MIN : null;
    return html`<${CardShell} m=${m} selected=${ui.selected === m.id} onSelect=${ui.select}
      className=${busy ? 'opacity-60 bg-emerald-50/30' : 'bg-emerald-50/60 border-emerald-200'}>
      <${CardHead} m=${m} right=${busy ? html`<span className="text-amber-700">⏸ busy</span>` : waited != null && html`<span className=${waited > 10 ? 'text-amber-700' : ''}>waiting ${Math.round(waited)}m</span>`} />
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 leading-tight">
          <div className="truncate"><${SlotText} m=${m} side="a" /></div>
          <div className="truncate"><${SlotText} m=${m} side="b" /></div>
        </div>
        ${!busy && html`<button onClick=${(e) => { e.stopPropagation(); ui.setEdit(open ? null : m.id); }}
          className=${'shrink-0 px-2 py-1 rounded text-[11px] font-medium ' + (open ? 'bg-slate-200' : 'bg-emerald-600 text-white hover:bg-emerald-700')}>${open ? 'Cancel' : 'Call →'}</button>`}
      </div>
      ${busy && where.map((w) => html`<div key=${w} className="text-[10px] text-amber-700 mt-0.5">↳ ${w}</div>`)}
      ${open && html`<${TablePicker} m=${m} onClose=${() => ui.setEdit(null)} />`}
    <//>`;
  }

  function OnTableCard({ m, ui }) {
    const open = ui.edit === m.id;
    const pct = Math.min(1.6, m.elapsedMin / m.expectedMin);
    const tone = m.overdue === 2 ? 'border-red-300 bg-red-50' : m.overdue === 1 ? 'border-amber-300 bg-amber-50' : 'border-sky-200';
    const barColor = m.overdue === 2 ? '#dc2626' : m.overdue === 1 ? '#f59e0b' : '#0ea5e9';
    return html`<${CardShell} m=${m} selected=${ui.selected === m.id} onSelect=${(id) => { ui.select(id); ui.setEdit(open ? null : id); }} className=${tone}>
      <div className="flex items-start gap-2">
        <div className=${'shrink-0 w-9 h-9 rounded flex flex-col items-center justify-center text-white ' + (m.overdue === 2 ? 'bg-red-600' : m.overdue === 1 ? 'bg-amber-500' : 'bg-slate-700')}>
          <span className="text-[8px] leading-none opacity-80">TABLE</span><span className="text-sm font-bold leading-none">${m.table.replace('T', '')}</span>
        </div>
        <div className="flex-1 min-w-0">
          <${CardHead} m=${m} right=${html`<span className=${'font-mono text-[11px] font-semibold ' + (m.overdue === 2 ? 'text-red-700' : m.overdue ? 'text-amber-700' : 'text-slate-700')}>${fmt.clock(m.elapsedMin)}</span>`} />
          <div className="leading-tight">
            <div className="truncate"><${SlotText} m=${m} side="a" /></div>
            <div className="truncate"><${SlotText} m=${m} side="b" /></div>
          </div>
          <div className="relative h-1 mt-1 rounded bg-slate-200 overflow-hidden">
            <div className="absolute inset-y-0 left-0" style=${{ width: `${(pct / 1.6) * 100}%`, background: barColor }}></div>
            <div className="absolute inset-y-0 w-px bg-slate-500" style=${{ left: `${100 / 1.6}%` }}></div>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex">
            <span>started ${hhmm(m.startedAt)} · exp. ${m.expectedMin}m</span>
            ${m.overdue ? html`<span className=${'ml-auto font-medium ' + (m.overdue === 2 ? 'text-red-700' : 'text-amber-700')}>${m.overdue === 2 ? '⚠ check table — ' : 'overdue '}${Math.round((m.elapsedMin / m.expectedMin) * 100)}%</span>` : html`<span className="ml-auto text-slate-400">click to enter score</span>`}
          </div>
        </div>
      </div>
      ${open && html`<${ScoreEntry} m=${m} onClose=${() => ui.setEdit(null)} />`}
    <//>`;
  }

  function DoneCard({ m, ui }) {
    const T = useTournament();
    const open = ui.edit === m.id;
    return html`<${CardShell} m=${m} selected=${ui.selected === m.id} onSelect=${ui.select} className="bg-slate-50 text-slate-500 border-slate-200">
      <${CardHead} m=${m} right=${html`<span>${hhmm(m.finishedAt)}${m.table ? ` · ${m.table}` : ''}</span>`} />
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 leading-tight">
          <div className="truncate"><${SlotText} m=${m} side="a" /></div>
          <div className="truncate"><${SlotText} m=${m} side="b" /></div>
        </div>
        <div className="text-right shrink-0">
          ${m.status === 'walkover'
            ? html`<span className="px-1.5 py-0.5 rounded bg-slate-300 text-slate-700 text-[10px] font-bold">W.O.</span>`
            : html`<div className="font-mono font-semibold text-slate-700">${fmt.games(m)}</div><div className="font-mono text-[9px] text-slate-400">${fmt.gameList(m)}</div>`}
        </div>
      </div>
      <div className="flex text-[10px] mt-0.5">
        <span>${m.status !== 'walkover' && m.durationMin != null ? `${Math.round(m.durationMin)} min` : ''}</span>
        <button className="ml-auto text-indigo-600 hover:underline" onClick=${(e) => { e.stopPropagation(); ui.setEdit(open ? null : m.id); }}>${open ? 'close' : '✎ correct score'}</button>
      </div>
      ${open && html`<${ScoreEntry} m=${m} initial=${fmt.gameList(m)} correction=${true} onClose=${() => ui.setEdit(null)} />`}
    <//>`;
  }

  // ---------- flow board ----------
  function FlowBoard({ ui, swim }) {
    const T = useTournament();
    const onTable = T.matches.filter((m) => m.state === 'in_progress')
      .sort((x, y) => (y.overdue - x.overdue) || (y.elapsedMin / y.expectedMin - x.elapsedMin / x.expectedMin));
    const finished = T.matches.filter((m) => m.state === 'finished').sort((x, y) => y.finishedAt - x.finishedAt).slice(0, 10);
    const lanes = swim ? T.competitions : [null];
    const inLane = (arr, c) => (c ? arr.filter((m) => m.comp === c.id) : arr);
    const free = T.tables.filter((t) => t.status === 'free').length;
    const cols = [
      { key: 'ready', title: 'Ready to call', count: T.queue.filter((m) => m.status === 'ready').length, sub: `${T.queue.filter((m) => m.status === 'busy').length} busy · ${free} free tables`, items: T.queue, Card: ReadyCard },
      { key: 'on', title: 'On table', count: onTable.length, sub: `${onTable.filter((m) => m.overdue).length} overdue`, items: onTable, Card: OnTableCard },
      { key: 'done', title: 'Just finished', count: finished.length, sub: 'last 10', items: finished, Card: DoneCard },
    ];
    const grid = 'grid grid-cols-[1.25fr_1.25fr_1fr] gap-3';
    return html`<div className="flex flex-col h-full min-h-0">
      <div className=${grid + (swim ? ' pl-6' : '')}>
        ${cols.map((c, i) => html`<div key=${c.key} className="flex items-baseline gap-2 px-1 pb-1.5">
          <span className="text-[10px] text-slate-400">${i + 1}</span>
          <span className="text-sm font-semibold text-slate-700">${c.title}</span>
          <span className="text-xs px-1.5 rounded-full bg-slate-200 text-slate-700 tabular-nums">${c.count}</span>
          <span className="text-[11px] text-slate-400 ml-auto">${c.sub}</span>
          ${i < 2 && html`<span className="text-slate-300 -mr-2">→</span>`}
        </div>`)}
      </div>
      <div className="flex-1 min-h-0 flex flex-col gap-2">
        ${lanes.map((lane) => html`<div key=${lane ? lane.id : 'all'} className="flex-1 min-h-0 flex gap-1">
          ${lane && html`<div className="w-5 shrink-0 rounded flex items-center justify-center" style=${{ background: rgba(lane.color, 0.12) }}>
            <span className="text-[10px] font-semibold whitespace-nowrap" style=${{ color: lane.color, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>${lane.name}</span>
          </div>`}
          <div className=${grid + ' flex-1 min-h-0'}>
            ${cols.map((c) => {
              const items = inLane(c.items, lane);
              const firstBusy = items.findIndex((m) => m.status === 'busy');
              return html`<div key=${c.key} className="min-h-0 overflow-y-auto rounded-lg bg-slate-100/70 p-1.5 space-y-1.5">
                ${items.length === 0 && html`<div className="text-[11px] text-slate-400 text-center py-4">—</div>`}
                ${items.map((m, i) => html`<${React.Fragment} key=${m.id}>
                  ${c.key === 'ready' && i === firstBusy && html`<div className="text-[10px] uppercase tracking-wide text-slate-400 pt-1">Busy — player on another table</div>`}
                  <${c.Card} m=${m} ui=${ui} />
                <//>`)}
              </div>`;
            })}
          </div>
        </div>`)}
      </div>
    </div>`;
  }

  // ---------- timeline ----------
  function Timeline({ ui }) {
    const T = useTournament();
    const [hover, setHover] = useState(null);
    const start = T.now - 150 * MIN, end = T.now + 30 * MIN, span = end - start;
    const x = (t) => `${((Math.max(start, Math.min(end, t)) - start) / span) * 100}%`;
    const w = (a, b) => `${((Math.max(start, Math.min(end, b)) - Math.max(start, Math.min(end, a))) / span) * 100}%`;
    const ticks = [];
    for (let t = Math.ceil(start / (15 * MIN)) * 15 * MIN; t <= end; t += 15 * MIN) ticks.push(t);
    const byTable = useMemo(() => {
      const o = {};
      T.matches.forEach((m) => { if (m.table && m.startedAt && (m.state === 'in_progress' || m.state === 'finished')) (o[m.table] = o[m.table] || []).push(m); });
      return o;
    }, [T.matches]);

    const bar = (m) => {
      const c = m.competition.color;
      const sel = ui.selected === m.id;
      const common = {
        onMouseEnter: (e) => setHover({ m, x: e.clientX, y: e.clientY }),
        onMouseMove: (e) => setHover({ m, x: e.clientX, y: e.clientY }),
        onMouseLeave: () => setHover(null),
        onClick: () => ui.select(m.id),
      };
      if (m.state === 'finished') {
        if (m.finishedAt < start) return null;
        return html`<div key=${m.id} ...${common} className=${'absolute top-1 bottom-1 rounded-sm overflow-hidden cursor-pointer text-[9px] px-1 leading-[18px] whitespace-nowrap ' + (sel ? 'ring-2 ring-indigo-500 z-10' : '')}
          style=${{ left: x(m.startedAt), width: w(m.startedAt, m.finishedAt), background: rgba(c, 0.22), borderLeft: `2px solid ${rgba(c, 0.6)}`, color: '#475569' }}>
          ${m.walkover ? 'W.O. ' : ''}${m.label} ${fmt.games(m)}</div>`;
      }
      const exp = m.startedAt + m.expectedMin * MIN, red = m.startedAt + m.expectedMin * 1.5 * MIN;
      return html`<${React.Fragment} key=${m.id}>
        ${T.now < exp && html`<div className="absolute top-1 bottom-1 rounded-r-sm border border-dashed pointer-events-none" style=${{ left: x(T.now), width: w(T.now, exp), borderColor: rgba(c, 0.6), background: rgba(c, 0.05) }}></div>`}
        <div ...${common} className=${'absolute top-1 bottom-1 rounded-sm overflow-hidden cursor-pointer flex ' + (sel ? 'ring-2 ring-indigo-500 z-10' : '')}
          style=${{ left: x(m.startedAt), width: w(m.startedAt, T.now) }}>
          <div className="h-full text-[9px] text-white font-medium px-1 leading-[18px] whitespace-nowrap overflow-hidden" style=${{ background: c, width: `${((Math.min(T.now, exp) - m.startedAt) / (T.now - m.startedAt)) * 100}%` }}>
            ${m.label} · ${fmt.clock(m.elapsedMin)}
          </div>
          ${T.now > exp && html`<div className="h-full" style=${{ background: HATCH_AMBER, width: `${((Math.min(T.now, red) - exp) / (T.now - m.startedAt)) * 100}%` }}></div>`}
          ${T.now > red && html`<div className="h-full" style=${{ background: HATCH_RED, flex: 1 }}></div>`}
        </div>
      <//>`;
    };

    return html`<div className="h-full flex flex-col min-h-0 relative">
      <div className="flex items-center gap-3 pb-1">
        <span className="text-sm font-semibold text-slate-700">Table timeline</span>
        <span className="text-[11px] text-slate-400">last 2.5 h → now + 30 min</span>
        <span className="ml-auto flex items-center gap-3 text-[10px] text-slate-500">
          ${T.competitions.map((c) => html`<span key=${c.id} className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style=${{ background: c.color }}></span>${c.short}</span>`)}
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style=${{ background: HATCH_AMBER }}></span>over expected</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm" style=${{ background: HATCH_RED }}></span>>150%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm border border-orange-300" style=${{ background: HATCH_IDLE }}></span>idle now</span>
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-slate-200 bg-white">
        <div className="flex sticky top-0 bg-white z-20 border-b border-slate-200">
          <div className="w-32 shrink-0"></div>
          <div className="relative flex-1 h-5">
            ${ticks.map((t) => html`<span key=${t} className="absolute top-0.5 text-[9px] text-slate-400 -translate-x-1/2 tabular-nums" style=${{ left: x(t) }}>${hhmm(t)}</span>`)}
            <span className="absolute top-0 text-[9px] font-bold text-indigo-600 -translate-x-1/2 bg-white px-0.5" style=${{ left: x(T.now) }}>now</span>
          </div>
        </div>
        ${T.tables.map((t) => {
          const ms = byTable[t.id] || [];
          const lastEnd = Math.max(0, ...ms.filter((m) => m.finishedAt).map((m) => m.finishedAt));
          const idle = t.status === 'free';
          const inactive = t.status === 'inactive';
          return html`<div key=${t.id} className=${'flex border-b border-slate-100 group ' + (inactive ? 'bg-slate-100 opacity-60' : '')}>
            <div className="w-32 shrink-0 px-2 flex items-center gap-1.5 text-[11px] border-r border-slate-100">
              <span className=${'font-bold w-7 ' + (t.status === 'overdue' ? 'text-red-600' : idle ? 'text-orange-600' : 'text-slate-700')}>T${t.number}</span>
              <span className="truncate text-slate-400 flex-1">${inactive ? 'inactive' : t.name || (idle ? `idle ${Math.round(t.idleMin || 0)}m` : '')}</span>
              <button title=${inactive ? 'Activate table' : 'Deactivate table'} onClick=${() => T.actions.toggleTable(t.id)}
                className="opacity-0 group-hover:opacity-100 text-[9px] px-1 rounded border border-slate-300 text-slate-500 hover:bg-white">${inactive ? 'on' : 'off'}</button>
            </div>
            <div className="relative flex-1 h-6">
              ${ticks.map((tk) => html`<div key=${tk} className="absolute inset-y-0 w-px bg-slate-100" style=${{ left: x(tk) }}></div>`)}
              <div className="absolute inset-y-0 bg-slate-50" style=${{ left: x(T.now), right: 0 }}></div>
              ${idle && html`<div className="absolute top-0.5 bottom-0.5 rounded-sm border border-orange-300"
                style=${{ left: x(lastEnd || start), width: w(lastEnd || start, T.now), background: HATCH_IDLE }}></div>`}
              ${idle && html`<span className="absolute top-1 ml-1.5 z-10 text-[9px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-1 rounded whitespace-nowrap leading-[14px]"
                style=${{ left: x(T.now) }}>idle since ${lastEnd ? hhmm(lastEnd) : '—'} · ${Math.round(t.idleMin || 0)}m</span>`}
              ${ms.map(bar)}
              <div className="absolute inset-y-0 w-0.5 bg-indigo-500 z-10" style=${{ left: x(T.now) }}></div>
            </div>
          </div>`;
        })}
      </div>
      ${hover && html`<div className="fixed z-50 pointer-events-none bg-slate-900 text-white text-[11px] rounded-md shadow-lg px-2.5 py-2 w-64"
        style=${{ left: Math.min(hover.x + 12, window.innerWidth - 270), top: hover.y - 110 }}>
        <div className="flex items-center gap-1.5 font-semibold"><${CompDot} comp=${hover.m.competition} />${hover.m.competition.name} · ${stageTitle(hover.m)} · ${hover.m.label}</div>
        <div className="mt-1">${fmt.fullName(hover.m.a.player)} <span className="text-slate-400">vs</span> ${fmt.fullName(hover.m.b.player)}</div>
        <div className="mt-1 text-slate-300">
          ${hover.m.table} · ${hhmm(hover.m.startedAt)}–${hover.m.finishedAt ? hhmm(hover.m.finishedAt) : 'now'}
          · ${hover.m.state === 'finished' ? `${Math.round(hover.m.durationMin)} min` : `${fmt.clock(hover.m.elapsedMin)} / ${hover.m.expectedMin}m`}
        </div>
        ${hover.m.result && html`<div className="mt-1 font-mono">${fmt.games(hover.m)} ${fmt.gameList(hover.m)}</div>`}
      </div>`}
    </div>`;
  }

  // ---------- drawer (draws) ----------
  function DrawMatchRow({ m, ui }) {
    const sel = ui.selected === m.id;
    const side = (s) => html`<div className="flex items-center gap-1">
      <div className="flex-1 min-w-0 truncate"><${SlotText} m=${m} side=${s} /></div>
      ${m.result && !m.result.walkover && html`<span className="font-mono text-slate-500">${s === 'a' ? m.result.gamesA : m.result.gamesB}</span>`}
    </div>`;
    return html`<div data-draw=${m.id} onClick=${() => ui.select(m.id)}
      className=${'flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-[11px] leading-tight hover:bg-indigo-50 ' +
        (sel ? 'bg-indigo-100 ring-1 ring-indigo-400 ' : '') + (m.status === 'disabled' ? 'opacity-40 ' : '') +
        (m.status === 'finished' || m.status === 'walkover' ? 'text-slate-500 ' : '') +
        (m.status === 'ready' ? 'bg-emerald-50 ' : '')}>
      <span className="w-12 shrink-0 text-[10px] text-slate-400">${m.label}</span>
      <div className="flex-1 min-w-0">${side('a')}${side('b')}</div>
      <div className="shrink-0 flex flex-col items-end gap-0.5">
        <${StatusPill} m=${m} />
        ${m.places && (m.places.loser || m.places.winner) && html`<span className="text-[9px] text-slate-400">${m.places.winner ? `W→${m.places.winner} ` : ''}${m.places.loser ? `L→${m.places.loser}` : ''}</span>`}
      </div>
    </div>`;
  }

  function Section({ title, children, right, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    return html`<div className="mb-2">
      <div className="flex items-center gap-2 px-1 py-1 sticky top-0 bg-white z-10 border-b border-slate-100">
        <button onClick=${() => setOpen(!open)} className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1">
          <span className="text-slate-400 w-3">${open ? '▾' : '▸'}</span>${title}</button>
        <span className="ml-auto">${right}</span>
      </div>
      ${open && html`<div className="pt-1 space-y-0.5">${children}</div>`}
    </div>`;
  }

  function GroupTable({ g, data, ui, matches }) {
    return html`<div className="mb-2 rounded border border-slate-200">
      <div className="flex items-center px-2 py-0.5 bg-slate-50 text-[11px] font-semibold text-slate-600">Group ${g}
        <span className=${'ml-auto text-[10px] font-normal ' + (data.complete ? 'text-emerald-600' : 'text-slate-400')}>${data.complete ? '✓ complete' : `${data.matches.filter((m) => m.result).length}/${data.matches.length} played`}</span></div>
      <table className="w-full text-[11px] tabular-nums">
        <thead><tr className="text-[9px] text-slate-400"><th className="text-left pl-2 w-4">#</th><th className="text-left">Player</th><th>P</th><th>W</th><th>L</th><th>Games</th></tr></thead>
        <tbody>${data.rows.map((r) => html`<tr key=${r.player.id} className=${r.place <= 2 ? '' : 'text-slate-500'}>
          <td className="pl-2">${r.place}</td><td className="truncate max-w-[130px]">${fmt.name(r.player)}</td>
          <td className="text-center">${r.played}</td><td className="text-center">${r.won}</td><td className="text-center">${r.lost}</td><td className="text-center">${r.gf}:${r.ga}</td></tr>`)}</tbody>
      </table>
      <div className="border-t border-slate-100 py-0.5">${matches.map((m) => html`<${DrawMatchRow} key=${m.id} m=${m} ui=${ui} />`)}</div>
    </div>`;
  }

  function Drawer({ ui, compId, setCompId }) {
    const T = useTournament();
    const comp = T.competitions.find((c) => c.id === compId);
    const ms = T.matches.filter((m) => m.comp === compId);
    const roundsOf = (section, namer) => {
      const list = ms.filter((m) => m.section === section);
      const rs = [...new Set(list.map((m) => m.round))].sort((a, b) => a - b);
      return rs.map((r) => ({ title: namer(r), items: list.filter((m) => m.round === r).sort((a, b) => a.order - b.order) }));
    };
    const blocks = [];
    comp.stages.forEach((st) => {
      if (st.type === 'groups') {
        blocks.push(html`<${Section} key=${st.id} title=${`${st.name} (top ${st.advance} advance)`}>
          ${Object.keys(st.groups).map((g) => html`<${GroupTable} key=${g} g=${g} data=${T.standings[st.id][g]} ui=${ui}
            matches=${ms.filter((m) => m.stage === st.id && m.group === g).sort((a, b) => a.round - b.round || a.order - b.order)} />`)}
        <//>`);
      } else if (st.type === 'single_elim') {
        const names = { 1: 'Quarter-finals', 2: 'Semi-finals', 3: 'Final' };
        roundsOf('main', (r) => names[r] || `Round ${r}`).forEach((r) => blocks.push(html`<${Section} key=${st.id + r.title} title=${r.title}>${r.items.map((m) => html`<${DrawMatchRow} key=${m.id} m=${m} ui=${ui} />`)}<//>`));
        const third = ms.filter((m) => m.section === 'third');
        third.length && blocks.push(html`<${Section} key="third" title="3rd place">${third.map((m) => html`<${DrawMatchRow} key=${m.id} m=${m} ui=${ui} />`)}<//>`);
      } else if (st.type === 'double_elim') {
        roundsOf('winners', (r) => `Winners · round ${r}`).forEach((r) => blocks.push(html`<${Section} key=${'w' + r.title} title=${r.title}>${r.items.map((m) => html`<${DrawMatchRow} key=${m.id} m=${m} ui=${ui} />`)}<//>`));
        roundsOf('losers', (r) => `Losers · round ${r}`).forEach((r) => blocks.push(html`<${Section} key=${'l' + r.title} title=${r.title}>${r.items.map((m) => html`<${DrawMatchRow} key=${m.id} m=${m} ui=${ui} />`)}<//>`));
        blocks.push(html`<${Section} key="2f" title="2nd final">${ms.filter((m) => m.section === 'second-final').map((m) => html`<${DrawMatchRow} key=${m.id} m=${m} ui=${ui} />`)}<//>`);
        (st.playoffs || []).forEach((po) => {
          const items = ms.filter((m) => m.playoff === po).sort((a, b) => a.round - b.round || a.order - b.order);
          const on = items[0] && items[0].playoffEnabled;
          blocks.push(html`<${Section} key=${'po' + po} title=${`Play-off places ${po}`} defaultOpen=${on}
            right=${html`<label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer">
              <span>${on ? 'on' : 'off'}</span>
              <button onClick=${() => T.actions.togglePlayoff(compId, po)} className=${'relative w-7 h-4 rounded-full transition ' + (on ? 'bg-indigo-600' : 'bg-slate-300')}>
                <span className=${'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ' + (on ? 'left-3.5' : 'left-0.5')}></span>
              </button></label>`}>
            ${items.map((m) => html`<${DrawMatchRow} key=${m.id} m=${m} ui=${ui} />`)}
          <//>`);
        });
      }
    });
    return html`<aside className="w-[380px] shrink-0 border-l border-slate-200 bg-white flex flex-col min-h-0">
      <div className="flex items-center gap-1 px-2 pt-2 pb-1 border-b border-slate-200">
        <span className="text-sm font-semibold text-slate-700 mr-2">Draws</span>
        ${T.competitions.map((c) => html`<button key=${c.id} onClick=${() => setCompId(c.id)}
          className=${'px-2 py-0.5 rounded text-xs flex items-center gap-1 ' + (c.id === compId ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100')}>
          <${CompDot} comp=${c} />${c.name}</button>`)}
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-16" id="c-drawer-scroll">${blocks}</div>
    </aside>`;
  }

  // ---------- header ----------
  function Header({ drawer, setDrawer, swim, setSwim }) {
    const T = useTournament();
    const free = T.tables.filter((t) => t.status === 'free');
    const idleLong = free.filter((t) => (t.idleMin || 0) > 5).length;
    const overdue = T.matches.filter((m) => m.status === 'overdue');
    const red = overdue.filter((m) => m.overdue === 2).length;
    const chip = (cls, children, title) => html`<span title=${title} className=${'px-2 py-0.5 rounded-full text-xs whitespace-nowrap tabular-nums ' + cls}>${children}</span>`;
    return html`<header className="flex items-center gap-3 px-4 h-12 border-b border-slate-200 bg-white shrink-0">
      <div className="leading-tight">
        <div className="text-sm font-bold text-slate-800">${T.tournament.name}</div>
        <div className="text-[10px] text-slate-400">${T.tournament.venue} · ${T.tournament.date}</div>
      </div>
      <div className="font-mono text-lg text-slate-700 tabular-nums px-2">${hhmmss(T.now)}</div>
      <div className="flex items-center gap-1.5 flex-wrap">
        ${chip(idleLong ? 'bg-orange-100 text-orange-800 ring-1 ring-orange-300' : 'bg-emerald-50 text-emerald-700', html`<b>${free.length}</b> free tables${idleLong ? ` · ${idleLong} idle >5m` : ''}`)}
        ${chip(overdue.length ? (red ? 'bg-red-100 text-red-700 ring-1 ring-red-300' : 'bg-amber-100 text-amber-800') : 'bg-slate-100 text-slate-500', html`<b>${overdue.length}</b> overdue${red ? ` (${red} red)` : ''}`)}
        ${chip('bg-slate-100 text-slate-600', html`<b>${T.queue.filter((m) => m.status === 'ready').length}</b> ready`)}
        ${T.competitions.map((c) => {
          const all = T.matches.filter((m) => m.comp === c.id && m.status !== 'disabled');
          const done = all.filter((m) => m.result).length;
          return html`<span key=${c.id}>${chip('bg-white border border-slate-200 text-slate-600', html`<${CompDot} comp=${c} /> ${c.short} <b>${done}</b>/${all.length}`)}</span>`;
        })}
        ${chip('bg-slate-100 text-slate-600', html`avg <b>${Math.round(T.stats.avgDurationMin)}</b> min`, 'Average duration of finished matches (excl. walkovers)')}
      </div>
      <div className="ml-auto flex items-center gap-2 text-xs">
        ${T.log[0] && html`<span className="text-slate-400 truncate max-w-[220px]" title="Last action">↺ ${T.log[0].text}</span>`}
        <div className="flex rounded border border-slate-300 overflow-hidden">
          <button onClick=${() => setSwim(false)} className=${'px-2 py-1 ' + (!swim ? 'bg-slate-800 text-white' : 'hover:bg-slate-100')}>Merged</button>
          <button onClick=${() => setSwim(true)} className=${'px-2 py-1 ' + (swim ? 'bg-slate-800 text-white' : 'hover:bg-slate-100')}>Per competition</button>
        </div>
        <button onClick=${() => setDrawer(!drawer)} className=${'px-2 py-1 rounded border ' + (drawer ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 hover:bg-slate-100')}>Draws ${drawer ? '⟩' : '⟨'}</button>
      </div>
    </header>`;
  }

  // ---------- selection strip ----------
  function SelectionStrip({ ui }) {
    const T = useTournament();
    const m = ui.selected && T.matchById[ui.selected];
    if (!m) return null;
    const explain = {
      pending: `waiting for ${[m.a, m.b].filter((s) => !s.player).map((s) => s.label).join(' and ')}`,
      ready: 'in "Ready to call"', busy: 'ready but a player is on another table',
      in_progress: `on ${m.table}`, overdue: `on ${m.table} — overdue`, finished: `finished ${hhmm(m.finishedAt)}`,
      walkover: 'walkover', disabled: 'play-off not switched on',
    }[m.status];
    return html`<div className="flex items-center gap-2 mb-2 px-2 py-1 rounded bg-indigo-50 border border-indigo-200 text-xs">
      <${CompDot} comp=${m.competition} />
      <b>${m.competition.short} ${stageTitle(m)} ${m.label}</b>
      <span><${SlotText} m=${m} side="a" /> <span className="text-slate-400">vs</span> <${SlotText} m=${m} side="b" /></span>
      <${StatusPill} m=${m} /><span className="text-slate-500">${explain}</span>
      <button className="ml-auto text-slate-400 hover:text-slate-700" onClick=${() => ui.select(null)}>✕</button>
    </div>`;
  }

  // ---------- root ----------
  function VariantC() {
    const T = useTournament();
    const [selected, setSelected] = useState(null);
    const [edit, setEdit] = useState(null);
    const [swim, setSwim] = useState(false);
    const [drawer, setDrawer] = useState(true);
    const [compId, setCompId] = useState(T.competitions[0].id);
    const ui = { selected, select: setSelected, edit, setEdit };

    // When selection changes, bring it into view on the board and in the drawer.
    useEffect(() => {
      if (!selected) return;
      const m = T.matchById[selected];
      if (m && m.comp !== compId) setCompId(m.comp);
      requestAnimationFrame(() => {
        const card = document.querySelector(`[data-card="${selected}"]`);
        card && card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        const row = document.querySelector(`[data-draw="${selected}"]`);
        row && row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }, [selected]);

    // Close editor if its match left the expected column (e.g. finished elsewhere).
    useEffect(() => {
      const onKey = (e) => { if (e.key === 'Escape') { setEdit(null); setSelected(null); } };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, []);

    return html`<div className="h-full flex flex-col bg-slate-50 text-slate-800">
      <${Header} drawer=${drawer} setDrawer=${setDrawer} swim=${swim} setSwim=${setSwim} />
      <div className="flex-1 min-h-0 flex">
        <main className="flex-1 min-w-0 flex flex-col p-3 gap-3">
          <div className="min-h-0 flex flex-col" style=${{ flex: '1.15 1 0' }}>
            <${SelectionStrip} ui=${ui} />
            <div className="flex-1 min-h-0"><${FlowBoard} ui=${ui} swim=${swim} /></div>
          </div>
          <div className="min-h-0 pb-12" style=${{ flex: '1 1 0' }}><${Timeline} ui=${ui} /></div>
        </main>
        ${drawer && html`<${Drawer} ui=${ui} compId=${compId} setCompId=${setCompId} />`}
      </div>
    </div>`;
  }

  window.Variants.push({ key: 'C', name: 'Flow board + timeline', Component: VariantC });
})();
