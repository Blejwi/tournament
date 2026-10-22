// PROTOTYPE — Variant A "Infinite canvas": pan/zoom canvas per competition, side panels for tables + queue,
// bottom drawer for stats/log. Throwaway.
(function () {
  const { useState, useEffect, useRef, useMemo, useLayoutEffect, useContext, createContext } = React;
  const { html, useTournament, fmt } = window.Proto;

  const CW = 212, CH = 64, GX = 56, HDR = 34;
  const VC = createContext(null);

  const CSS = `
@keyframes aAlarm { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,.55);} 50% { box-shadow: 0 0 0 7px rgba(220,38,38,0);} }
.a-alarm { animation: aAlarm 1.2s ease-in-out infinite; }
@keyframes aWarn { 0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,.45);} 50% { box-shadow: 0 0 0 5px rgba(245,158,11,0);} }
.a-warn { animation: aWarn 2s ease-in-out infinite; }
@keyframes aIdle { 0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,.7);} 50% { box-shadow: 0 0 0 5px rgba(245,158,11,0);} }
.a-idle { animation: aIdle 1.6s ease-in-out infinite; }
@keyframes aFlash { 0% { box-shadow: 0 0 0 0 rgba(15,23,42,.75);} 100% { box-shadow: 0 0 0 16px rgba(15,23,42,0);} }
.a-flash { animation: aFlash .8s ease-out 3; }
.a-grid { background-color:#eef2f6; background-image: radial-gradient(#c5cfdb 1px, transparent 1px); }
`;

  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const isLive = (m) => m.status === 'in_progress' || m.status === 'overdue';
  const freeTablesSorted = (tables) => tables.filter((x) => x.status === 'free').sort((x, y) => (y.idleMin ?? 1e9) - (x.idleMin ?? 1e9));
  const hms = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const placesHint = (p) => {
    if (!p) return '';
    if (p.winner && p.loser) return `pl. ${p.winner}/${p.loser}`;
    if (p.loser) return `out → ${p.loser}`;
    if (p.winner) return `win → ${p.winner}`;
    return '';
  };
  const where = (m) => {
    if (m.section === 'group') return `Group ${m.group} · R${m.round}`;
    if (m.section === 'playoff') return `Play-off ${m.playoff}`;
    if (m.section === 'main') return ['Quarter-final', 'Semi-final', 'Final'][m.round - 1] || `R${m.round}`;
    if (m.section === 'third') return '3rd place';
    if (m.section === 'winners') return `Winners R${m.round}`;
    if (m.section === 'losers') return `Losers R${m.round}`;
    if (m.section === 'second-final') return '2nd final';
    return m.section;
  };
  const overdueText = (m) => (m.overdue === 2 ? 'text-red-600' : m.overdue === 1 ? 'text-amber-600' : 'text-sky-700');
  const gamesOf = (games) => games.reduce(([a, b], [x, y]) => (x > y ? [a + 1, b] : [a, b + 1]), [0, 0]);

  // Offset of el inside root, in untransformed (world) pixels.
  function worldPos(el, root) {
    const w = el.offsetWidth, h = el.offsetHeight;
    let x = 0, y = 0;
    while (el && el !== root) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
    return { x, y, w, h };
  }

  // ---------- bracket layout ----------
  function layoutBlock(ms, gapY) {
    const ids = new Set(ms.map((m) => m.id));
    const rounds = [...new Set(ms.map((m) => m.round))].sort((a, b) => a - b);
    const pos = {};
    rounds.forEach((r, ci) => {
      const col = [];
      ms.filter((m) => m.round === r).sort((a, b) => a.order - b.order).forEach((m) => {
        const fs = [m.a.fromMatch, m.b.fromMatch].filter((f) => f && ids.has(f) && pos[f]);
        let y = fs.length ? fs.reduce((s, f) => s + pos[f].y, 0) / fs.length : m.order * (CH + gapY);
        let moved = true;
        while (moved) {
          moved = false;
          for (const oy of col) if (Math.abs(oy - y) < CH + gapY - 0.5) { y = oy + CH + gapY; moved = true; }
        }
        col.push(y);
        pos[m.id] = { x: ci * (CW + GX), y };
      });
    });
    const ys = Object.values(pos).map((p) => p.y);
    const minY = ys.length ? Math.min(...ys) : 0;
    Object.values(pos).forEach((p) => (p.y -= minY));
    const w = Math.max(CW, ...Object.values(pos).map((p) => p.x + CW));
    const h = Math.max(CH, ...Object.values(pos).map((p) => p.y + CH));
    return { pos, w, h };
  }

  function makeBuilder(allMs) {
    const byId = Object.fromEntries(allMs.map((m) => [m.id, m]));
    const B = { pos: {}, block: {}, labels: [], cross: new Set() };
    B.label = (lb) => B.labels.push(lb);
    B.place = (ms, x, y, key, gapY = 14) => {
      const L = layoutBlock(ms, gapY);
      Object.entries(L.pos).forEach(([id, p]) => { B.pos[id] = { x: p.x + x, y: p.y + y }; B.block[id] = key; });
      return L;
    };
    B.finish = () => {
      const cards = Object.entries(B.pos).map(([id, p]) => ({ m: byId[id], x: p.x, y: p.y }));
      const links = [];
      cards.forEach(({ m }) => ['a', 'b'].forEach((side) => {
        const s = m[side], f = s.fromMatch;
        if (!f || !B.pos[f]) return;
        if (B.block[f] !== B.block[m.id] && !B.cross.has(m.id)) return;
        links.push({ from: f, to: m.id, side, dashed: s.take === 'loser', active: !!byId[f].result });
      }));
      const w = Math.max(...cards.map((c) => c.x + CW), ...B.labels.map((l) => l.x + 300));
      const h = Math.max(...cards.map((c) => c.y + CH), ...B.labels.map((l) => l.y + 30));
      return { cards, links, labels: B.labels, pos: B.pos, w, h };
    };
    return B;
  }

  // ---------- small pieces ----------
  function StatusPill({ m }) {
    const c = m.competition.color;
    const base = 'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ';
    switch (m.status) {
      case 'ready': return html`<span className=${base + 'text-white'} style=${{ background: c }}>Ready</span>`;
      case 'busy': return html`<span className=${base + 'bg-slate-200 text-slate-600'}>⏸ Busy</span>`;
      case 'in_progress': return html`<span className=${base + 'bg-sky-600 text-white'}>Live · ${m.table}</span>`;
      case 'overdue': return html`<span className=${base + 'text-white ' + (m.overdue === 2 ? 'bg-red-600' : 'bg-amber-500')}>Overdue · ${m.table}</span>`;
      case 'finished': return html`<span className=${base + 'bg-slate-200 text-slate-600'}>Finished</span>`;
      case 'walkover': return html`<span className=${base + 'bg-slate-500 text-white'}>Walkover</span>`;
      case 'disabled': return html`<span className=${base + 'bg-slate-100 text-slate-400'}>Off</span>`;
      default: return html`<span className=${base + 'bg-slate-100 text-slate-400'}>Pending</span>`;
    }
  }

  function CardChip({ m }) {
    const c = m.competition.color;
    const v = useContext(VC);
    switch (m.status) {
      case 'ready': {
        const w = m.readySince ? (v.now - m.readySince) / 60000 : null;
        return html`<span className="flex items-center gap-1">${w != null ? html`<span className="text-slate-500 font-normal">${Math.round(w)}m</span>` : null}<span className="px-1 rounded text-white font-bold" style=${{ background: c }}>READY</span></span>`;
      }
      case 'busy': return html`<span className="text-slate-500">⏸ busy</span>`;
      case 'in_progress':
      case 'overdue': {
        const bg = m.status === 'in_progress' ? 'bg-sky-600' : m.overdue === 2 ? 'bg-red-600' : 'bg-amber-500';
        return html`<span className="flex items-center gap-1"><span className=${'px-1 rounded text-white font-bold ' + bg}>${m.table}</span><span className=${'tabular-nums font-bold ' + overdueText(m)}>${fmt.clock(m.elapsedMin)}</span></span>`;
      }
      case 'finished': return html`<span className="text-slate-400">✓ ${fmt.mins(m.durationMin)}</span>`;
      case 'walkover': return html`<span className="px-1 rounded bg-slate-500 text-white font-bold">W.O.</span>`;
      case 'disabled': return html`<span className="text-slate-400">off</span>`;
      default: return null;
    }
  }

  function Slot({ m, side }) {
    const v = useContext(VC);
    const s = m[side];
    const p = s.player;
    const proj = !p && s.origin ? v.projected(m, s.origin) : null;
    const res = m.result;
    const won = res && res.winSide === side.toUpperCase();
    const games = res && !res.walkover ? (side === 'a' ? res.gamesA : res.gamesB) : null;
    const busyAt = m.status === 'busy' && p && v.liveByPlayer[p.id];
    return html`<div className=${'flex items-center gap-1 px-1.5 h-[21px] border-t border-black/5 text-[12px] leading-none ' + (won ? 'font-semibold text-slate-800' : res ? 'text-slate-400' : '')}>
      ${p ? html`<span className="truncate">${fmt.name(p)}</span>`
        : proj ? html`<span className="truncate italic text-slate-600" title="Projected from final standings">${fmt.name(proj)}</span>`
        : html`<span className="truncate italic">${s.label || 'TBD'}</span>`}
      ${s.origin && (p || proj) ? html`<span className="text-[10px] text-slate-400 shrink-0">· ${s.label}</span>` : null}
      ${busyAt ? html`<span className="text-[10px] text-amber-700 shrink-0" title=${'Playing on ' + busyAt.table}>⏸ ${busyAt.table}</span>` : null}
      ${res && res.walkover && won ? html`<span className="text-[9px] px-1 rounded bg-slate-500 text-white shrink-0">w.o.</span>` : null}
      <span className="ml-auto tabular-nums font-bold">${games ?? ''}</span>
    </div>`;
  }

  function MatchCard({ m, style }) {
    const v = useContext(VC);
    const c = m.competition.color;
    const st = m.status;
    let cls = 'relative rounded-md overflow-hidden cursor-pointer select-none hover:shadow-md ';
    const sty = { width: CW, height: CH, ...(style || {}) };
    if (st === 'pending') cls += 'border bg-slate-50 border-dashed border-slate-300 text-slate-400';
    else if (st === 'ready') { cls += 'border-2 shadow-sm'; sty.borderColor = c; sty.background = rgba(c, 0.08); }
    else if (st === 'busy') { cls += 'border-2 border-dashed opacity-75'; sty.borderColor = rgba(c, 0.45); sty.background = rgba(c, 0.03); }
    else if (st === 'in_progress') cls += 'border bg-sky-50 border-sky-400';
    else if (st === 'overdue') cls += m.overdue === 2 ? 'border-2 bg-red-50 border-red-500 a-alarm' : 'border-2 bg-amber-50 border-amber-500 a-warn';
    else if (st === 'finished' || st === 'walkover') cls += 'border bg-slate-100 border-slate-200 text-slate-500';
    else if (st === 'disabled') cls += 'border bg-white border-dashed border-slate-300 opacity-30 text-slate-400';
    if (v.selectedId === m.id) cls += ' outline outline-2 outline-offset-2 outline-slate-900';
    if (v.flashId === m.id) cls += ' a-flash';
    const live = isLive(m);
    const pct = live ? Math.min(100, (m.elapsedMin / m.expectedMin) * 100) : 0;
    return html`<div data-card="1" data-mid=${m.id} className=${cls} style=${sty}
        onClick=${(e) => { e.stopPropagation(); v.open(m, e.currentTarget); }}>
      <div className="flex items-center gap-1 px-1.5 h-[18px] text-[10px] leading-none">
        <b className="text-slate-700">${m.label}</b>
        <span className="text-slate-400 truncate">${placesHint(m.places)}</span>
        <span className="ml-auto shrink-0"><${CardChip} m=${m} /></span>
      </div>
      <${Slot} m=${m} side="a" />
      <${Slot} m=${m} side="b" />
      ${live ? html`<div className="absolute left-0 bottom-0 h-[3px] bg-black/5 w-full"><div className=${'h-full ' + (m.overdue === 2 ? 'bg-red-500' : m.overdue ? 'bg-amber-500' : 'bg-sky-500')} style=${{ width: pct + '%' }}></div></div>` : null}
    </div>`;
  }

  function PlayoffToggle({ comp, po }) {
    const t = useTournament();
    const on = !!(t.matches.find((m) => m.comp === comp.id && m.playoff === po) || {}).playoffEnabled;
    return html`<button onClick=${() => t.actions.togglePlayoff(comp.id, po)}
      className=${'flex items-center gap-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full border ' + (on ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-500 hover:border-slate-500')}>
      <span className=${'relative inline-block w-6 h-3.5 rounded-full ' + (on ? 'bg-emerald-500' : 'bg-slate-300')}><span className=${'absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white ' + (on ? 'left-3' : 'left-0.5')}></span></span>
      ${on ? 'On' : 'Off — enable'}</button>`;
  }

  function BracketArea({ L, comp }) {
    return html`<div className="relative" style=${{ width: L.w, height: L.h }}>
      <svg className="absolute inset-0 pointer-events-none" width=${L.w} height=${L.h}>
        ${L.links.map((k, i) => {
          const a = L.pos[k.from], b = L.pos[k.to];
          const x1 = a.x + CW, y1 = a.y + CH / 2, x2 = b.x, y2 = b.y + (k.side === 'a' ? 28 : 49);
          const xm = x2 - GX / 2;
          return html`<path key=${i} d=${`M${x1} ${y1} H${xm} V${y2} H${x2}`} fill="none"
            stroke=${k.active ? comp.color : '#b6c2d1'} strokeOpacity=${k.active ? 0.7 : 1} strokeWidth=${k.active ? 2 : 1.5}
            strokeDasharray=${k.dashed ? '4 3' : undefined} />`;
        })}
      </svg>
      ${L.labels.map((lb, i) => html`<div key=${'l' + i} className="absolute flex items-center gap-2 whitespace-nowrap" style=${{ left: lb.x, top: lb.y }}>
        <span className=${lb.small ? 'text-[11px] font-bold uppercase tracking-wide text-slate-600' : 'text-[14px] font-bold uppercase tracking-wide'} style=${lb.small ? {} : { color: comp.color }}>${lb.title}</span>
        ${lb.sub ? html`<span className="text-[11px] text-slate-400">${lb.sub}</span>` : null}
        ${lb.toggle ? html`<${PlayoffToggle} comp=${comp} po=${lb.toggle} />` : null}
      </div>`)}
      ${L.cards.map(({ m, x, y }) => html`<${MatchCard} key=${m.id} m=${m} style=${{ position: 'absolute', left: x, top: y }} />`)}
    </div>`;
  }

  function GroupBox({ stage, g, comp }) {
    const t = useTournament();
    const v = useContext(VC);
    const S = t.standings[stage.id][g];
    const done = S.matches.filter((m) => m.result).length;
    const live = S.matches.filter(isLive).length;
    const ms = [...S.matches].sort((a, b) => a.round - b.round || a.order - b.order);
    return html`<div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3" style=${{ width: 2 * CW + 8 + 26 }}>
      <button data-nopan="1" onClick=${() => v.openGroup(stage.id, g)} className="w-full flex items-center gap-2 mb-2 group text-left">
        <span className="w-6 h-6 rounded text-white font-bold flex items-center justify-center" style=${{ background: comp.color }}>${g}</span>
        <span className="font-semibold">Group ${g}</span>
        <span className="text-[11px] text-slate-500">${done}/${S.matches.length} played${live ? ` · ${live} live` : ''}</span>
        ${S.complete ? html`<span className="text-[11px] text-emerald-600 font-semibold">✓ final</span>` : null}
        <span className="ml-auto text-[11px] text-slate-400 group-hover:text-slate-800">standings ›</span>
      </button>
      <table className="w-full table-fixed text-[12px] mb-2">
        <thead><tr className="text-[10px] uppercase text-slate-400"><th className="text-left w-9">#</th><th className="text-left">Player</th><th className="w-11 whitespace-nowrap">W–L</th><th className="w-12">Games</th><th className="w-8">Pts</th></tr></thead>
        <tbody>${S.rows.map((r) => html`<tr key=${r.player.id} className="border-t border-slate-100">
          <td className="py-[3px]">${r.place <= stage.advance
            ? html`<span className="text-[10px] font-bold px-1 rounded text-white" style=${{ background: S.complete ? comp.color : rgba(comp.color, 0.45) }}>${r.place}${g}</span>`
            : html`<span className="text-slate-400 pl-1">${r.place}</span>`}</td>
          <td className="truncate">${fmt.name(r.player)} <span className="text-[10px] text-slate-400">${r.player.club}</span></td>
          <td className="text-center tabular-nums">${r.won}–${r.lost}</td>
          <td className="text-center tabular-nums">${r.gf}:${r.ga}</td>
          <td className="text-center font-semibold">${r.pts}</td></tr>`)}</tbody>
      </table>
      <div className="grid grid-cols-2 gap-2">${ms.map((m) => html`<${MatchCard} key=${m.id} m=${m} />`)}</div>
    </div>`;
  }

  function GroupsKOWorld({ comp }) {
    const t = useTournament();
    const gStage = comp.stages.find((s) => s.type === 'groups');
    const ko = comp.stages.find((s) => s.type !== 'groups');
    let L = null;
    if (ko) {
      const koMs = t.matches.filter((m) => m.stage === ko.id);
      const B = makeBuilder(koMs);
      B.label({ x: 0, y: 0, title: ko.name, sub: `${ko.size} players · slots filled from group places` });
      B.place(koMs, 0, HDR, 'ko', 40);
      koMs.filter((m) => m.section === 'third').forEach((m) => B.label({ x: B.pos[m.id].x, y: B.pos[m.id].y - 17, title: '3rd place match', small: true }));
      L = B.finish();
    }
    return html`<div className="flex items-center gap-24 p-8">
      <div>
        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-[14px] font-bold uppercase tracking-wide" style=${{ color: comp.color }}>${gStage.name}</span>
          <span className="text-[11px] text-slate-400">${Object.keys(gStage.groups).length} groups · top ${gStage.advance} advance · click a group header for full standings</span>
        </div>
        <div className="grid grid-cols-2 gap-6">${Object.keys(gStage.groups).map((g) => html`<${GroupBox} key=${g} stage=${gStage} g=${g} comp=${comp} />`)}</div>
      </div>
      ${L ? html`<${BracketArea} L=${L} comp=${comp} />` : null}
    </div>`;
  }

  function DEWorld({ comp }) {
    const t = useTournament();
    const st = comp.stages[0];
    const ms = t.matches.filter((m) => m.stage === st.id);
    const sec = (s) => ms.filter((m) => m.section === s);
    const B = makeBuilder(ms);
    B.label({ x: 0, y: 0, title: 'Winners bracket', sub: `${st.size} players · losers drop to the losers bracket` });
    const W = B.place(sec('winners'), 0, HDR, 'w');
    let y = HDR + W.h + 60;
    B.label({ x: 0, y, title: 'Losers bracket', sub: 'second loss = out (place range shown on card)' });
    const Lo = B.place(sec('losers'), 0, y + HDR, 'l');
    const sf = sec('second-final')[0];
    if (sf) {
      const fs = [sf.a.fromMatch, sf.b.fromMatch].map((id) => B.pos[id]).filter(Boolean);
      const xs = Math.max(W.w, Lo.w) + GX;
      const ys = fs.length ? fs.reduce((s, p) => s + p.y, 0) / fs.length : 0;
      B.pos[sf.id] = { x: xs, y: ys }; B.block[sf.id] = 'sf'; B.cross.add(sf.id);
      B.label({ x: xs, y: ys - 34, title: '2nd final', small: true });
      B.label({ x: xs, y: ys - 18, title: '', sub: 'WB-final loser v LB winner' });
    }
    y = y + HDR + Lo.h + 64;
    if ((st.playoffs || []).length) {
      B.label({ x: 0, y, title: 'Place play-offs', sub: 'optional · switch each one on when needed' });
      y += 34;
      let x = 0;
      st.playoffs.forEach((po) => {
        const pm = ms.filter((m) => m.playoff === po);
        if (!pm.length) return;
        B.label({ x, y, title: `Places ${po}`, small: true, toggle: po });
        const P = B.place(pm, x, y + 28, 'p' + po);
        x += Math.max(P.w, 240) + 48;
      });
    }
    const L = B.finish();
    return html`<div className="p-8"><${BracketArea} L=${L} comp=${comp} /></div>`;
  }

  // ---------- popover ----------
  function ScoreEntry({ m, onDone, autoFocus }) {
    const t = useTournament();
    const [v, setV] = useState('');
    const ref = useRef(null);
    useEffect(() => { if (autoFocus && ref.current) ref.current.focus(); }, []);
    const r = v.trim() ? t.parseScore(v, m.gamesToWin) : null;
    let preview = null;
    if (r && r.games) {
      const [ga, gb] = gamesOf(r.games);
      preview = `${ga}:${gb} — ${fmt.name(ga > gb ? m.a.player : m.b.player)} wins`;
    }
    const submit = () => { if (r && r.games) { t.actions.enterScore(m.id, r.games); onDone(); } };
    return html`<div>
      <div className="text-[11px] uppercase text-slate-500 font-semibold">${m.result ? 'Correct score' : 'Enter score'} <span className="normal-case font-normal">(${fmt.name(m.a.player)}'s points first)</span></div>
      <div className="flex gap-1 mt-1">
        <input ref=${ref} value=${v} onChange=${(e) => setV(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="11-7 9-11 11-5 11-8"
          className=${'flex-1 min-w-0 font-mono text-[13px] px-2 py-1.5 rounded border outline-none focus:ring-2 focus:ring-slate-300 ' + (r ? (r.error ? 'border-red-400 bg-red-50' : 'border-emerald-500 bg-emerald-50') : 'border-slate-300')} />
        <button disabled=${!(r && r.games)} onClick=${submit} className="px-3 rounded bg-slate-900 text-white text-[12px] font-semibold disabled:opacity-30">Save ⏎</button>
      </div>
      <div className=${'text-[12px] mt-1 min-h-[16px] ' + (r && r.error ? 'text-red-600' : 'text-emerald-700 font-medium')}>
        ${r ? (r.error || preview) : html`<span className="text-slate-400">Games separated by spaces · Enter saves · Esc closes</span>`}
      </div>
    </div>`;
  }

  function MatchPopover({ m, style, onClose }) {
    const t = useTournament();
    const v = useContext(VC);
    const c = m.competition.color;
    const free = freeTablesSorted(t.tables);
    const [ago, setAgo] = useState(String(Math.round(m.elapsedMin || 0)));
    const live = isLive(m);
    const canPlay = m.a.player && m.b.player && !m.result && m.status !== 'disabled';
    const busyP = [m.a.player, m.b.player].filter((p) => p && v.liveByPlayer[p.id] && v.liveByPlayer[p.id].id !== m.id);
    const lbl = 'text-[11px] uppercase text-slate-500 font-semibold';
    const PlayerLine = ({ side }) => {
      const s = m[side], p = s.player, won = m.result && m.result.winSide === side.toUpperCase();
      const proj = !p && s.origin ? v.projected(m, s.origin) : null;
      return html`<div className=${'flex items-center gap-2 ' + (won ? 'font-semibold' : '')}>
        <span className="w-4 text-[10px] text-slate-400">${side.toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate">${p ? fmt.fullName(p) : proj ? html`<i>${fmt.fullName(proj)} (projected)</i>` : html`<i className="text-slate-400">${s.label}</i>`}
            ${s.origin ? html` <span className="text-[11px] text-slate-400 font-normal">· ${s.label}</span>` : null}</div>
          ${p ? html`<div className="text-[11px] text-slate-400 font-normal">${p.club}</div>` : null}
        </div>
        ${m.result && !m.result.walkover ? html`<span className="text-lg tabular-nums">${side === 'a' ? m.result.gamesA : m.result.gamesB}</span>` : null}
        ${m.result && m.result.walkover && won ? html`<span className="text-[10px] px-1 rounded bg-slate-500 text-white">w.o.</span>` : null}
      </div>`;
    };
    return html`<div data-nopan="1" style=${style} onPointerDown=${(e) => e.stopPropagation()}
        className="absolute z-20 w-[340px] bg-white rounded-xl shadow-2xl ring-1 ring-slate-300 text-[13px]">
      <div className="px-3 py-2 flex items-center gap-2 border-b rounded-t-xl" style=${{ background: rgba(c, 0.08) }}>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style=${{ background: c }}>${m.competition.short}</span>
        <span className="font-semibold">${m.label}</span>
        <span className="text-slate-500 text-[11px] truncate">${where(m)}</span>
        <span className="ml-auto"><${StatusPill} m=${m} /></span>
        <button onClick=${onClose} className="w-6 h-6 rounded hover:bg-black/10 text-slate-500">×</button>
      </div>
      <div className="p-3 space-y-3">
        <div className="space-y-1.5"><${PlayerLine} side="a" /><${PlayerLine} side="b" /></div>
        ${m.places ? html`<div className="text-[11px] text-slate-500">${placesHint(m.places)}</div>` : null}

        ${m.status === 'pending' ? html`<div className="text-[12px] text-slate-500 bg-slate-50 rounded p-2">Waiting for: ${[m.a, m.b].filter((s) => !s.player).map((s) => s.label).join(', ')}${[m.a, m.b].some((s) => s.origin) ? ' (group must finish)' : ''}</div>` : null}

        ${m.status === 'disabled' ? html`<div className="flex items-center gap-2 bg-slate-50 rounded p-2 text-[12px]"><span className="text-slate-500 flex-1">Play-off ${m.playoff} is switched off.</span><${PlayoffToggle} comp=${m.competition} po=${m.playoff} /></div>` : null}

        ${busyP.length ? html`<div className="text-[12px] bg-amber-50 text-amber-800 rounded p-2">⏸ ${busyP.map((p) => `${fmt.name(p)} is playing on ${v.liveByPlayer[p.id].table} (${v.liveByPlayer[p.id].label})`).join('; ')}</div>` : null}

        ${m.status === 'ready' || m.status === 'busy' ? html`<div>
          <div className=${lbl}>Assign to free table</div>
          ${free.length ? html`<div className="grid grid-cols-4 gap-1.5 mt-1">${free.map((tb) => html`<button key=${tb.id}
              onClick=${() => { t.actions.assign(m.id, tb.id); onClose(); }}
              className="rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 py-1 text-center">
              <div className="font-bold text-emerald-800">${tb.id}</div>
              <div className="text-[10px] text-emerald-700">${tb.idleMin != null ? 'idle ' + Math.round(tb.idleMin) + 'm' : 'unused'}</div></button>`)}</div>`
            : html`<div className="text-slate-500 text-[12px] mt-1">No free table right now.</div>`}
        </div>` : null}

        ${live ? html`<div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-bold">${m.table}</span>
            <span className=${'tabular-nums font-bold text-[15px] ' + overdueText(m)}>${fmt.clock(m.elapsedMin)}</span>
            <span className="text-slate-500 text-[12px]">of ~${m.expectedMin} min expected</span>
          </div>
          ${m.overdue ? html`<div className=${'text-[12px] rounded p-2 ' + (m.overdue === 2 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800')}>Running ${Math.round((m.elapsedMin / m.expectedMin) * 100)}% of expected time — players may have forgotten to report the score.</div>` : null}
          <div className="flex items-center gap-1 text-[12px]">
            Started <input type="number" min="0" value=${ago} onChange=${(e) => setAgo(e.target.value)}
              onKeyDown=${(e) => { if (e.key === 'Enter') t.actions.setStartedMinutesAgo(m.id, +ago || 0); }}
              className="w-14 border border-slate-300 rounded px-1 py-0.5" /> min ago
            <button onClick=${() => t.actions.setStartedMinutesAgo(m.id, +ago || 0)} className="px-2 py-0.5 rounded border border-slate-300 hover:bg-slate-50">Set</button>
            <button onClick=${() => { t.actions.unassign(m.id); onClose(); }} className="ml-auto text-red-600 hover:underline">Take off table</button>
          </div>
        </div>` : null}

        ${canPlay || m.result ? html`<${ScoreEntry} key=${m.id + m.status} m=${m} autoFocus=${live} onDone=${onClose} />` : null}

        ${canPlay ? html`<div className="flex items-center gap-1.5 text-[12px] flex-wrap">
          <span className="text-slate-500">Walkover:</span>
          <button onClick=${() => { t.actions.walkover(m.id, 'A'); onClose(); }} className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50">${fmt.name(m.a.player)} wins</button>
          <button onClick=${() => { t.actions.walkover(m.id, 'B'); onClose(); }} className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-50">${fmt.name(m.b.player)} wins</button>
        </div>` : null}

        ${m.result ? html`<div className="text-[12px] text-slate-500 border-t pt-2">
          ${m.result.walkover ? 'Walkover' : fmt.gameList(m)} · ${m.table || 'no table'} · ${fmt.mins(m.durationMin)}
        </div>` : null}
      </div>
    </div>`;
  }

  // ---------- group detail modal ----------
  function GroupModal({ stageId, g, onClose, onFocus }) {
    const t = useTournament();
    const S = t.standings[stageId][g];
    const comp = S.matches[0].competition;
    const stage = comp.stages.find((s) => s.id === stageId);
    const ids = stage.groups[g];
    const find = (x, y) => S.matches.find((m) => (m.a.player.id === x && m.b.player.id === y) || (m.a.player.id === y && m.b.player.id === x));
    const cell = (x, y) => {
      if (x === y) return html`<td className="bg-slate-200"></td>`;
      const m = find(x, y);
      if (!m) return html`<td></td>`;
      const rowIsA = m.a.player.id === x;
      if (m.result) {
        const won = (m.result.winSide === 'A') === rowIsA;
        const txt = m.result.walkover ? 'w.o.' : rowIsA ? `${m.result.gamesA}:${m.result.gamesB}` : `${m.result.gamesB}:${m.result.gamesA}`;
        return html`<td className=${'text-center font-semibold tabular-nums ' + (won ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50')}>${txt}</td>`;
      }
      if (isLive(m)) return html`<td className="text-center text-sky-700 text-[11px]">▶ ${m.table}</td>`;
      return html`<td className="text-center text-slate-300">–</td>`;
    };
    const ratio = (a, b) => (b === 0 ? (a ? '∞' : '–') : (a / b).toFixed(2));
    return html`<div className="fixed inset-0 z-40 bg-slate-900/30 flex items-center justify-center" onClick=${onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[760px] max-h-[85vh] overflow-auto" onClick=${(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <span className="w-7 h-7 rounded text-white font-bold flex items-center justify-center" style=${{ background: comp.color }}>${g}</span>
          <div><div className="font-semibold">${comp.name} — Group ${g}</div><div className="text-[11px] text-slate-500">${S.complete ? 'Final standings' : 'Provisional standings'} · top ${stage.advance} advance</div></div>
          <button onClick=${onClose} className="ml-auto w-8 h-8 rounded hover:bg-slate-100 text-lg">×</button>
        </div>
        <div className="p-4 space-y-4 text-[13px]">
          <table className="w-full">
            <thead><tr className="text-[11px] uppercase text-slate-400 text-right"><th className="text-left">#</th><th className="text-left">Player</th><th className="text-left">Club</th><th>P</th><th>W</th><th>L</th><th>Games</th><th>Ratio</th><th>Points</th><th>Ratio</th><th>Pts</th></tr></thead>
            <tbody>${S.rows.map((r) => html`<tr key=${r.player.id} className="border-t text-right tabular-nums">
              <td className="text-left py-1 font-bold" style=${r.place <= stage.advance ? { color: comp.color } : {}}>${r.place}</td>
              <td className="text-left font-medium">${fmt.fullName(r.player)}</td><td className="text-left text-slate-500">${r.player.club}</td>
              <td>${r.played}</td><td>${r.won}</td><td>${r.lost}</td><td>${r.gf}:${r.ga}</td><td className="text-slate-500">${ratio(r.gf, r.ga)}</td>
              <td>${r.pf}:${r.pa}</td><td className="text-slate-500">${ratio(r.pf, r.pa)}</td><td className="font-bold">${r.pts}</td></tr>`)}</tbody>
          </table>
          <div>
            <div className="text-[11px] uppercase text-slate-500 font-semibold mb-1">Cross table</div>
            <table className="border-collapse text-[12px]">
              <thead><tr><th></th>${ids.map((id, i) => html`<th key=${id} className="w-14 text-slate-500 font-medium">${i + 1}</th>`)}</tr></thead>
              <tbody>${ids.map((x, i) => html`<tr key=${x} className="border-t"><td className="pr-3 py-1"><span className="text-slate-400 mr-1">${i + 1}</span>${fmt.name(t.playerById[x])}</td>${ids.map((y) => html`<${React.Fragment} key=${y}>${cell(x, y)}<//>`)}</tr>`)}</tbody>
            </table>
          </div>
          <div>
            <div className="text-[11px] uppercase text-slate-500 font-semibold mb-1">Matches</div>
            <div className="grid grid-cols-2 gap-1">${S.matches.map((m) => html`<button key=${m.id} onClick=${() => { onClose(); onFocus(m.id); }} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 text-left">
              <span className="text-[11px] text-slate-400 w-8">R${m.round}</span>
              <span className="flex-1 truncate">${fmt.name(m.a.player)} – ${fmt.name(m.b.player)}</span>
              <span className="text-[12px] text-slate-500">${m.result ? (m.result.walkover ? 'w.o.' : fmt.gameList(m)) : isLive(m) ? `${m.table} · ${fmt.clock(m.elapsedMin)}` : m.status}</span></button>`)}</div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ---------- left: tables ----------
  function tableTone(tb, idleAlert) {
    if (tb.status === 'playing') return 'bg-sky-600 text-white';
    if (tb.status === 'overdue') return tb.match.overdue === 2 ? 'bg-red-600 text-white a-alarm' : 'bg-amber-500 text-white';
    if (tb.status === 'free') return idleAlert ? 'bg-amber-400 text-white a-idle' : 'bg-emerald-500 text-white';
    return 'bg-slate-200 text-slate-400';
  }

  function AssignList({ tableId, onDone }) {
    const t = useTournament();
    const ready = t.queue.filter((m) => m.status === 'ready').slice(0, 5);
    if (!ready.length) return html`<div className="text-[11px] text-slate-400 px-1 py-1">Nothing ready to play.</div>`;
    return html`<div className="mt-1 space-y-0.5">${ready.map((m) => html`<button key=${m.id}
        onClick=${(e) => { e.stopPropagation(); t.actions.assign(m.id, tableId); onDone(); }}
        className="w-full flex items-center gap-1.5 text-left text-[11.5px] px-1.5 py-1 rounded bg-white border border-slate-200 hover:border-slate-500">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style=${{ background: m.competition.color }}></span>
        <b className="shrink-0">${m.label}</b><span className="truncate">${fmt.name(m.a.player)} v ${fmt.name(m.b.player)}</span>
        <span className="ml-auto text-slate-400 shrink-0">→ ${tableId}</span></button>`)}</div>`;
  }

  function TablesPanel({ open, setOpen, onFocus, onFull }) {
    const t = useTournament();
    const [assignFor, setAssignFor] = useState(null);
    const readyWaiting = t.queue.some((m) => m.status === 'ready');
    const over = t.tables.filter((x) => x.status === 'overdue').length;
    const idle = readyWaiting ? t.tables.filter((x) => x.status === 'free').length : 0;
    const playing = t.tables.filter((x) => x.status === 'playing').length;
    if (!open) return html`<div className="w-11 shrink-0 bg-white border-r border-slate-200 flex flex-col items-center py-2 gap-3 cursor-pointer" onClick=${() => setOpen(true)}>
      <button title="Show tables" className="w-8 h-8 rounded hover:bg-slate-100 text-slate-600">»</button>
      <div className="text-[11px] font-bold text-slate-500 tracking-widest" style=${{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>TABLES</div>
      ${over ? html`<div className="flex flex-col items-center"><span className="w-7 h-7 rounded-full bg-red-600 text-white font-bold flex items-center justify-center a-alarm">${over}</span><span className="text-[9px] text-red-600 font-semibold mt-0.5">LATE</span></div>` : null}
      ${idle ? html`<div className="flex flex-col items-center"><span className="w-7 h-7 rounded-full bg-amber-400 text-white font-bold flex items-center justify-center a-idle">${idle}</span><span className="text-[9px] text-amber-600 font-semibold mt-0.5">IDLE</span></div>` : null}
    </div>`;
    return html`<aside className="w-72 shrink-0 bg-white border-r border-slate-200 flex flex-col min-h-0">
      <div className="px-3 h-10 flex items-center gap-2 border-b border-slate-200">
        <span className="font-semibold">Tables</span>
        <span className="text-[11px] text-slate-500">${playing + over} playing · ${t.tables.filter((x) => x.status === 'free').length} free${over ? '' : ''}</span>
        ${over ? html`<span className="text-[10px] font-bold px-1.5 rounded-full bg-red-600 text-white">${over} late</span>` : null}
        <button onClick=${onFull} title="Full-screen table overview" className="ml-auto w-7 h-7 rounded hover:bg-slate-100 text-slate-600">⤢</button>
        <button onClick=${() => setOpen(false)} title="Collapse" className="w-7 h-7 rounded hover:bg-slate-100 text-slate-600">«</button>
      </div>
      <div className="flex-1 overflow-auto">
        ${t.tables.map((tb) => {
          const alert = tb.status === 'free' && readyWaiting;
          const m = tb.match;
          return html`<div key=${tb.id} className=${'group px-2 py-1.5 border-b border-slate-100 cursor-pointer ' + (tb.status === 'overdue' ? (m.overdue === 2 ? 'bg-red-50' : 'bg-amber-50') : alert ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50')}
              onClick=${() => { if (m) onFocus(m.id); else if (tb.status === 'free') setAssignFor(assignFor === tb.id ? null : tb.id); }}>
            <div className="flex items-center gap-2">
              <div className=${'w-9 h-9 shrink-0 rounded-md flex items-center justify-center font-bold text-[15px] ' + tableTone(tb, alert)}>${tb.number}</div>
              <div className="min-w-0 flex-1">
                ${m ? html`<div className="flex items-center gap-1 text-[11px] text-slate-500"><span className="w-2 h-2 rounded-full" style=${{ background: m.competition.color }}></span>${m.competition.short} · ${m.label}${tb.name ? ' · ' + tb.name : ''}</div>
                    <div className="truncate text-[12px] font-medium">${fmt.name(m.a.player)} – ${fmt.name(m.b.player)}</div>`
                  : tb.status === 'free' ? html`<div className=${'text-[12px] font-semibold ' + (alert ? 'text-amber-700' : 'text-emerald-700')}>Free${tb.name ? ' · ' + tb.name : ''}${alert ? ' — assign ›' : ''}</div>
                    <div className="text-[11px] text-slate-500">${tb.idleMin != null ? html`idle <b className=${alert && tb.idleMin >= 3 ? 'text-amber-700' : ''}>${fmt.mins(tb.idleMin)}</b>` : 'not used yet'} · ${tb.matchesPlayed} played</div>`
                  : html`<div className="text-[12px] text-slate-400">Inactive${tb.name ? ' · ' + tb.name : ''}</div>`}
              </div>
              ${m ? html`<div className="text-right shrink-0"><div className=${'tabular-nums font-bold ' + overdueText(m)}>${fmt.clock(m.elapsedMin)}</div><div className="text-[10px] text-slate-400">/ ${m.expectedMin}m</div></div>`
                : html`<button onClick=${(e) => { e.stopPropagation(); t.actions.toggleTable(tb.id); }} title=${tb.active ? 'Deactivate table' : 'Activate table'}
                    className=${'text-[10px] px-1.5 py-0.5 rounded border ' + (tb.active ? 'border-transparent text-slate-300 group-hover:border-slate-300 group-hover:text-slate-500' : 'border-slate-300 text-slate-600 hover:bg-slate-100')}>${tb.active ? 'off' : 'turn on'}</button>`}
            </div>
            ${assignFor === tb.id && tb.status === 'free' ? html`<${AssignList} tableId=${tb.id} onDone=${() => setAssignFor(null)} />` : null}
          </div>`;
        })}
      </div>
    </aside>`;
  }

  function TablesFull({ onClose, onFocus }) {
    const t = useTournament();
    const readyWaiting = t.queue.some((m) => m.status === 'ready');
    return html`<div className="absolute inset-0 z-30 bg-slate-50 overflow-auto p-5">
      <div className="flex items-center mb-4"><span className="text-lg font-bold">All tables</span>
        <span className="ml-3 text-[12px] text-slate-500">click a playing table to jump to its match · Esc closes</span>
        <button onClick=${onClose} className="ml-auto px-3 py-1.5 rounded bg-slate-900 text-white text-[12px] font-semibold">Back to canvas</button></div>
      <div className="grid grid-cols-5 gap-3">${t.tables.map((tb) => {
        const m = tb.match, alert = tb.status === 'free' && readyWaiting;
        const pct = m ? Math.min(100, (m.elapsedMin / m.expectedMin) * 100) : 0;
        return html`<div key=${tb.id} onClick=${() => { if (m) { onClose(); onFocus(m.id); } }}
            className=${'rounded-xl border-2 bg-white p-3 h-44 flex flex-col ' + (m ? 'cursor-pointer hover:shadow-lg ' : '') + (tb.status === 'overdue' ? (m.overdue === 2 ? 'border-red-500 a-alarm' : 'border-amber-500') : tb.status === 'playing' ? 'border-sky-400' : alert ? 'border-amber-400 a-idle' : tb.status === 'free' ? 'border-emerald-400' : 'border-slate-200 opacity-50')}>
          <div className="flex items-center gap-2"><span className=${'w-10 h-10 rounded-lg flex items-center justify-center text-xl font-bold ' + tableTone(tb, alert)}>${tb.number}</span>
            <div className="text-[11px] text-slate-500">${tb.name || ' '}<div className="font-semibold uppercase">${tb.status}</div></div>
            ${m ? html`<div className=${'ml-auto text-xl font-bold tabular-nums ' + overdueText(m)}>${fmt.clock(m.elapsedMin)}</div>` : null}</div>
          ${m ? html`<div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1"><span className="w-2 h-2 rounded-full" style=${{ background: m.competition.color }}></span>${m.competition.short} · ${m.label} · ${where(m)}</div>
              <div className="font-semibold text-[13px] truncate">${fmt.name(m.a.player)}</div><div className="font-semibold text-[13px] truncate">${fmt.name(m.b.player)}</div>
              <div className="mt-auto h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className=${'h-full ' + (m.overdue === 2 ? 'bg-red-500' : m.overdue ? 'bg-amber-500' : 'bg-sky-500')} style=${{ width: pct + '%' }}></div></div>`
            : tb.status === 'free' ? html`<div className="mt-1 text-[11px] text-slate-500">${tb.idleMin != null ? 'idle ' + fmt.mins(tb.idleMin) : 'not used yet'}</div><div className="flex-1 overflow-hidden"><${AssignList} tableId=${tb.id} onDone=${() => {}} /></div>`
            : html`<button onClick=${() => t.actions.toggleTable(tb.id)} className="mt-auto text-[12px] px-2 py-1 rounded border border-slate-300 hover:bg-slate-100">Activate</button>`}
        </div>`;
      })}</div>
    </div>`;
  }

  // ---------- right: queue ----------
  function QueuePanel({ open, setOpen, compId, mode, setMode, onFocus }) {
    const t = useTournament();
    const v = useContext(VC);
    const list = t.queue.filter((m) => mode === 'all' || m.comp === compId);
    const ready = list.filter((m) => m.status === 'ready'), busy = list.filter((m) => m.status === 'busy');
    const free = freeTablesSorted(t.tables);
    const comp = t.compById[compId];
    if (!open) return html`<div className="w-11 shrink-0 bg-white border-l border-slate-200 flex flex-col items-center py-2 gap-3 cursor-pointer" onClick=${() => setOpen(true)}>
      <button title="Show waiting list" className="w-8 h-8 rounded hover:bg-slate-100 text-slate-600">«</button>
      <div className="text-[11px] font-bold text-slate-500 tracking-widest" style=${{ writingMode: 'vertical-rl' }}>WAITING LIST</div>
      <span className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center">${t.queue.filter((m) => m.status === 'ready').length}</span>
    </div>`;
    const Item = ({ m, i }) => {
      const isBusy = m.status === 'busy';
      const wait = m.readySince ? (t.now - m.readySince) / 60000 : null;
      const bp = [m.a.player, m.b.player].filter((p) => p && v.liveByPlayer[p.id]);
      return html`<div onClick=${() => onFocus(m.id)} className=${'flex gap-2 px-2 py-1.5 border-b border-slate-100 hover:bg-slate-50 cursor-pointer ' + (isBusy ? 'opacity-70' : '')}>
        <div className="w-1 rounded-full self-stretch shrink-0" style=${{ background: m.competition.color, opacity: isBusy ? 0.4 : 1 }}></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            ${!isBusy ? html`<span className="text-slate-400 w-4">${i + 1}.</span>` : null}
            <b className="text-slate-700">${m.label}</b>
            ${mode === 'all' ? html`<span className="font-semibold" style=${{ color: m.competition.color }}>${m.competition.short}</span>` : null}
            <span className="truncate">· ${where(m)}</span>
            ${wait != null ? html`<span className=${'ml-auto shrink-0 ' + (wait > 10 ? 'text-amber-600 font-semibold' : '')}>${Math.round(wait)}m</span>` : null}
          </div>
          <div className="truncate text-[12.5px] font-medium">${fmt.name(m.a.player)} <span className="text-slate-400 font-normal">v</span> ${fmt.name(m.b.player)}</div>
          ${isBusy ? html`<div className="text-[11px] text-amber-700 truncate">⏸ ${bp.map((p) => `${fmt.name(p)} on ${v.liveByPlayer[p.id].table}`).join(', ')}</div>` : null}
        </div>
        ${!isBusy && free[0] ? html`<button title=${'Assign to ' + free[0].id + ' (longest idle)'} onClick=${(e) => { e.stopPropagation(); t.actions.assign(m.id, free[0].id); }}
            className="self-center shrink-0 px-2 py-1 rounded bg-slate-900 text-white text-[11px] font-semibold opacity-80 hover:opacity-100">→ ${free[0].id}</button>` : null}
      </div>`;
    };
    const seg = (on) => 'px-2 py-0.5 rounded text-[11px] font-semibold ' + (on ? 'bg-white shadow text-slate-900' : 'text-slate-500');
    return html`<aside className="w-80 shrink-0 bg-white border-l border-slate-200 flex flex-col min-h-0">
      <div className="px-3 h-10 flex items-center gap-2 border-b border-slate-200">
        <span className="font-semibold">Waiting list</span>
        <span className="text-[11px] text-slate-500">${ready.length} ready</span>
        <div className="ml-auto flex bg-slate-100 rounded p-0.5">
          <button className=${seg(mode === 'all')} onClick=${() => setMode('all')}>All</button>
          <button className=${seg(mode === 'comp')} onClick=${() => setMode('comp')}>${comp.short}</button>
        </div>
        <button onClick=${() => setOpen(false)} title="Collapse" className="w-7 h-7 rounded hover:bg-slate-100 text-slate-600">»</button>
      </div>
      <div className="flex-1 overflow-auto">
        ${ready.length ? ready.map((m, i) => html`<${Item} key=${m.id} m=${m} i=${i} />`) : html`<div className="p-4 text-[12px] text-slate-400">No ready matches${mode === 'comp' ? ' in ' + comp.name : ''}.</div>`}
        ${busy.length ? html`<div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wide font-bold text-slate-400 border-b border-slate-100">Busy — a player is on another table (${busy.length})</div>
          ${busy.map((m, i) => html`<${Item} key=${m.id} m=${m} i=${i} />`)}` : null}
      </div>
      <div className="px-3 py-1.5 text-[10px] text-slate-400 border-t">Sorted by stage, round, waiting time. Click to locate on canvas · → assigns to longest-idle table.</div>
    </aside>`;
  }

  // ---------- bottom: stats + log ----------
  function BottomDrawer({ open, setOpen, onFocus }) {
    const t = useTournament();
    const s = t.stats;
    const fin = t.matches.filter((m) => m.result).length;
    const tot = t.matches.filter((m) => m.status !== 'disabled').length;
    const pct = tot ? Math.round((fin / tot) * 100) : 0;
    const lastHour = t.matches.filter((m) => m.finishedAt && t.now - m.finishedAt < 3600000).length;
    const activeTables = t.tables.filter((x) => x.active).length || 1;
    const liveLong = t.matches.filter(isLive).sort((a, b) => b.elapsedMin - a.elapsedMin).slice(0, 3);
    const H = 'text-[11px] uppercase tracking-wide text-slate-500 font-bold mb-1.5';
    return html`<div className="shrink-0 bg-white border-t border-slate-200">
      <div className="h-8 flex items-center gap-4 px-3 text-[12px]">
        <button onClick=${() => setOpen(!open)} className="font-semibold flex items-center gap-1 hover:text-slate-600">${open ? '▾' : '▴'} Stats & log</button>
        <div className="flex items-center gap-2"><div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden"><div style=${{ width: pct + '%' }} className="h-full bg-slate-700"></div></div><span className="tabular-nums">${fin}/${tot} matches (${pct}%)</span></div>
        ${s.byCompetition.map((b) => html`<span key=${b.competition.id} className="flex items-center gap-1 text-slate-500"><span className="w-2 h-2 rounded-full" style=${{ background: b.competition.color }}></span>${b.competition.short} avg ${fmt.mins(b.avgMin)}</span>`)}
        <span className="ml-auto text-slate-500">${lastHour} finished in last hour</span>
        <span className="text-slate-400 truncate max-w-[280px]">${t.log[0] ? `Last: ${hms(t.log[0].at)} ${t.log[0].text}` : 'No changes yet'}</span>
      </div>
      ${open ? html`<div className="h-56 grid grid-cols-3 gap-6 px-4 py-3 border-t border-slate-100 text-[12px]">
        <div className="overflow-auto">
          <div className=${H}>Progress by competition</div>
          ${s.byCompetition.map((b) => {
            const cf = t.matches.filter((m) => m.comp === b.competition.id && m.result).length;
            const left = b.total - cf;
            const live = t.matches.filter((m) => m.comp === b.competition.id && isLive(m)).length;
            const ready = t.matches.filter((m) => m.comp === b.competition.id && m.status === 'ready').length;
            const eta = b.avgMin ? (left * b.avgMin) / activeTables : null;
            return html`<div key=${b.competition.id} className="mb-3">
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style=${{ background: b.competition.color }}></span><b>${b.competition.name}</b><span className="ml-auto tabular-nums">${cf}/${b.total}</span></div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden my-1"><div className="h-full" style=${{ width: (b.total ? (cf / b.total) * 100 : 0) + '%', background: b.competition.color }}></div></div>
              <div className="text-slate-500">avg ${fmt.mins(b.avgMin)} (expected ${t.matches.find((m) => m.comp === b.competition.id).expectedMin}) · ${live} live · ${ready} ready${eta != null ? ` · ~${Math.round(eta)} min left if all tables` : ''}</div>
            </div>`;
          })}
          <div className="text-slate-500">Overall avg ${fmt.mins(s.avgDurationMin)} · ${activeTables} active tables</div>
        </div>
        <div className="overflow-auto">
          <div className=${H}>Running longest now</div>
          ${liveLong.map((m) => html`<button key=${m.id} onClick=${() => onFocus(m.id)} className="w-full flex items-center gap-2 py-0.5 hover:bg-slate-50 text-left">
            <span className="w-2 h-2 rounded-full" style=${{ background: m.competition.color }}></span><b>${m.label}</b><span className="truncate text-slate-500">${fmt.name(m.a.player)} – ${fmt.name(m.b.player)}</span>
            <span className=${'ml-auto tabular-nums font-semibold ' + overdueText(m)}>${m.table} ${fmt.clock(m.elapsedMin)}</span></button>`)}
          <div className=${H + ' mt-3'}>Longest finished</div>
          ${s.longest.map((m) => html`<button key=${m.id} onClick=${() => onFocus(m.id)} className="w-full flex items-center gap-2 py-0.5 hover:bg-slate-50 text-left">
            <span className="w-2 h-2 rounded-full" style=${{ background: m.competition.color }}></span><b>${m.label}</b><span className="truncate text-slate-500">${fmt.name(m.a.player)} – ${fmt.name(m.b.player)}</span>
            <span className="ml-auto tabular-nums">${fmt.mins(m.durationMin)}</span></button>`)}
        </div>
        <div className="overflow-auto">
          <div className=${H}>Change log (this session)</div>
          ${t.log.length ? t.log.slice(0, 60).map((e, i) => html`<div key=${i} className="flex gap-2 py-0.5 border-b border-slate-50"><span className="text-slate-400 tabular-nums">${hms(e.at)}</span><span>${e.text}</span></div>`)
            : html`<div className="text-slate-400">Assignments, scores, walkovers and play-off toggles appear here.</div>`}
        </div>
      </div>` : null}
    </div>`;
  }

  // ---------- header ----------
  function Header({ compId, setComp, onFocus }) {
    const t = useTournament();
    const [oi, setOi] = useState(0);
    const overdue = t.matches.filter((m) => m.status === 'overdue').sort((a, b) => b.overdue - a.overdue || b.elapsedMin - a.elapsedMin);
    const readyWaiting = t.queue.some((m) => m.status === 'ready');
    const idle = readyWaiting ? t.tables.filter((x) => x.status === 'free').length : 0;
    const tr = t.tournament;
    return html`<header className="h-12 shrink-0 bg-white border-b border-slate-200 flex items-stretch px-3 gap-4">
      <div className="flex flex-col justify-center pr-2">
        <div className="font-bold leading-tight">${tr.name}</div>
        <div className="text-[11px] text-slate-500">${tr.date} · ${tr.venue}</div>
      </div>
      <nav className="flex items-stretch gap-0.5">${t.competitions.map((c) => {
        const cm = t.matches.filter((m) => m.comp === c.id);
        const r = cm.filter((m) => m.status === 'ready').length, l = cm.filter(isLive).length, o = cm.filter((m) => m.status === 'overdue').length;
        const fin = cm.filter((m) => m.result).length, tot = cm.filter((m) => m.status !== 'disabled').length;
        const act = c.id === compId;
        return html`<button key=${c.id} onClick=${() => setComp(c.id)}
            className=${'px-4 flex items-center gap-2 border-b-[3px] ' + (act ? 'bg-slate-50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50')}
            style=${act ? { borderBottomColor: c.color } : {}}>
          <span className="w-2.5 h-2.5 rounded-full" style=${{ background: c.color }}></span>
          <span className="font-semibold">${c.name}</span>
          <span className="text-[11px] text-slate-400 tabular-nums">${fin}/${tot}</span>
          ${r ? html`<span className="text-[10px] font-bold px-1.5 rounded text-white" style=${{ background: c.color }}>${r} ready</span>` : null}
          ${l ? html`<span className="text-[10px] font-bold px-1.5 rounded bg-sky-100 text-sky-700">${l} live</span>` : null}
          ${o ? html`<span className="text-[10px] font-bold px-1.5 rounded bg-red-600 text-white">${o} late</span>` : null}
        </button>`;
      })}</nav>
      <div className="ml-auto flex items-center gap-3">
        ${overdue.length ? html`<button onClick=${() => { onFocus(overdue[oi % overdue.length].id); setOi(oi + 1); }}
            className="px-3 py-1 rounded-full bg-red-600 text-white font-semibold text-[12px] a-alarm" title="Jump to the next overdue match">⚠ ${overdue.length} overdue — check scores ›</button>` : null}
        ${idle ? html`<span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold text-[12px]">${idle} table${idle > 1 ? 's' : ''} idle while matches wait</span>` : null}
        <span className="text-lg font-bold tabular-nums text-slate-700">${new Date(t.now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </header>`;
  }

  function Legend() {
    const sw = (cls, style, label) => html`<span key=${label} className="flex items-center gap-1"><span className=${'w-4 h-3 rounded-sm ' + cls} style=${style}></span>${label}</span>`;
    return html`<div data-nopan="1" className="absolute left-3 bottom-3 z-10 flex items-center gap-3 text-[11px] text-slate-600 bg-white/90 backdrop-blur rounded-lg px-3 py-1.5 shadow ring-1 ring-slate-200">
      ${sw('border border-dashed border-slate-400 bg-slate-50', {}, 'pending')}
      ${sw('border-2 border-indigo-500 bg-indigo-50', {}, 'ready')}
      ${sw('border-2 border-dashed border-indigo-300 opacity-70', {}, 'busy')}
      ${sw('border border-sky-400 bg-sky-50', {}, 'live')}
      ${sw('border-2 border-amber-500 bg-amber-50', {}, '>100%')}
      ${sw('border-2 border-red-500 bg-red-50', {}, '>150%')}
      ${sw('border border-slate-200 bg-slate-100', {}, 'done / w.o.')}
      ${sw('border border-dashed border-slate-300 opacity-40', {}, 'play-off off')}
    </div>`;
  }

  // ---------- main ----------
  function VariantA() {
    const t = useTournament();
    const [compId, setCompId] = useState(t.competitions[0].id);
    const [views, setViews] = useState({});
    const [animate, setAnimate] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [selected, setSelected] = useState(null);
    const [flashId, setFlashId] = useState(null);
    const [pendingFocus, setPendingFocus] = useState(null);
    const [groupDetail, setGroupDetail] = useState(null);
    const [leftOpen, setLeftOpen] = useState(true);
    const [rightOpen, setRightOpen] = useState(true);
    const [bottomOpen, setBottomOpen] = useState(false);
    const [tablesFull, setTablesFull] = useState(false);
    const [queueMode, setQueueMode] = useState('all');
    const vpRef = useRef(null), worldRef = useRef(null), drag = useRef(null);
    const compRef = useRef(compId); compRef.current = compId;
    const comp = t.compById[compId];
    const view = views[compId] || { x: 0, y: 0, k: 1 };
    const setViewFor = (id, v) => setViews((s) => ({ ...s, [id]: typeof v === 'function' ? v(s[id] || { x: 0, y: 0, k: 1 }) : v }));

    const liveByPlayer = useMemo(() => {
      const r = {};
      t.matches.forEach((m) => { if (m.state === 'in_progress') [m.a.player, m.b.player].forEach((p) => p && (r[p.id] = m)); });
      return r;
    }, [t.matches]);

    const projected = (m, origin) => {
      const st = m.competition.stages.find((s) => s.id === m.stage);
      const S = st && st.feedsFrom && t.standings[st.feedsFrom] && t.standings[st.feedsFrom][origin.group];
      return S && S.complete ? S.rows[origin.place - 1].player : null;
    };

    // initial=true: fit, but never below 60% so cards stay legible (anchor top-left, pan for the rest).
    const fit = (animated = true, initial = false) => {
      const vp = vpRef.current, w = worldRef.current;
      if (!vp || !w) return;
      const vw = vp.clientWidth, vh = vp.clientHeight, ww = w.offsetWidth, wh = w.offsetHeight;
      let k = clamp(Math.min((vw - 48) / ww, (vh - 80) / wh), 0.15, 1.2);
      setAnimate(animated);
      if (initial && k < 0.6) { k = 0.6; setViewFor(compRef.current, { k, x: 8, y: 24 }); return; }
      setViewFor(compRef.current, { k, x: (vw - ww * k) / 2, y: Math.max(16, (vh - wh * k) / 2 - 16) });
    };
    const zoomBy = (f) => {
      const vp = vpRef.current; if (!vp) return;
      const cx = vp.clientWidth / 2, cy = vp.clientHeight / 2;
      setAnimate(true);
      setViewFor(compRef.current, (v) => { const k = clamp(v.k * f, 0.15, 2.5); return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k }; });
    };

    useLayoutEffect(() => {
      if (!views[compId]) {
        fit(false, true);
        const id = setTimeout(() => fit(false, true), 250); // Tailwind CDN may style late; refit once
        return () => clearTimeout(id);
      }
    }, [compId]);

    useLayoutEffect(() => {
      if (!pendingFocus) return;
      const root = worldRef.current, vp = vpRef.current;
      const el = root && root.querySelector(`[data-mid="${pendingFocus}"]`);
      setPendingFocus(null);
      if (!el || !vp) return;
      const wp = worldPos(el, root);
      const cur = views[compId] || { k: 1 };
      const k = Math.max(cur.k, 0.9);
      setAnimate(true);
      // place card so card + popover (350px) are centred horizontally, card in the upper third
      const left = Math.max(16, (vp.clientWidth - (wp.w * k + 360)) / 2);
      const top = Math.max(56, vp.clientHeight / 3 - (wp.h * k) / 2);
      setViewFor(compId, { k, x: left - wp.x * k, y: top - wp.y * k });
      setSelected({ id: el.getAttribute('data-mid'), ...wp });
      setFlashId(el.getAttribute('data-mid'));
    }, [pendingFocus, compId]);

    useEffect(() => { if (!flashId) return; const id = setTimeout(() => setFlashId(null), 2500); return () => clearTimeout(id); }, [flashId]);

    useEffect(() => {
      const el = vpRef.current;
      const onWheel = (e) => {
        e.preventDefault();
        setAnimate(false);
        const r = el.getBoundingClientRect();
        const cx = e.clientX - r.left, cy = e.clientY - r.top;
        const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
        setViews((s) => {
          const id = compRef.current, v = s[id] || { x: 0, y: 0, k: 1 };
          const k = clamp(v.k * f, 0.15, 2.5);
          return { ...s, [id]: { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k } };
        });
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
    }, []);

    useEffect(() => {
      const onKey = (e) => {
        if (e.key === 'Escape') { setSelected(null); setGroupDetail(null); setTablesFull(false); return; }
        if (e.target.closest && e.target.closest('input, textarea, select')) return;
        if (e.key === '+' || e.key === '=') zoomBy(1.25);
        else if (e.key === '-') zoomBy(0.8);
        else if (e.key === 'f' || e.key === '0') fit();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    });

    const focusMatch = (id) => {
      const m = t.matchById[id];
      if (!m) return;
      setTablesFull(false);
      if (m.comp !== compId) setSelected(null);
      setCompId(m.comp);
      setPendingFocus(id);
    };
    const switchComp = (id) => { setSelected(null); setCompId(id); };

    const onPointerDown = (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('[data-card],[data-nopan],button,input,select')) return;
      drag.current = { sx: e.clientX, sy: e.clientY, x: view.x, y: view.y, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
      setAnimate(false);
    };
    const onPointerMove = (e) => {
      const d = drag.current; if (!d) return;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) { d.moved = true; setDragging(true); }
      if (d.moved) setViewFor(compId, (v) => ({ ...v, x: d.x + dx, y: d.y + dy }));
    };
    const onPointerUp = () => {
      const d = drag.current; drag.current = null; setDragging(false);
      if (d && !d.moved) setSelected(null);
    };

    const ctx = {
      now: t.now, selectedId: selected && selected.id, flashId, liveByPlayer, projected,
      open: (m, el) => { setAnimate(false); setSelected({ id: m.id, ...worldPos(el, worldRef.current) }); },
      openGroup: (stageId, g) => setGroupDetail({ stageId, g }),
    };

    const sel = selected && t.matchById[selected.id];
    let popStyle = null;
    if (sel && sel.comp === compId && vpRef.current) {
      const vw = vpRef.current.clientWidth, vh = vpRef.current.clientHeight;
      const sx = view.x + selected.x * view.k, sy = view.y + selected.y * view.k, sw = selected.w * view.k;
      let left = sx + sw + 10;
      if (left + 350 > vw) left = Math.max(8, sx - 350);
      const top = clamp(sy - 10, 8, Math.max(8, vh - 470));
      popStyle = { left, top, maxHeight: vh - top - 8, overflowY: 'auto' };
    }

    const hasGroups = comp.stages.some((s) => s.type === 'groups');
    const grid = 24 * view.k;
    return html`<${VC.Provider} value=${ctx}>
      <style>${CSS}</style>
      <div className="h-full flex flex-col bg-slate-100 text-slate-900 text-[13px] overflow-hidden">
        <${Header} compId=${compId} setComp=${switchComp} onFocus=${focusMatch} />
        <div className="flex-1 flex min-h-0">
          <${TablesPanel} open=${leftOpen} setOpen=${setLeftOpen} onFocus=${focusMatch} onFull=${() => setTablesFull(true)} />
          <main className="relative flex-1 min-w-0 overflow-hidden">
            <div ref=${vpRef} className="absolute inset-0 a-grid touch-none"
                style=${{ cursor: dragging ? 'grabbing' : 'grab', backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
                onPointerDown=${onPointerDown} onPointerMove=${onPointerMove} onPointerUp=${onPointerUp} onPointerCancel=${onPointerUp}>
              <div ref=${worldRef} className="absolute left-0 top-0 w-max"
                  style=${{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: '0 0', transition: animate ? 'transform 320ms cubic-bezier(.2,.7,.2,1)' : 'none' }}>
                ${hasGroups ? html`<${GroupsKOWorld} comp=${comp} />` : html`<${DEWorld} comp=${comp} />`}
              </div>
            </div>
            <div className="absolute left-3 top-3 z-10 pointer-events-none flex items-center gap-2 text-[11px] text-slate-500 bg-white/80 rounded-md px-2 py-1 ring-1 ring-slate-200">
              <span className="w-2.5 h-2.5 rounded-full" style=${{ background: comp.color }}></span><b className="text-slate-700">${comp.name}</b>
              <span>· drag to pan · wheel / pinch to zoom · F fit · click a match for actions</span>
            </div>
            <${Legend} />
            <div data-nopan="1" className="absolute right-3 bottom-3 z-10 flex items-center bg-white rounded-lg shadow ring-1 ring-slate-200 text-[13px]">
              <button onClick=${() => zoomBy(0.8)} className="w-8 h-8 hover:bg-slate-100 rounded-l-lg font-bold">−</button>
              <button onClick=${() => { setAnimate(true); const vp = vpRef.current; const cx = vp.clientWidth / 2, cy = vp.clientHeight / 2; setViewFor(compId, (v) => ({ k: 1, x: cx - ((cx - v.x) * 1) / v.k, y: cy - ((cy - v.y) * 1) / v.k })); }} className="w-12 h-8 hover:bg-slate-100 tabular-nums text-[11px]" title="Reset to 100%">${Math.round(view.k * 100)}%</button>
              <button onClick=${() => zoomBy(1.25)} className="w-8 h-8 hover:bg-slate-100 font-bold">+</button>
              <button onClick=${() => fit()} className="px-3 h-8 hover:bg-slate-100 rounded-r-lg border-l border-slate-200 font-semibold text-[12px]">Fit</button>
            </div>
            ${popStyle ? html`<${MatchPopover} key=${sel.id} m=${sel} style=${popStyle} onClose=${() => setSelected(null)} />` : null}
            ${tablesFull ? html`<${TablesFull} onClose=${() => setTablesFull(false)} onFocus=${focusMatch} />` : null}
          </main>
          <${QueuePanel} open=${rightOpen} setOpen=${setRightOpen} compId=${compId} mode=${queueMode} setMode=${setQueueMode} onFocus=${focusMatch} />
        </div>
        <${BottomDrawer} open=${bottomOpen} setOpen=${setBottomOpen} onFocus=${focusMatch} />
      </div>
      ${groupDetail ? html`<${GroupModal} stageId=${groupDetail.stageId} g=${groupDetail.g} onClose=${() => setGroupDetail(null)} onFocus=${focusMatch} />` : null}
    <//>`;
  }

  window.Variants.push({ key: 'A', name: 'Infinite canvas', Component: VariantA });
})();
