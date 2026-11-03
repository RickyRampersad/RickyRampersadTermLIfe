/* HELP 868: floating WhatsApp button. One number, one place: change it here only. */
(function () {
  var NUMBER = '18684357868';
  if (document.getElementById('h868-chat')) return;
  var css = '#h868-chat{position:fixed;right:max(1rem,env(safe-area-inset-right));bottom:max(1rem,env(safe-area-inset-bottom));z-index:60;display:flex;align-items:center;gap:.55rem;min-height:3rem;padding:.7rem 1.05rem .7rem .85rem;border-radius:999px;background:#17784a;color:#fff;font:600 .9375rem/1.2 Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;text-decoration:none;box-shadow:0 .5rem 1.4rem hsl(32deg 20% 42% / .35)}' +
    '#h868-chat:hover{background:#12643d}#h868-chat:focus-visible{outline:3px solid #0d3f5e;outline-offset:3px}' +
    '#h868-chat svg{width:1.5rem;height:1.5rem;flex:none;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '@media (max-width:30rem){#h868-chat span small{display:none}}' +
    '@media print{#h868-chat{display:none}}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
  var a = document.createElement('a');
  a.id = 'h868-chat';
  a.href = 'https://wa.me/' + NUMBER + '?text=' + encodeURIComponent('Hi HELP 868');
  a.target = '_blank';
  a.rel = 'noopener';
  a.setAttribute('aria-label', 'Chat with HELP 868 on WhatsApp');
  a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.2A8.5 8.5 0 1 1 21 11.5z"/><path d="M8.8 8.6c.3 2.6 2.7 5 5.4 5.6l1.2-1.3-1.9-.9-.8.7c-.9-.4-1.9-1.4-2.3-2.3l.7-.8-.9-1.9z"/></svg><span>Chat on WhatsApp <small>· HELP 868</small></span>';
  document.body.appendChild(a);
})();
