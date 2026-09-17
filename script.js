(() => {
  'use strict';

  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  })[ch]);

  function propertyCard(property, index) {
    const statusMap = {
      available: { label: 'Disponível', className: '' },
      reserved: { label: 'Reservado', className: 'reserved' },
      sold: { label: 'Vendido', className: 'sold' }
    };
    const status = statusMap[property.status] || statusMap.available;
    const features = Array.isArray(property.features) ? property.features.slice(0, 4) : [];
    const visualClass = `house-${['one','two','three'][index % 3]}`;
    const imageStyle = property.image
      ? ` style="background-image:linear-gradient(to top,rgba(3,25,46,.72),transparent 60%),url('${String(property.image).replace(/'/g, '%27')}');"`
      : '';
    const photoClass = property.image ? 'property-photo property-photo-real' : `property-photo ${visualClass}`;
    const location = property.location ? `<span class="property-location">${escapeHtml(property.location)}</span>` : '';
    const availability = property.status === 'sold'
      ? '<span class="property-unavailable">Imóvel vendido</span>'
      : '<span class="property-interest" style="cursor:default">Disponível no portfólio</span>';

    return `
      <article class="property-card ${index === 0 ? 'featured' : ''} ${status.className}">
        <div class="${photoClass}"${imageStyle}>
          <span class="property-badge ${status.className}">${escapeHtml(property.category || status.label)}</span>
          <span class="property-status ${status.className}">${status.label}</span>
          <span class="photo-label">${escapeHtml(property.title)}</span>
        </div>
        <div class="property-body">
          <div class="property-top">
            <span>${Number(property.suites || 0)} suítes • ${Number(property.area || 0).toLocaleString('pt-BR')} m²</span>
            <strong>${money.format(Number(property.price || 0))}</strong>
          </div>
          <h3>${escapeHtml(property.title)}</h3>
          ${location}
          <p>${escapeHtml(property.description || 'Imóvel cadastrado no portfólio Rodrigues Group Construction.')}</p>
          <div class="property-features">${features.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
          ${availability}
        </div>
      </article>`;
  }

  async function renderProperties() {
    const grid = document.getElementById('propertyGrid');
    if (!grid) return;

    if (!window.RGCDB?.configured) {
      grid.innerHTML = '<div class="property-empty"><strong>Catálogo em configuração.</strong><span>Conecte o site ao Supabase para publicar os imóveis cadastrados pelos proprietários.</span></div>';
      return;
    }

    grid.innerHTML = '<div class="property-loading">Carregando imóveis...</div>';
    try {
      const properties = await RGCDB.getPublicProperties();
      if (!properties.length) {
        grid.innerHTML = '<div class="property-empty"><strong>Nenhum imóvel disponível no momento.</strong><span>Novas oportunidades serão publicadas aqui.</span></div>';
        return;
      }
      grid.innerHTML = properties.map(propertyCard).join('');
    } catch (error) {
      console.error(error);
      grid.innerHTML = '<div class="property-empty"><strong>Não foi possível carregar os imóveis.</strong><span>Verifique a conexão com o banco de dados e tente novamente.</span></div>';
    }
  }

  const menuToggle = document.querySelector('.menu-toggle');
  const mainNav = document.querySelector('.main-nav');
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      const open = mainNav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.textContent = open ? '✕' : '☰';
    });
    mainNav.addEventListener('click', (event) => {
      if (event.target.matches('a')) {
        mainNav.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.textContent = '☰';
      }
    });
  }

  // Atalho oculto para abrir o painel administrativo a partir do site público.
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && event.code === 'KeyO') {
      event.preventDefault();
      event.stopPropagation();
      window.location.href = 'owner.html';
    }
  }, { capture: true });

  renderProperties();
})();
