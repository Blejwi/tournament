// PROTOTYPE — in-memory store shared by all UI variants. No persistence.
// Exposes window.Proto = { Provider, useTournament, html } (html = htm bound to React.createElement).
(function () {
  const { createContext, useContext, useState, useEffect, useMemo, useCallback } = React;
  const html = htm.bind(React.createElement);
  const Ctx = createContext(null);
  const MIN = 60000;

  function initState(mock) {
    const t0 = Date.now();
    const matches = mock.matches.map((m) => ({
      ...m,
      startedAt: m.startOff != null ? t0 - m.startOff * MIN : null,
      finishedAt: m.endOff != null ? t0 - m.endOff * MIN : null,
    }));
    return { matches, tables: mock.tables, playoffsEnabled: { ...mock.playoffsEnabled }, log: [] };
  }

  const gamesWon = (games) => games.reduce((acc, [x, y]) => (x > y ? [acc[0] + 1, acc[1]] : [acc[0], acc[1] + 1]), [0, 0]);

  // Parse "11-7 9-11 11-5" (also accepts "11:7,9:11"). Returns { games } or { error }.
  function parseScore(str, gamesToWin = 3) {
    const parts = str.trim().split(/[\s,;]+/).filter(Boolean);
    if (!parts.length) return { error: 'Enter game scores, e.g. 11-7 9-11 11-5' };
    const games = [];
    let wa = 0, wb = 0;
    for (const p of parts) {
      const m = p.match(/^(\d{1,2})[-:](\d{1,2})$/);
      if (!m) return { error: `"${p}" is not a game score` };
      const x = +m[1], y = +m[2];
      const hi = Math.max(x, y), lo = Math.min(x, y);
      if (hi < 11 || hi - lo < 2 || (hi > 11 && hi - lo !== 2)) return { error: `${x}-${y} is not a valid game` };
      if (wa === gamesToWin || wb === gamesToWin) return { error: 'Too many games — match was already decided' };
      x > y ? wa++ : wb++;
      games.push([x, y]);
    }
    if (wa !== gamesToWin && wb !== gamesToWin) return { error: `Match not finished — someone must win ${gamesToWin} games` };
    return { games };
  }

  // Two passes: first derive group standings, then resolve "1A"-style placeholders from completed groups.
  function derive(state, mock, now) {
    const first = deriveOnce(state, mock, now, {});
    const groupPlaces = {};
    Object.values(first.standings).forEach((gs) => Object.entries(gs).forEach(([g, s]) => {
      if (s.complete) s.rows.forEach((r) => (groupPlaces[`${r.place}${g}`] = r.player));
    }));
    return deriveOnce(state, mock, now, groupPlaces);
  }

  function deriveOnce(state, mock, now, groupPlaces) {
    const playerById = Object.fromEntries(mock.players.map((p) => [p.id, p]));
    const compById = Object.fromEntries(mock.competitions.map((c) => [c.id, c]));
    const stageIndex = {};
    mock.competitions.forEach((c) => c.stages.forEach((s, i) => (stageIndex[s.id] = i)));
    const byId = {};
    const out = [];

    const resolve = (slot) => {
      if (slot.player) return { player: playerById[slot.player], label: null };
      if (slot.placeholder) return { player: groupPlaces[slot.placeholder] || null, label: slot.placeholder, origin: slot.origin };
      const src = byId[slot.from.match];
      const p = src && src.result ? (slot.from.take === 'winner' ? src.result.winner : src.result.loser) : null;
      const label = (slot.from.take === 'winner' ? 'W ' : 'L ') + (src ? src.label : slot.from.match);
      return { player: p || null, label, fromMatch: slot.from.match, take: slot.from.take };
    };

    for (const m of state.matches) {
      const a = resolve(m.a), b = resolve(m.b);
      let result = null;
      if (m.state === 'finished') {
        const [ga, gb] = m.walkover ? (m.walkover === 'A' ? [1, 0] : [0, 1]) : gamesWon(m.games);
        const winSide = ga > gb ? 'A' : 'B';
        result = {
          winSide, gamesA: m.walkover ? null : ga, gamesB: m.walkover ? null : gb, walkover: !!m.walkover,
          winner: winSide === 'A' ? a.player : b.player, loser: winSide === 'A' ? b.player : a.player,
        };
      }
      const playoffKey = m.playoff ? `${m.comp}:${m.playoff}` : null;
      const d = {
        ...m, a, b, result, competition: compById[m.comp], stageIndex: stageIndex[m.stage],
        playoffEnabled: playoffKey ? !!state.playoffsEnabled[playoffKey] : null,
        expectedMin: mock.expectedMinutes[m.gamesToWin] || 25,
      };
      byId[m.id] = d;
      out.push(d);
    }

    const playing = new Set();
    out.forEach((m) => { if (m.state === 'in_progress') { m.a.player && playing.add(m.a.player.id); m.b.player && playing.add(m.b.player.id); } });

    for (const m of out) {
      if (m.state === 'finished') m.status = m.result.walkover ? 'walkover' : 'finished';
      else if (m.state === 'in_progress') {
        m.elapsedMin = (now - m.startedAt) / MIN;
        m.overdue = m.elapsedMin > m.expectedMin * 1.5 ? 2 : m.elapsedMin > m.expectedMin ? 1 : 0;
        m.status = m.overdue ? 'overdue' : 'in_progress';
      } else if (m.playoff && !m.playoffEnabled) m.status = 'disabled';
      else if (!m.a.player || !m.b.player) m.status = 'pending';
      else if (playing.has(m.a.player.id) || playing.has(m.b.player.id)) m.status = 'busy';
      else m.status = 'ready';
      if (m.state === 'finished') m.durationMin = (m.finishedAt - m.startedAt) / MIN;
    }

    // Ready-since: when the later of the two feeders finished (fallback: page load).
    for (const m of out) {
      if (m.status !== 'ready' && m.status !== 'busy') continue;
      const feeders = [m.a.fromMatch, m.b.fromMatch].filter(Boolean).map((id) => byId[id]);
      m.readySince = feeders.length ? Math.max(...feeders.map((f) => f.finishedAt || 0)) : null;
    }

    const queue = out
      .filter((m) => m.status === 'ready' || m.status === 'busy')
      .sort((x, y) =>
        (x.status === 'busy') - (y.status === 'busy') ||
        (x.section === 'playoff') - (y.section === 'playoff') ||
        x.stageIndex - y.stageIndex || x.round - y.round || (x.readySince || 0) - (y.readySince || 0) || x.order - y.order);

    const tables = state.tables.map((t) => {
      const current = out.find((m) => m.state === 'in_progress' && m.table === t.id) || null;
      const lastEnd = Math.max(0, ...out.filter((m) => m.table === t.id && m.finishedAt).map((m) => m.finishedAt));
      return {
        ...t,
        status: !t.active ? 'inactive' : current ? (current.overdue ? 'overdue' : 'playing') : 'free',
        match: current,
        idleMin: !current && t.active && lastEnd ? (now - lastEnd) / MIN : null,
        matchesPlayed: out.filter((m) => m.table === t.id && m.state === 'finished').length,
      };
    });

    // Group standings (prototype: wins, then game ratio, then point ratio; real app uses full ITTF rules).
    const standings = {};
    mock.competitions.forEach((c) => c.stages.filter((s) => s.type === 'groups').forEach((s) => {
      standings[s.id] = {};
      Object.entries(s.groups).forEach(([g, ids]) => {
        const rows = ids.map((id) => ({ player: playerById[id], played: 0, won: 0, lost: 0, gf: 0, ga: 0, pf: 0, pa: 0, pts: 0 }));
        const row = (id) => rows.find((r) => r.player.id === id);
        out.filter((m) => m.stage === s.id && m.group === g && m.result).forEach((m) => {
          const ra = row(m.a.player.id), rb = row(m.b.player.id);
          ra.played++; rb.played++;
          const aw = m.result.winSide === 'A';
          (aw ? ra : rb).won++; (aw ? rb : ra).lost++;
          (aw ? ra : rb).pts += 1;
          if (m.games) m.games.forEach(([x, y]) => {
            ra.pf += x; ra.pa += y; rb.pf += y; rb.pa += x;
            if (x > y) { ra.gf++; rb.ga++; } else { rb.gf++; ra.ga++; }
          });
        });
        const ratio = (f, a) => (a === 0 ? (f ? Infinity : 0) : f / a);
        rows.sort((x, y) => y.pts - x.pts || ratio(y.gf, y.ga) - ratio(x.gf, x.ga) || ratio(y.pf, y.pa) - ratio(x.pf, x.pa));
        rows.forEach((r, i) => (r.place = i + 1));
        const groupMatches = out.filter((m) => m.stage === s.id && m.group === g);
        standings[s.id][g] = { rows, complete: groupMatches.every((m) => m.result), matches: groupMatches };
      });
    }));

    const done = out.filter((m) => m.durationMin != null && !m.walkover);
    const avg = (arr) => (arr.length ? arr.reduce((s, m) => s + m.durationMin, 0) / arr.length : 0);
    const stats = {
      finished: out.filter((m) => m.result).length,
      total: out.filter((m) => m.status !== 'disabled').length,
      avgDurationMin: avg(done),
      byCompetition: mock.competitions.map((c) => ({ competition: c, avgMin: avg(done.filter((m) => m.comp === c.id)), finished: out.filter((m) => m.comp === c.id && m.result).length, total: out.filter((m) => m.comp === c.id && m.status !== 'disabled').length })),
      longest: [...done].sort((x, y) => y.durationMin - x.durationMin).slice(0, 5),
    };

    return { matches: out, matchById: byId, queue, tables, standings, stats, playerById, compById };
  }

  function Provider({ children }) {
    const mock = window.MOCK;
    const [state, setState] = useState(() => initState(mock));
    const [now, setNow] = useState(Date.now());
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

    const log = (s, text) => ({ ...s, log: [{ at: Date.now(), text }, ...s.log] });
    const patch = (s, id, fn) => ({ ...s, matches: s.matches.map((m) => (m.id === id ? fn(m) : m)) });

    const actions = useMemo(() => ({
      assign: (matchId, tableId) => setState((s) => log(patch(s, matchId, (m) => ({ ...m, state: 'in_progress', table: tableId, startedAt: Date.now() })), `${matchId} → ${tableId}`)),
      unassign: (matchId) => setState((s) => log(patch(s, matchId, (m) => ({ ...m, state: 'scheduled', table: null, startedAt: null })), `${matchId} taken off table`)),
      enterScore: (matchId, games) => setState((s) => log(patch(s, matchId, (m) => ({ ...m, state: 'finished', games, walkover: null, finishedAt: m.finishedAt || Date.now(), startedAt: m.startedAt || Date.now() })), `${matchId} score ${games.map((g) => g.join('-')).join(' ')}`)),
      walkover: (matchId, winnerSide) => setState((s) => log(patch(s, matchId, (m) => ({ ...m, state: 'finished', games: null, walkover: winnerSide, finishedAt: Date.now(), startedAt: m.startedAt || Date.now() })), `${matchId} walkover → ${winnerSide}`)),
      setStartedMinutesAgo: (matchId, min) => setState((s) => patch(s, matchId, (m) => ({ ...m, startedAt: Date.now() - min * MIN }))),
      togglePlayoff: (compId, playoff) => setState((s) => { const k = `${compId}:${playoff}`; return log({ ...s, playoffsEnabled: { ...s.playoffsEnabled, [k]: !s.playoffsEnabled[k] } }, `play-off ${k} ${s.playoffsEnabled[k] ? 'off' : 'on'}`); }),
      toggleTable: (tableId) => setState((s) => ({ ...s, tables: s.tables.map((t) => (t.id === tableId ? { ...t, active: !t.active } : t)) })),
    }), []);

    const derived = useMemo(() => derive(state, mock, now), [state, now]);
    const value = useMemo(() => ({
      tournament: mock.tournament, competitions: mock.competitions, players: mock.players, log: state.log,
      now, actions, parseScore, ...derived,
    }), [derived, state.log, now]);
    return html`<${Ctx.Provider} value=${value}>${children}<//>`;
  }

  const useTournament = () => useContext(Ctx);

  // Formatting helpers
  const fmt = {
    name: (p) => (p ? `${p.first[0]}. ${p.last}` : null),
    fullName: (p) => (p ? `${p.first} ${p.last}` : null),
    clock: (min) => { if (min == null) return ''; const s = Math.max(0, Math.floor(min * 60)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; },
    mins: (min) => (min == null ? '' : `${Math.round(min)} min`),
    games: (m) => (m.result ? (m.result.walkover ? 'w.o.' : `${m.result.gamesA}:${m.result.gamesB}`) : ''),
    gameList: (m) => (m.games ? m.games.map(([x, y]) => `${x}-${y}`).join(' ') : ''),
  };

  // Debug: inspect the derived snapshot from the console.
  const debugSnapshot = () => derive(initState(window.MOCK), window.MOCK, Date.now());
  window.Proto = { Provider, useTournament, html, fmt, debugSnapshot };
})();
