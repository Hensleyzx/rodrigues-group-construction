(() => {
  'use strict';

  const THEME_KEY = 'rgc-owner-theme';
  const $ = (sel) => document.querySelector(sel);

  function ensureFavicon() {
    let icon = document.querySelector('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement('link');
      icon.rel = 'icon';
      document.head.appendChild(icon);
    }
    icon.type = 'image/png';
    icon.href = 'assets/logo.png';
  }

  function installStyles() {
    if (document.getElementById('rgc-owner-enhancements-style')) return;
    const style = document.createElement('style');
    style.id = 'rgc-owner-enhancements-style';
    style.textContent = `
      .rgc-topbar-title{display:flex;align-items:center;gap:12px;min-width:0}
      .rgc-topbar-logo{width:42px;height:42px;object-fit:cover;border-radius:10px;box-shadow:0 8px 20px rgba(6,31,56,.14);flex:0 0 auto}
      .rgc-topbar-actions{display:flex;align-items:center;gap:12px;margin-left:auto}
      .rgc-theme-toggle{display:inline-flex;align-items:center;gap:8px;border:1px solid #d7dfe5;background:#f6f9fb;color:#082f54;border-radius:999px;padding:10px 14px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap}
      .rgc-theme-toggle:hover{border-color:#f28c00;color:#d47700}

      body[data-theme="dark"]{background:#091521;color:#e6edf4;--ink:#e6edf4;--muted:#9fb0c0;--line:#243646;--soft:#102130;--white:#102130}
      body[data-theme="dark"] .dashboard,
      body[data-theme="dark"] .dashboard-main,
      body[data-theme="dark"] .content-area{background:#091521}
      body[data-theme="dark"] .topbar,
      body[data-theme="dark"] .panel-card,
      body[data-theme="dark"] .stats-grid article,
      body[data-theme="dark"] .receipt-card{background:#102130;border-color:#243646;box-shadow:none}
      body[data-theme="dark"] .sidebar{background:#061623}
      body[data-theme="dark"] .topbar h1,
      body[data-theme="dark"] .card-head h2,
      body[data-theme="dark"] .form-title h3,
      body[data-theme="dark"] .list-head h3,
      body[data-theme="dark"] .section-toolbar h2,
      body[data-theme="dark"] .admin-property h4,
      body[data-theme="dark"] .receipt-card h3,
      body[data-theme="dark"] .owner-chip strong,
      body[data-theme="dark"] .stats-grid strong{color:#f4f8fb}
      body[data-theme="dark"] .card-head,
      body[data-theme="dark"] .list-head,
      body[data-theme="dark"] .admin-property,
      body[data-theme="dark"] .mini-item,
      body[data-theme="dark"] .sales-table th,
      body[data-theme="dark"] .sales-table td,
      body[data-theme="dark"] .check-row,
      body[data-theme="dark"] .budget-summary>div,
      body[data-theme="dark"] .budget-group-title,
      body[data-theme="dark"] .budget-other-wrap{border-color:#243646}
      body[data-theme="dark"] .form-card input,
      body[data-theme="dark"] .form-card select,
      body[data-theme="dark"] .form-card textarea,
      body[data-theme="dark"] .list-head input,
      body[data-theme="dark"] .row-actions button,
      body[data-theme="dark"] .sales-table button,
      body[data-theme="dark"] .budget-other-head button,
      body[data-theme="dark"] .rgc-theme-toggle{background:#0c1d2b;color:#e6edf4;border-color:#314556}
      body[data-theme="dark"] .form-card input::placeholder,
      body[data-theme="dark"] .form-card textarea::placeholder,
      body[data-theme="dark"] .list-head input::placeholder{color:#7f95a8}
      body[data-theme="dark"] .form-card label>span,
      body[data-theme="dark"] .section-toolbar p,
      body[data-theme="dark"] .mini-item span,
      body[data-theme="dark"] .mini-item small,
      body[data-theme="dark"] .admin-property p,
      body[data-theme="dark"] .receipt-card p,
      body[data-theme="dark"] .budget-summary span,
      body[data-theme="dark"] .budget-group-title small,
      body[data-theme="dark"] .owner-chip small{color:#9fb0c0}
      body[data-theme="dark"] .budget-summary{background:#0d1e2d;border-color:#243646}
      body[data-theme="dark"] .budget-summary strong{color:#f4f8fb}
      body[data-theme="dark"] .budget-summary .raw-total{background:#132637}
      body[data-theme="dark"] .budget-group-title{background:#0f2231}
      body[data-theme="dark"] .budget-group-title strong{color:#f0f6fb}
      body[data-theme="dark"] .budget-other-wrap{background:#0b1b28}
      body[data-theme="dark"] .check-row{background:#0d1e2d}
      body[data-theme="dark"] .sales-table th{background:#0d1e2d;color:#a7bbca}
      body[data-theme="dark"] .sales-table td{color:#d9e5ee}
      body[data-theme="dark"] .secondary-btn{background:#163149;color:#e6edf4}
      body[data-theme="dark"] .legal-warning{background:#2d2412;border-color:#6b5729;color:#e9d8aa}
      body[data-theme="dark"] .photo-preview{background-color:#0d1e2d;border-color:#314556}
      body[data-theme="dark"] .rgc-theme-toggle:hover{border-color:#f28c00;color:#f6ad45}

      @media(max-width:820px){
        .rgc-topbar-logo{width:36px;height:36px}
        .rgc-theme-toggle{padding:9px 10px}
        .rgc-theme-label{display:none}
      }
      @media(max-width:560px){.rgc-topbar-logo{display:none}}
    `;
    document.head.appendChild(style);
  }

  function readTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'light'; }
    catch (_) { return 'light'; }
  }

  function applyTheme(theme) {
    const value = theme === 'dark' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', value);
    const icon = document.getElementById('rgcThemeIcon');
    const label = document.getElementById('rgcThemeLabel');
    if (icon) icon.textContent = value === 'dark' ? '☀️' : '🌙';
    if (label) label.textContent = value === 'dark' ? 'Modo claro' : 'Modo escuro';
    try { localStorage.setItem(THEME_KEY, value); } catch (_) {}
  }

  function enhanceTopbar() {
    const topbar = $('.topbar');
    if (!topbar || document.getElementById('rgcThemeToggle')) return;

    const titleBlock = topbar.querySelector(':scope > div:not(.owner-chip)');
    if (titleBlock && !titleBlock.classList.contains('rgc-topbar-title')) {
      titleBlock.classList.add('rgc-topbar-title');
      const logo = document.createElement('img');
      logo.className = 'rgc-topbar-logo';
      logo.src = 'assets/logo.png';
      logo.alt = 'Rodrigues Group';
      titleBlock.prepend(logo);
    }

    const ownerChip = topbar.querySelector('.owner-chip');
    const actions = document.createElement('div');
    actions.className = 'rgc-topbar-actions';

    const toggle = document.createElement('button');
    toggle.id = 'rgcThemeToggle';
    toggle.className = 'rgc-theme-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Alternar modo claro e escuro');
    toggle.innerHTML = '<span id="rgcThemeIcon">🌙</span><span class="rgc-theme-label" id="rgcThemeLabel">Modo escuro</span>';

    if (ownerChip) {
      ownerChip.replaceWith(actions);
      actions.append(toggle, ownerChip);
    } else {
      actions.append(toggle);
      topbar.appendChild(actions);
    }

    toggle.addEventListener('click', () => {
      applyTheme(document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  ensureFavicon();
  installStyles();
  enhanceTopbar();
  applyTheme(readTheme());
})();