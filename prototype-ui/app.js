// PROTOTYPE — mounts the variant chosen by ?variant= plus the switcher.
(function () {
  const { useState } = React;
  const { html, Provider, PrototypeSwitcher } = window.Proto;
  const variants = [...window.Variants].sort((a, b) => a.key.localeCompare(b.key));

  function App() {
    const [key, setKey] = useState(() => new URLSearchParams(location.search).get('variant') || variants[0].key);
    const change = (k) => {
      const u = new URL(location.href);
      u.searchParams.set('variant', k);
      history.replaceState(null, '', u);
      setKey(k);
    };
    const V = (variants.find((v) => v.key === key) || variants[0]).Component;
    return html`<${Provider}><${V} key=${key} /><${PrototypeSwitcher} variants=${variants} current=${key} onChange=${change} /><//>`;
  }

  ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
})();
