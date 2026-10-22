// PROTOTYPE — floating variant switcher. Cycles ?variant= with arrows or ←/→ keys.
(function () {
  const { useEffect } = React;
  const { html } = window.Proto;

  function PrototypeSwitcher({ variants, current, onChange }) {
    const keys = variants.map((v) => v.key);
    const i = Math.max(0, keys.indexOf(current));
    const go = (d) => onChange(keys[(i + d + keys.length) % keys.length]);
    useEffect(() => {
      const onKey = (e) => {
        const t = e.target;
        if (t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    });
    const btn = 'w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-lg';
    return html`
      <div style=${{ zIndex: 99999 }} className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-2 py-1 rounded-full bg-black text-white shadow-2xl ring-2 ring-yellow-400 font-mono text-sm select-none">
        <button className=${btn} onClick=${() => go(-1)}>‹</button>
        <span className="px-2">PROTOTYPE ${variants[i].key} <span className="text-yellow-300">(${variants[i].name})</span></span>
        <button className=${btn} onClick=${() => go(1)}>›</button>
      </div>`;
  }

  window.Proto.PrototypeSwitcher = PrototypeSwitcher;
})();
