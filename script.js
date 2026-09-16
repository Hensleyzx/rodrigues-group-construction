(() => {
  'use strict';

  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

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
    const interest = property.status === 'sold'
      ? '<span class="property-unavailable">Imóvel vendido</span>'
      : `<a href="#contato" class="property-interest" data-property="${escapeHtml(property.title)}">Tenho interesse →</a>`;

    return `
      <article class="property-card ${index === 0 ? 'featured' : ''} ${status.className}">
        <div class="${photoClass}"${imageStyle}>
          <span class="property-badge ${status.className}">${escapeHtml(property.category || status.label)}</span>
          <span class="property-status ${status.className}">${status.label}</span>
          <span class="photo-label">${escapeHtml(property.title)}</span>
        </div>
        <div class="property-body">
          <div class="property-top"><span>${Number(property.suites || 0)} suítes • ${Number(property.area || 0).toLocaleString('pt-BR')} m²</span><strong>${money.format(Number(property.price || 0))}</strong></div>
          <h3>${escapeHtml(property.title)}</h3>
          ${location}
          <p>${escapeHtml(property.description || 'Imóvel cadastrado no portfólio Rodrigues Group Construction.')}</p>
          <div class="property-features">${features.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
          ${interest}
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
      grid.querySelectorAll('.property-interest').forEach(link => {
        link.addEventListener('click', () => {
          const select = document.getElementById('clientInterest');
          const message = document.getElementById('clientMessage');
          if (select) select.value = 'Comprar um imóvel';
          if (message) message.value = `Tenho interesse no imóvel ${link.dataset.property}. Gostaria de receber mais informações.`;
        });
      });
    } catch (error) {
      console.error(error);
      grid.innerHTML = '<div class="property-empty"><strong>Não foi possível carregar os imóveis.</strong><span>Verifique a conexão com o banco de dados e tente novamente.</span></div>';
    }
  }

  const ids = [
    'area','standard','floors','extrasPercent','laborPerM2','cementBagPrice','cementBagsPerM2','landCost','includeLand',
    'grandTotal','baseCost','laborCost','cementCost','extrasCost','landResult','cementBags','cementTons','perM2','meterBar','formMessage'
  ];
  const el = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  const form = document.getElementById('costForm');

  function safeNumber(input, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const value = Number(input?.value);
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
  }

  function calculate(showMessage = false) {
    if (!form) return;
    const area = safeNumber(el.area, 20, 5000);
    const standard = safeNumber(el.standard, 0, 50000);
    const floors = safeNumber(el.floors, 1, 2);
    const extrasPercent = safeNumber(el.extrasPercent, 0, 100);
    const laborPerM2 = safeNumber(el.laborPerM2, 0, 10000);
    const cementBagPrice = safeNumber(el.cementBagPrice, 0, 500);
    const cementBagsPerM2 = safeNumber(el.cementBagsPerM2, 0, 20);
    const land = safeNumber(el.landCost, 0, 100000000);

    const base = area * standard * floors;
    const labor = area * laborPerM2;
    const bags = area * cementBagsPerM2;
    const cement = bags * cementBagPrice;
    const extras = (base + labor + cement) * (extrasPercent / 100);
    const landIncluded = el.includeLand.checked ? land : 0;
    const total = base + labor + cement + extras + landIncluded;
    const constructionOnly = Math.max(total - landIncluded, 0);
    const perM2 = area > 0 ? constructionOnly / area : 0;

    el.baseCost.textContent = money.format(base);
    el.laborCost.textContent = money.format(labor);
    el.cementCost.textContent = money.format(cement);
    el.extrasCost.textContent = money.format(extras);
    el.landResult.textContent = el.includeLand.checked ? money.format(land) : 'Não incluído';
    el.grandTotal.textContent = money.format(total);
    el.cementBags.textContent = `${Math.ceil(bags).toLocaleString('pt-BR')} sacos`;
    el.cementTons.textContent = `aprox. ${num.format((bags * 50) / 1000)} toneladas`;
    el.perM2.textContent = money.format(perM2);
    el.meterBar.style.width = `${Math.min(Math.max((perM2 / 9000) * 100, 8), 100)}%`;

    if (showMessage) {
      el.formMessage.textContent = 'Estimativa atualizada com os valores informados.';
      window.setTimeout(() => { el.formMessage.textContent = ''; }, 3500);
    }
  }

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      calculate(true);
    });

    ['input','change'].forEach(evt => {
      form.addEventListener(evt, () => calculate(false));
    });

    document.getElementById('resetCalc')?.addEventListener('click', () => {
      el.area.value = 200;
      el.standard.value = 3200;
      el.floors.value = 1;
      el.extrasPercent.value = 8;
      el.laborPerM2.value = 950;
      el.cementBagPrice.value = 42.90;
      el.cementBagsPerM2.value = 1.4;
      el.landCost.value = 0;
      el.includeLand.checked = true;
      calculate(false);
      el.formMessage.textContent = 'Valores de exemplo restaurados.';
    });
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

  const contactForm = document.getElementById('contactForm');
  const generatedMessage = document.getElementById('generatedMessage');
  const messageText = document.getElementById('messageText');
  if (contactForm && generatedMessage && messageText) {
    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!contactForm.reportValidity()) return;
      const name = document.getElementById('clientName').value.trim();
      const phone = document.getElementById('clientPhone').value.trim();
      const interest = document.getElementById('clientInterest').value;
      const message = document.getElementById('clientMessage').value.trim();
      messageText.textContent = `Olá! Meu nome é ${name}. Tenho interesse em: ${interest}. Meu telefone é ${phone}.${message ? `\n\nDetalhes: ${message}` : ''}`;
      generatedMessage.hidden = false;
      generatedMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    document.getElementById('selectMessage')?.addEventListener('click', () => {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(messageText);
      selection.removeAllRanges();
      selection.addRange(range);
    });
  }

  renderProperties();
  calculate(false);
})();
