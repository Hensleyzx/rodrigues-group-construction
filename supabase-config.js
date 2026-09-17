window.RGC_SUPABASE_CONFIG = {
  url: 'https://uetjzocvknoabqxiziwn.supabase.co',
  key: 'sb_publishable_CY2GwXeJIujzNl7jf5SU3w_v8LkQe4C'
};

(() => {
  if (!/owner\.html$/i.test(window.location.pathname)) return;
  const loadBudgetModule = () => {
    if (document.getElementById('rgc-budget-admin-script')) return;
    const script = document.createElement('script');
    script.id = 'rgc-budget-admin-script';
    script.src = 'budget-admin.js?v=20260916-3';
    document.body.appendChild(script);
  };
  if (document.readyState === 'complete') {
    loadBudgetModule();
  } else {
    window.addEventListener('load', loadBudgetModule, { once: true });
  }
})();
