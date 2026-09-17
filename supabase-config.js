window.RGC_SUPABASE_CONFIG = {
  url: 'https://uetjzocvknoabqxiziwn.supabase.co',
  key: 'sb_publishable_CY2GwXeJIujzNl7jf5SU3w_v8LkQe4C'
};

(() => {
  if (!/owner\.html$/i.test(window.location.pathname)) return;

  const loadScript = (id, src) => {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    document.body.appendChild(script);
  };

  const loadOwnerModules = () => {
    loadScript('rgc-owner-enhancements-script', 'owner-enhancements.js?v=20260917-1');
    loadScript('rgc-budget-admin-script', 'budget-admin-v5.js?v=20260916-1');
  };

  if (document.readyState === 'complete') {
    loadOwnerModules();
  } else {
    window.addEventListener('load', loadOwnerModules, { once: true });
  }
})();
