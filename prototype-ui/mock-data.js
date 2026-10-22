// PROTOTYPE — throwaway mock data for UI variants. Wipe me.
// Builds a mid-tournament snapshot: Men's Open (4 groups of 4 -> 8-player single elim)
// and U15 Boys (16-player double elim per the Polish sheet, with optional place play-offs).
// Times are offsets in minutes BEFORE page load; store.js converts them to timestamps.
(function () {
  const clubs = ['KS Start', 'AZS Kraków', 'MKS Lublin', 'UKS Orlik', 'LKS Gwiazda', 'KTS Toruń'];
  const adults = [
    'Jan Kowalski', 'Piotr Nowak', 'Tomasz Wiśniewski', 'Marek Wójcik', 'Paweł Kamiński',
    'Michał Lewandowski', 'Krzysztof Zieliński', 'Adam Szymański', 'Łukasz Woźniak',
    'Grzegorz Dąbrowski', 'Rafał Kozłowski', 'Jakub Jankowski', 'Dariusz Mazur', 'Kamil Kwiatkowski',
  ];
  const juniors = [
    'Filip Grabowski', 'Antoni Nowakowski', 'Szymon Pawłowski', 'Kacper Michalski', 'Igor Nowicki',
    'Franciszek Adamczyk', 'Wojciech Dudek', 'Oliwier Zając', 'Aleksander Wieczorek',
    'Nikodem Jabłoński', 'Stanisław Król', 'Leon Majewski', 'Bartosz Olszewski', 'Hubert Jaworski',
    'Mikołaj Malinowski', 'Tymon Pawlak',
  ];

  const players = [];
  const mk = (full, i, prefix) => {
    const [first, last] = full.split(' ');
    const p = { id: prefix + (i + 1), first, last, club: clubs[(i * 7 + prefix.length) % clubs.length], rating: 2000 - i * 37 };
    players.push(p);
    return p.id;
  };
  const adultIds = adults.map((n, i) => mk(n, i, 'a'));
  const juniorIds = juniors.map((n, i) => mk(n, i, 'j'));

  // Open entries by seed 1..16: 14 adults + two juniors (j3 Szymon, j8 Oliwier) also play U15.
  const openSeeds = [...adultIds.slice(0, 12), 'j3', adultIds[12], adultIds[13], 'j8'];
  // U15 seeds 1..16 = juniors in order.
  const u15Seeds = juniorIds;

  const tables = Array.from({ length: 10 }, (_, i) => ({
    id: 'T' + (i + 1), number: i + 1, name: i === 0 ? 'Centre court' : i === 9 ? 'Side hall' : '', active: i !== 9,
  }));

  const matches = [];
  const add = (m) => { matches.push({ state: 'scheduled', gamesToWin: 3, ...m }); return m.id; };
  const P = (id) => ({ player: id });
  const W = (match) => ({ from: { match, take: 'winner' } });
  const L = (match) => ({ from: { match, take: 'loser' } });

  // Score helpers: deterministic plausible game scores. side = 'A' or 'B' winner.
  const scores = {
    '3:0': [[11, 6], [11, 8], [11, 4]],
    '3:1': [[11, 7], [9, 11], [11, 5], [11, 8]],
    '3:2': [[11, 9], [8, 11], [11, 13], [11, 6], [12, 10]],
  };
  const flip = (g) => g.map(([x, y]) => [y, x]);
  const result = (side, kind) => (side === 'A' ? scores[kind] : flip(scores[kind]));

  // ---------- Men's Open: groups ----------
  const groups = { A: [1, 8, 9, 16], B: [2, 7, 10, 15], C: [3, 6, 11, 14], D: [4, 5, 12, 13] }; // snake by seed
  const berger = [[[1, 4], [2, 3]], [[1, 3], [2, 4]], [[1, 2], [3, 4]]];
  let genericFinish = 0;
  const finished = (side, kind, table, overrides = {}) => {
    genericFinish += 1;
    const end = overrides.endOff ?? 45 + genericFinish * 4;
    const dur = overrides.dur ?? 15 + ((genericFinish * 7) % 16);
    return { state: 'finished', games: result(side, kind), table, startOff: end + dur, endOff: end };
  };

  const groupPlan = {
    // [round][pair] -> state
    A: [[finished('A', '3:0', 'T1'), finished('A', '3:1', 'T2')], [finished('A', '3:1', 'T1', { endOff: 2, dur: 22 }), finished('B', '3:2', 'T4', { endOff: 6, dur: 31 })], [{}, {}]],
    B: [[finished('A', '3:1', 'T3'), finished('A', '3:0', 'T4')], [{ state: 'in_progress', table: 'T2', startOff: 12 }, { state: 'in_progress', table: 'T3', startOff: 29 }], [{}, {}]],
    C: [[finished('A', '3:2', 'T5'), finished('B', '3:1', 'T6')], [finished('A', '3:0', 'T9', { endOff: 1, dur: 19 }), { state: 'in_progress', table: 'T5', startOff: 41 }], [{}, {}]],
    D: [[finished('A', '3:1', 'T7'), finished('A', '3:2', 'T8', { dur: 38 })], [{}, {}], [{}, {}]],
  };

  for (const g of Object.keys(groups)) {
    berger.forEach((round, r) => {
      round.forEach(([x, y], k) => {
        add({
          id: `open-${g}-${r + 1}${k + 1}`, comp: 'open', stage: 'open-groups', group: g,
          section: 'group', round: r + 1, order: k, label: `${g}${x}–${g}${y}`,
          a: P(openSeeds[groups[g][x - 1] - 1]), b: P(openSeeds[groups[g][y - 1] - 1]),
          ...groupPlan[g][r][k],
        });
      });
    });
  }

  // ---------- Men's Open: 8-player single elim from groups ----------
  // Seed table for 8: 1,8,5,4,3,6,7,2 -> 1A top, 1B bottom, 1C seed 3, 1D seed 4; 2X in opposite half of 1X.
  const G = (place, group) => ({ placeholder: `${place}${group}`, origin: { group, place } });
  const ko = { comp: 'open', stage: 'open-ko', section: 'main' };
  add({ ...ko, id: 'open-QF1', round: 1, order: 0, label: 'QF1', a: G(1, 'A'), b: G(2, 'B') });
  add({ ...ko, id: 'open-QF2', round: 1, order: 1, label: 'QF2', a: G(2, 'C'), b: G(1, 'D') });
  add({ ...ko, id: 'open-QF3', round: 1, order: 2, label: 'QF3', a: G(1, 'C'), b: G(2, 'D') });
  add({ ...ko, id: 'open-QF4', round: 1, order: 3, label: 'QF4', a: G(2, 'A'), b: G(1, 'B') });
  add({ ...ko, id: 'open-SF1', round: 2, order: 0, label: 'SF1', a: W('open-QF1'), b: W('open-QF2') });
  add({ ...ko, id: 'open-SF2', round: 2, order: 1, label: 'SF2', a: W('open-QF3'), b: W('open-QF4') });
  add({ ...ko, id: 'open-F', round: 3, order: 0, label: 'Final', a: W('open-SF1'), b: W('open-SF2'), places: { winner: '1', loser: '2' } });
  add({ ...ko, id: 'open-3rd', section: 'third', round: 3, order: 1, label: '3rd place', a: L('open-SF1'), b: L('open-SF2'), places: { winner: '3', loser: '4' } });

  // ---------- U15: 16-player double elim (Polish sheet) ----------
  const de = { comp: 'u15', stage: 'u15-de' };
  const S = (seed) => P(u15Seeds[seed - 1]);
  const r1 = [[1, 16], [9, 8], [5, 12], [13, 4], [3, 14], [11, 6], [7, 10], [15, 2]];
  const r1Results = ['A', 'B', 'A', 'B', 'A', 'A' /* 11 upsets 6 */, 'A', 'B'];
  r1.forEach(([x, y], i) => add({
    ...de, id: `u15-M${i + 1}`, section: 'winners', round: 1, order: i, label: `M${i + 1}`,
    a: S(x), b: S(y), places: {}, ...finished(r1Results[i], i % 3 === 0 ? '3:0' : '3:1', `T${(i % 8) + 1}`),
  }));
  add({ ...de, id: 'u15-A', section: 'winners', round: 2, order: 0, label: 'A', a: W('u15-M1'), b: W('u15-M2'), ...finished('A', '3:1', 'T6') });
  add({ ...de, id: 'u15-B', section: 'winners', round: 2, order: 1, label: 'B', a: W('u15-M3'), b: W('u15-M4'), ...finished('B', '3:2', 'T8', { endOff: 14, dur: 27 }) });
  add({ ...de, id: 'u15-C', section: 'winners', round: 2, order: 2, label: 'C', a: W('u15-M5'), b: W('u15-M6'), state: 'in_progress', table: 'T6', startOff: 8 });
  add({ ...de, id: 'u15-D', section: 'winners', round: 2, order: 3, label: 'D', a: W('u15-M7'), b: W('u15-M8') });
  add({ ...de, id: 'u15-E', section: 'winners', round: 3, order: 0, label: 'E', a: W('u15-A'), b: W('u15-B') });
  add({ ...de, id: 'u15-F', section: 'winners', round: 3, order: 1, label: 'F', a: W('u15-C'), b: W('u15-D') });
  add({ ...de, id: 'u15-G', section: 'winners', round: 4, order: 0, label: 'G', a: W('u15-E'), b: W('u15-F'), places: { winner: '1' } });

  add({ ...de, id: 'u15-L1', section: 'losers', round: 1, order: 0, label: 'L1', a: L('u15-M1'), b: L('u15-M2'), places: { loser: '13–16' }, ...finished('B', '3:1', 'T7') });
  add({ ...de, id: 'u15-L2', section: 'losers', round: 1, order: 1, label: 'L2', a: L('u15-M3'), b: L('u15-M4'), places: { loser: '13–16' }, ...finished('A', '3:2', 'T3') });
  add({ ...de, id: 'u15-L3', section: 'losers', round: 1, order: 2, label: 'L3', a: L('u15-M5'), b: L('u15-M6'), places: { loser: '13–16' }, state: 'in_progress', table: 'T7', startOff: 18 });
  add({ ...de, id: 'u15-L4', section: 'losers', round: 1, order: 3, label: 'L4', a: L('u15-M7'), b: L('u15-M8'), places: { loser: '13–16' } });
  // LR2: drop-ins crossed (D, C, B, A)
  add({ ...de, id: 'u15-L5', section: 'losers', round: 2, order: 0, label: 'L5', a: W('u15-L1'), b: L('u15-D'), places: { loser: '9–12' } });
  add({ ...de, id: 'u15-L6', section: 'losers', round: 2, order: 1, label: 'L6', a: W('u15-L2'), b: L('u15-C'), places: { loser: '9–12' } });
  add({ ...de, id: 'u15-L7', section: 'losers', round: 2, order: 2, label: 'L7', a: W('u15-L3'), b: L('u15-B'), places: { loser: '9–12' } });
  add({ ...de, id: 'u15-L8', section: 'losers', round: 2, order: 3, label: 'L8', a: W('u15-L4'), b: L('u15-A'), places: { loser: '9–12' } });
  add({ ...de, id: 'u15-L9', section: 'losers', round: 3, order: 0, label: 'L9', a: W('u15-L5'), b: W('u15-L6'), places: { loser: '7–8' } });
  add({ ...de, id: 'u15-L10', section: 'losers', round: 3, order: 1, label: 'L10', a: W('u15-L7'), b: W('u15-L8'), places: { loser: '7–8' } });
  // LR4: E/F drop-ins crossed too (F into top, E into bottom)
  add({ ...de, id: 'u15-L11', section: 'losers', round: 4, order: 0, label: 'L11', a: W('u15-L9'), b: L('u15-F'), places: { loser: '5–6' } });
  add({ ...de, id: 'u15-L12', section: 'losers', round: 4, order: 1, label: 'L12', a: W('u15-L10'), b: L('u15-E'), places: { loser: '5–6' } });
  add({ ...de, id: 'u15-L13', section: 'losers', round: 5, order: 0, label: 'L13', a: W('u15-L11'), b: W('u15-L12'), places: { loser: '4' } });
  add({ ...de, id: 'u15-2F', section: 'second-final', round: 6, order: 0, label: '2nd final', a: L('u15-G'), b: W('u15-L13'), places: { winner: '2', loser: '3' } });

  // Place play-offs (optional, manager toggles). Only 13–16 is enabled in this snapshot.
  const po = (id, playoff, round, order, label, a, b, places) =>
    add({ ...de, id, section: 'playoff', playoff, round, order, label, a, b, places });
  po('u15-P5', '5–6', 1, 0, '5–6', L('u15-L11'), L('u15-L12'), { winner: '5', loser: '6' });
  po('u15-P7', '7–8', 1, 0, '7–8', L('u15-L9'), L('u15-L10'), { winner: '7', loser: '8' });
  po('u15-P9a', '9–12', 1, 0, '9–12 SF1', L('u15-L5'), L('u15-L6'));
  po('u15-P9b', '9–12', 1, 1, '9–12 SF2', L('u15-L7'), L('u15-L8'));
  po('u15-P9w', '9–12', 2, 0, '9–10', W('u15-P9a'), W('u15-P9b'), { winner: '9', loser: '10' });
  po('u15-P9l', '9–12', 2, 1, '11–12', L('u15-P9a'), L('u15-P9b'), { winner: '11', loser: '12' });
  po('u15-P13a', '13–16', 1, 0, '13–16 SF1', L('u15-L1'), L('u15-L2'));
  po('u15-P13b', '13–16', 1, 1, '13–16 SF2', L('u15-L3'), L('u15-L4'));
  po('u15-P13w', '13–16', 2, 0, '13–14', W('u15-P13a'), W('u15-P13b'), { winner: '13', loser: '14' });
  po('u15-P13l', '13–16', 2, 1, '15–16', L('u15-P13a'), L('u15-P13b'), { winner: '15', loser: '16' });

  window.MOCK = {
    tournament: { id: 't1', name: 'Grand Prix Lublin 2026', date: '2026-10-24', venue: 'Hala MOSiR' },
    players,
    tables,
    competitions: [
      {
        id: 'open', name: "Men's Open", short: 'OPEN', color: '#2563eb', gamesToWin: 3,
        stages: [
          { id: 'open-groups', type: 'groups', name: 'Groups', groups: Object.fromEntries(Object.entries(groups).map(([g, seeds]) => [g, seeds.map((s) => openSeeds[s - 1])])), advance: 2 },
          { id: 'open-ko', type: 'single_elim', name: 'Main bracket', size: 8, thirdPlace: true, feedsFrom: 'open-groups' },
        ],
      },
      {
        id: 'u15', name: 'U15 Boys', short: 'U15', color: '#db2777', gamesToWin: 3,
        stages: [
          { id: 'u15-de', type: 'double_elim', name: 'Double elimination', size: 16, playoffs: ['5–6', '7–8', '9–12', '13–16'] },
        ],
      },
    ],
    playoffsEnabled: { 'u15:13–16': true, 'u15:5–6': false, 'u15:7–8': false, 'u15:9–12': false },
    expectedMinutes: { 2: 15, 3: 25, 4: 35 },
    matches,
  };
})();
