(() => {
  'use strict';

  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const toastEl = document.getElementById('toast');
  const state = {
    user: null,
    profile: null,
    properties: [],
    sales: [],
    photoBlob: null,
    photoPreviewUrl: '',
    loading: false
  };
  let toastTimer = null;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  })[ch]);

  function friendlyError(error) {
    const msg = String(error?.message || error || 'Erro inesperado.');
    if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(msg)) return 'Confirme o e-mail desta conta antes de entrar.';
    if (/JWT|session|expired/i.test(msg)) return 'Sua sessão expirou. Entre novamente.';
    if (/row-level security|permission denied|Acesso negado/i.test(msg)) return 'Esta conta não tem permissão para realizar esta ação.';
    if (/Failed to fetch|NetworkError/i.test(msg)) return 'Não foi possível conectar ao banco. Verifique internet, URL e chave do Supabase.';
    return msg;
  }

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  function setMessage(id, text, type = '') {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = `form-message ${type}`.trim();
  }

  function setBusy(button, busy, busyText = 'Aguarde...') {
    if (!button) return;
    if (busy) {
      button.dataset.originalText = button.textContent;
      button.textContent = busyText;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  }

  function showLogin() {
    loginView.hidden = false;
    dashboardView.hidden = true;
    document.body.classList.remove('dashboard-open');
  }

  async function showDashboard() {
    loginView.hidden = true;
    dashboardView.hidden = false;
    document.body.classList.add('dashboard-open');
    const displayName = state.profile?.display_name || state.user?.email || 'Owner';
    document.getElementById('ownerName').textContent = displayName;
    document.getElementById('securityCurrentEmail').value = state.user?.email || '';
    document.getElementById('newDisplayName').value = state.profile?.display_name || '';
    await refreshAll();
  }

  const titleMap = {
    overview: ['PAINEL', 'Visão geral'],
    properties: ['CATÁLOGO', 'Imóveis'],
    sales: ['COMERCIAL', 'Vendas'],
    receipts: ['DOCUMENTOS', 'Comprovantes'],
    security: ['ACESSO', 'Segurança']
  };

  function activateSection(section) {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.section === section));
    document.querySelectorAll('.panel-section').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === section));
    const [kicker, title] = titleMap[section] || titleMap.overview;
    document.getElementById('pageKicker').textContent = kicker;
    document.getElementById('pageTitle').textContent = title;
    dashboardView.classList.remove('menu-open');
    if (section === 'sales') renderSalePropertyOptions();
    if (section === 'receipts') renderReceipts();
  }

  document.getElementById('ownerNav').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-section]');
    if (btn) activateSection(btn.dataset.section);
  });

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-go]');
    if (btn) activateSection(btn.dataset.go);
  });

  document.getElementById('mobileMenu').addEventListener('click', () => dashboardView.classList.toggle('menu-open'));
  document.getElementById('sidebarBackdrop').addEventListener('click', () => dashboardView.classList.remove('menu-open'));

  function statusInfo(status) {
    return ({
      available: ['Disponível', ''],
      reserved: ['Reservado', 'reserved'],
      sold: ['Vendido', 'sold']
    })[status] || ['Disponível', ''];
  }

  function formatDate(dateString) {
    if (!dateString) return '—';
    const [y, m, d] = String(dateString).split('-').map(Number);
    if (!y || !m || !d) return escapeHtml(dateString);
    return new Intl.DateTimeFormat('pt-BR').format(new Date(Date.UTC(y, m - 1, d)));
  }

  function renderStats() {
    const revenue = state.sales.reduce((sum, sale) => sum + Number(sale.value || 0), 0);
    document.getElementById('statProperties').textContent = state.properties.length.toLocaleString('pt-BR');
    document.getElementById('statAvailable').textContent = state.properties.filter(p => p.status === 'available').length.toLocaleString('pt-BR');
    document.getElementById('statSales').textContent = state.sales.length.toLocaleString('pt-BR');
    document.getElementById('statRevenue').textContent = money.format(revenue);
  }

  function renderOverview() {
    const properties = state.properties.slice(0, 5);
    const sales = state.sales.slice(0, 5);
    const pContainer = document.getElementById('recentProperties');
    const sContainer = document.getElementById('recentSales');

    pContainer.innerHTML = properties.length ? properties.map(p => {
      const [label, cls] = statusInfo(p.status);
      return `<div class="mini-item"><div><strong>${escapeHtml(p.title)}</strong><span>${Number(p.area || 0).toLocaleString('pt-BR')} m² • ${money.format(Number(p.price || 0))}</span></div><div><span class="status-pill ${cls}">${label}</span></div></div>`;
    }).join('') : '<div class="empty-mini">Nenhum imóvel cadastrado.</div>';

    sContainer.innerHTML = sales.length ? sales.map(s => `<div class="mini-item"><div><strong>${escapeHtml(s.buyerName)}</strong><span>${escapeHtml(s.propertyTitle || 'Venda avulsa')}</span></div><div><small>${money.format(Number(s.value || 0))}</small><small>${formatDate(s.saleDate)}</small></div></div>`).join('') : '<div class="empty-mini">Nenhuma venda registrada.</div>';
  }

  function imageBackground(property) {
    if (property.image) return `style="background-image:url('${String(property.image).replace(/'/g, '%27')}')"`;
    return '';
  }

  function renderPropertyAdminList(filter = '') {
    const term = filter.trim().toLowerCase();
    const items = state.properties.filter(p => `${p.title} ${p.location} ${p.category}`.toLowerCase().includes(term));
    const container = document.getElementById('propertyAdminList');
    if (!items.length) {
      container.innerHTML = '<div class="empty-mini">Nenhum imóvel encontrado.</div>';
      return;
    }
    container.innerHTML = items.map(p => {
      const [label, cls] = statusInfo(p.status);
      return `<article class="admin-property">
        <div class="admin-thumb" ${imageBackground(p)}></div>
        <div><h4>${escapeHtml(p.title)}</h4><p>${Number(p.area || 0).toLocaleString('pt-BR')} m² • ${escapeHtml(p.location || 'Sem localização')}</p><div class="price">${money.format(Number(p.price || 0))}</div><span class="status-pill ${cls}">${label}</span></div>
        <div class="row-actions"><button type="button" data-edit-property="${escapeHtml(p.id)}">Editar</button><button type="button" data-toggle-property="${escapeHtml(p.id)}">Status</button><button type="button" class="danger" data-delete-property="${escapeHtml(p.id)}">Excluir</button></div>
      </article>`;
    }).join('');
  }

  document.getElementById('propertySearch').addEventListener('input', event => renderPropertyAdminList(event.target.value));

  function revokePhotoPreview() {
    if (state.photoPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(state.photoPreviewUrl);
    state.photoPreviewUrl = '';
  }

  function setPhotoPreview(url) {
    const preview = document.getElementById('photoPreview');
    revokePhotoPreview();
    state.photoPreviewUrl = url || '';
    if (url) {
      preview.style.backgroundImage = `url('${String(url).replace(/'/g, '%27')}')`;
      preview.classList.add('has-image');
      preview.querySelector('span').textContent = 'Foto selecionada';
    } else {
      preview.style.backgroundImage = '';
      preview.classList.remove('has-image');
      preview.querySelector('span').textContent = 'Prévia da foto';
    }
  }

  function clearPropertyForm() {
    document.getElementById('propertyForm').reset();
    document.getElementById('propertyId').value = '';
    document.getElementById('propertySuites').value = 3;
    document.getElementById('propertyGarages').value = 2;
    document.getElementById('propertyStatus').value = 'available';
    document.getElementById('propertyFormMode').textContent = 'NOVO IMÓVEL';
    document.getElementById('cancelPropertyEdit').hidden = true;
    state.photoBlob = null;
    setPhotoPreview('');
    setMessage('propertyMessage', '');
  }

  async function compressImage(file) {
    if (!file) return null;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error('Formato de imagem não suportado. Use JPG, PNG ou WEBP.');
    if (file.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 8 MB.');

    const source = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
      reader.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Imagem inválida.'));
      image.src = source;
    });
    const maxW = 1600;
    const maxH = 1100;
    const scale = Math.min(1, maxW / img.width, maxH / img.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Falha ao compactar a imagem.')), 'image/jpeg', 0.82));
  }

  document.getElementById('propertyImage').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage('propertyMessage', 'Processando foto...');
    try {
      state.photoBlob = await compressImage(file);
      setPhotoPreview(URL.createObjectURL(state.photoBlob));
      setMessage('propertyMessage', 'Foto pronta para envio ao banco.', 'success');
    } catch (error) {
      event.target.value = '';
      state.photoBlob = null;
      setPhotoPreview('');
      setMessage('propertyMessage', friendlyError(error), 'error');
    }
  });

  document.getElementById('propertyForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const submit = form.querySelector('button[type="submit"]');
    setBusy(submit, true, 'Salvando...');
    setMessage('propertyMessage', 'Salvando no banco...');

    const id = document.getElementById('propertyId').value || crypto.randomUUID();
    const current = state.properties.find(p => p.id === id);
    const featuresText = document.getElementById('propertyFeatures').value;
    const features = featuresText.split(',').map(v => v.trim()).filter(Boolean).slice(0, 8);
    const suites = Math.max(0, Number(document.getElementById('propertySuites').value) || 0);
    const garages = Math.max(0, Number(document.getElementById('propertyGarages').value) || 0);
    if (!features.length) {
      if (suites) features.push(`${suites} suíte${suites === 1 ? '' : 's'}`);
      if (garages) features.push(`${garages} vaga${garages === 1 ? '' : 's'}`);
    }

    let newImagePath = current?.imagePath || '';
    let uploadedNewImage = false;
    try {
      if (state.photoBlob) {
        newImagePath = await RGCDB.uploadPropertyImage({ propertyId: id, blob: state.photoBlob });
        uploadedNewImage = true;
      }

      await RGCDB.saveProperty({
        id,
        title: document.getElementById('propertyTitle').value.trim(),
        category: document.getElementById('propertyCategory').value,
        price: Math.max(0, Number(document.getElementById('propertyPrice').value) || 0),
        area: Math.max(1, Number(document.getElementById('propertyArea').value) || 1),
        suites,
        garages,
        location: document.getElementById('propertyLocation').value.trim(),
        description: document.getElementById('propertyDescription').value.trim(),
        features,
        status: document.getElementById('propertyStatus').value,
        imagePath: newImagePath
      });

      if (uploadedNewImage && current?.imagePath && current.imagePath !== newImagePath) {
        RGCDB.deleteStorageImage(current.imagePath).catch(console.warn);
      }

      await refreshAll();
      clearPropertyForm();
      setMessage('propertyMessage', current ? 'Imóvel atualizado com sucesso.' : 'Imóvel cadastrado com sucesso.', 'success');
      showToast(current ? 'Imóvel atualizado no banco.' : 'Imóvel cadastrado no banco.');
    } catch (error) {
      if (uploadedNewImage && newImagePath && newImagePath !== current?.imagePath) {
        RGCDB.deleteStorageImage(newImagePath).catch(console.warn);
      }
      setMessage('propertyMessage', friendlyError(error), 'error');
    } finally {
      setBusy(submit, false);
    }
  });

  function editProperty(id) {
    const p = state.properties.find(item => item.id === id);
    if (!p) return;
    document.getElementById('propertyId').value = p.id;
    document.getElementById('propertyTitle').value = p.title || '';
    document.getElementById('propertyCategory').value = p.category || 'Alto padrão';
    document.getElementById('propertyPrice').value = Number(p.price || 0);
    document.getElementById('propertyArea').value = Number(p.area || 0);
    document.getElementById('propertySuites').value = Number(p.suites || 0);
    document.getElementById('propertyGarages').value = Number(p.garages || 0);
    document.getElementById('propertyLocation').value = p.location || '';
    document.getElementById('propertyFeatures').value = Array.isArray(p.features) ? p.features.join(', ') : '';
    document.getElementById('propertyDescription').value = p.description || '';
    document.getElementById('propertyStatus').value = p.status || 'available';
    document.getElementById('propertyImage').value = '';
    state.photoBlob = null;
    setPhotoPreview(p.image || '');
    document.getElementById('propertyFormMode').textContent = 'EDITAR IMÓVEL';
    document.getElementById('cancelPropertyEdit').hidden = false;
    document.getElementById('propertyForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function cyclePropertyStatus(id) {
    const item = state.properties.find(p => p.id === id);
    if (!item) return;
    const cycle = { available: 'reserved', reserved: 'sold', sold: 'available' };
    const next = cycle[item.status] || 'available';
    try {
      await RGCDB.updatePropertyStatus(id, next);
      await refreshAll();
      showToast(`Status alterado para ${statusInfo(next)[0]}.`);
    } catch (error) {
      showToast(friendlyError(error));
    }
  }

  document.getElementById('propertyAdminList').addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-edit-property]');
    const toggle = event.target.closest('[data-toggle-property]');
    const del = event.target.closest('[data-delete-property]');
    if (edit) editProperty(edit.dataset.editProperty);
    if (toggle) await cyclePropertyStatus(toggle.dataset.toggleProperty);
    if (del) {
      const id = del.dataset.deleteProperty;
      const property = state.properties.find(p => p.id === id);
      if (!property) return;
      try {
        if (await RGCDB.hasSalesForProperty(id)) {
          alert('Este imóvel possui venda registrada. Para preservar o histórico, altere o status em vez de excluir.');
          return;
        }
        if (confirm('Excluir este imóvel do banco? Esta ação não pode ser desfeita.')) {
          await RGCDB.deleteProperty(id, property.imagePath);
          await refreshAll();
          showToast('Imóvel excluído do banco.');
        }
      } catch (error) {
        showToast(friendlyError(error));
      }
    }
  });

  document.getElementById('newPropertyBtn').addEventListener('click', () => {
    clearPropertyForm();
    document.getElementById('propertyForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('clearPropertyBtn').addEventListener('click', clearPropertyForm);
  document.getElementById('cancelPropertyEdit').addEventListener('click', clearPropertyForm);

  function renderSalePropertyOptions() {
    const select = document.getElementById('saleProperty');
    const current = select.value;
    const properties = state.properties.filter(p => p.status !== 'sold');
    select.innerHTML = '<option value="">Venda sem imóvel cadastrado</option>' + properties.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)} — ${money.format(Number(p.price || 0))}</option>`).join('');
    if ([...select.options].some(o => o.value === current)) select.value = current;
  }

  document.getElementById('saleProperty').addEventListener('change', (event) => {
    const property = state.properties.find(p => p.id === event.target.value);
    if (property) document.getElementById('saleValue').value = Number(property.price || 0);
  });

  function resetSaleForm() {
    document.getElementById('saleForm').reset();
    const today = new Date();
    const local = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    document.getElementById('saleDate').value = local;
    document.getElementById('saleEntry').value = 0;
    document.getElementById('installments').value = 0;
    document.getElementById('markSold').checked = true;
    setMessage('saleMessage', '');
    renderSalePropertyOptions();
  }

  document.getElementById('saleForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const value = Math.max(0, Number(document.getElementById('saleValue').value) || 0);
    const entry = Math.max(0, Number(document.getElementById('saleEntry').value) || 0);
    if (entry > value) {
      setMessage('saleMessage', 'A entrada não pode ser maior que o valor total da venda.', 'error');
      return;
    }

    const submit = form.querySelector('button[type="submit"]');
    setBusy(submit, true, 'Registrando...');
    setMessage('saleMessage', 'Salvando venda e gerando comprovante...');
    try {
      const sale = await RGCDB.registerSale({
        propertyId: document.getElementById('saleProperty').value,
        buyerName: document.getElementById('buyerName').value.trim(),
        buyerDocument: document.getElementById('buyerDocument').value.trim(),
        buyerPhone: document.getElementById('buyerPhone').value.trim(),
        buyerEmail: document.getElementById('buyerEmail').value.trim(),
        saleDate: document.getElementById('saleDate').value,
        value,
        entry,
        paymentMethod: document.getElementById('paymentMethod').value,
        installments: Math.max(0, Number(document.getElementById('installments').value) || 0),
        notes: document.getElementById('saleNotes').value.trim(),
        markSold: document.getElementById('markSold').checked
      });
      await refreshAll();
      setMessage('saleMessage', `Venda ${sale.number} registrada com sucesso.`, 'success');
      showToast('Venda salva no banco e comprovante gerado.');
      printReceipt(sale.id, false);
      resetSaleForm();
    } catch (error) {
      setMessage('saleMessage', friendlyError(error), 'error');
    } finally {
      setBusy(submit, false);
    }
  });

  document.getElementById('resetSaleBtn').addEventListener('click', resetSaleForm);
  document.getElementById('saleSearch').addEventListener('input', event => renderSalesTable(event.target.value));

  function renderSalesTable(filter = '') {
    const term = filter.trim().toLowerCase();
    const sales = state.sales.filter(s => `${s.number} ${s.buyerName} ${s.propertyTitle}`.toLowerCase().includes(term));
    const tbody = document.getElementById('salesTableBody');
    if (!sales.length) {
      tbody.innerHTML = '<tr><td colspan="6">Nenhuma venda encontrada.</td></tr>';
      return;
    }
    tbody.innerHTML = sales.map(s => `<tr><td><strong>${escapeHtml(s.number)}</strong></td><td>${escapeHtml(s.buyerName)}</td><td>${escapeHtml(s.propertyTitle)}</td><td>${money.format(Number(s.value || 0))}</td><td>${formatDate(s.saleDate)}</td><td><button type="button" data-print-sale="${escapeHtml(s.id)}">Imprimir</button></td></tr>`).join('');
  }

  document.getElementById('salesTableBody').addEventListener('click', event => {
    const btn = event.target.closest('[data-print-sale]');
    if (btn) printReceipt(btn.dataset.printSale, true);
  });

  function renderReceipts() {
    const grid = document.getElementById('receiptGrid');
    if (!state.sales.length) {
      grid.innerHTML = '<div class="panel-card" style="padding:22px;color:#7d8993;font-size:11px">Nenhum comprovante disponível. Registre uma venda primeiro.</div>';
      return;
    }
    grid.innerHTML = state.sales.map(s => `<article class="receipt-card"><span class="receipt-no">${escapeHtml(s.number)}</span><h3>${escapeHtml(s.buyerName)}</h3><p>${escapeHtml(s.propertyTitle)}</p><p>${formatDate(s.saleDate)} • ${escapeHtml(s.paymentMethod)}</p><strong>${money.format(Number(s.value || 0))}</strong><button type="button" data-receipt-print="${escapeHtml(s.id)}">Imprimir comprovante</button></article>`).join('');
  }

  document.getElementById('receiptGrid').addEventListener('click', event => {
    const btn = event.target.closest('[data-receipt-print]');
    if (btn) printReceipt(btn.dataset.receiptPrint, true);
  });

  function printReceipt(id, autoPrint = true) {
    const sale = state.sales.find(s => s.id === id);
    if (!sale) return;
    const remaining = Math.max(0, Number(sale.value || 0) - Number(sale.entry || 0));
    const receiptWindow = window.open('', '_blank', 'width=900,height=900');
    if (!receiptWindow) {
      showToast('O navegador bloqueou a janela de impressão. Libere pop-ups para este site.');
      return;
    }
    const createdAt = sale.createdAt ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(sale.createdAt)) : '—';
    receiptWindow.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Comprovante ${escapeHtml(sale.number)}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#13283a;margin:0;background:#eef2f4}.sheet{width:800px;max-width:100%;margin:24px auto;background:#fff;padding:42px;box-shadow:0 12px 35px rgba(0,0,0,.1)}.head{display:flex;justify-content:space-between;gap:25px;align-items:center;border-bottom:3px solid #f28c00;padding-bottom:20px}.head img{width:125px}.head div{text-align:right}.head h1{font-size:21px;margin:0;color:#082f54}.head p{font-size:10px;color:#71808c;margin:4px 0}.number{font-size:12px;font-weight:bold;color:#f28c00;margin-top:7px}.title{margin:28px 0 13px;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#75828c}.grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #dfe4e8}.cell{padding:13px;border-bottom:1px solid #dfe4e8}.cell:nth-child(odd){border-right:1px solid #dfe4e8}.cell span{display:block;font-size:8px;text-transform:uppercase;color:#87939c;font-weight:bold}.cell strong{display:block;font-size:12px;margin-top:4px}.total{margin:22px 0;background:#082f54;color:#fff;padding:18px 20px;display:flex;justify-content:space-between;align-items:center}.total span{font-size:10px}.total strong{font-size:24px}.notes{border:1px solid #dfe4e8;padding:14px;font-size:10px;min-height:65px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:70px}.signature{border-top:1px solid #60717d;text-align:center;padding-top:7px;font-size:9px;color:#60717d}.warning{margin-top:34px;border-top:1px solid #dfe4e8;padding-top:12px;font-size:8px;color:#7b8790;line-height:1.5}.actions{text-align:center;margin:18px}.actions button{border:0;background:#f28c00;padding:12px 18px;font-weight:bold;border-radius:8px;cursor:pointer}@media print{body{background:#fff}.sheet{width:auto;margin:0;box-shadow:none;padding:25px}.actions{display:none}}@media(max-width:650px){.sheet{margin:0;padding:22px}.head{align-items:flex-start}.grid{grid-template-columns:1fr}.cell:nth-child(odd){border-right:0}.signatures{grid-template-columns:1fr;gap:45px}}
    </style></head><body><div class="sheet"><div class="head"><img src="assets/logo.png" alt="Rodrigues Group Construction"><div><h1>Comprovante interno de venda</h1><p>Rodrigues Group Construction</p><div class="number">${escapeHtml(sale.number)}</div></div></div>
    <div class="title">Dados do comprador</div><div class="grid"><div class="cell"><span>Comprador</span><strong>${escapeHtml(sale.buyerName)}</strong></div><div class="cell"><span>CPF / CNPJ</span><strong>${escapeHtml(sale.buyerDocument || 'Não informado')}</strong></div><div class="cell"><span>Telefone</span><strong>${escapeHtml(sale.buyerPhone || 'Não informado')}</strong></div><div class="cell"><span>E-mail</span><strong>${escapeHtml(sale.buyerEmail || 'Não informado')}</strong></div></div>
    <div class="title">Dados da negociação</div><div class="grid"><div class="cell"><span>Imóvel</span><strong>${escapeHtml(sale.propertyTitle)}</strong></div><div class="cell"><span>Localização</span><strong>${escapeHtml(sale.propertyLocation || 'Não informada')}</strong></div><div class="cell"><span>Data da venda</span><strong>${formatDate(sale.saleDate)}</strong></div><div class="cell"><span>Pagamento</span><strong>${escapeHtml(sale.paymentMethod || 'Não informado')}</strong></div><div class="cell"><span>Entrada registrada</span><strong>${money.format(Number(sale.entry || 0))}</strong></div><div class="cell"><span>Saldo indicado</span><strong>${money.format(remaining)}</strong></div><div class="cell"><span>Parcelas</span><strong>${Number(sale.installments || 0) || '—'}</strong></div><div class="cell"><span>Registro criado em</span><strong>${createdAt}</strong></div></div>
    <div class="total"><span>VALOR TOTAL REGISTRADO</span><strong>${money.format(Number(sale.value || 0))}</strong></div><div class="title">Observações</div><div class="notes">${escapeHtml(sale.notes || 'Sem observações adicionais.')}</div>
    <div class="signatures"><div class="signature">Responsável — Rodrigues Group Construction</div><div class="signature">Comprador(a)</div></div><div class="warning"><strong>Aviso:</strong> este documento é um comprovante interno gerado pelo sistema para registrar a negociação. Não substitui contrato de compra e venda, escritura, nota fiscal, recibo fiscal, registro imobiliário ou qualquer documento legalmente exigido.</div></div><div class="actions"><button onclick="window.print()">Imprimir / Salvar em PDF</button></div></body></html>`);
    receiptWindow.document.close();
    receiptWindow.focus();
    if (autoPrint) window.setTimeout(() => receiptWindow.print(), 350);
  }

  document.getElementById('securityForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const displayName = document.getElementById('newDisplayName').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    if (newPassword && newPassword !== confirmPassword) {
      setMessage('securityMessage', 'A confirmação da nova senha não confere.', 'error');
      return;
    }
    if (newPassword && newPassword.length < 10) {
      setMessage('securityMessage', 'Use uma senha com pelo menos 10 caracteres.', 'error');
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    setBusy(submit, true, 'Atualizando...');
    try {
      if (displayName && displayName !== state.profile?.display_name) {
        state.profile = await RGCDB.updateOwnerProfile(state.user.id, displayName);
      }
      if (newPassword) await RGCDB.updatePassword(newPassword);
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmPassword').value = '';
      document.getElementById('ownerName').textContent = state.profile?.display_name || state.user.email;
      setMessage('securityMessage', 'Dados de acesso atualizados com sucesso.', 'success');
      showToast('Segurança atualizada.');
    } catch (error) {
      setMessage('securityMessage', friendlyError(error), 'error');
    } finally {
      setBusy(submit, false);
    }
  });

  async function refreshAll() {
    if (state.loading) return;
    state.loading = true;
    try {
      const [properties, sales] = await Promise.all([
        RGCDB.getOwnerProperties(),
        RGCDB.getSales()
      ]);
      state.properties = properties;
      state.sales = sales;
      renderStats();
      renderOverview();
      renderPropertyAdminList(document.getElementById('propertySearch').value || '');
      renderSalePropertyOptions();
      renderSalesTable(document.getElementById('saleSearch').value || '');
      renderReceipts();
    } catch (error) {
      showToast(friendlyError(error));
    } finally {
      state.loading = false;
    }
  }

  document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const submit = form.querySelector('button[type="submit"]');
    setBusy(submit, true, 'Entrando...');
    setMessage('loginMessage', 'Conectando ao Supabase...');
    try {
      const result = await RGCDB.signIn(
        document.getElementById('loginUser').value.trim(),
        document.getElementById('loginPassword').value
      );
      state.user = result.user;
      state.profile = result.profile;
      document.getElementById('loginPassword').value = '';
      setMessage('loginMessage', '');
      await showDashboard();
      showToast('Acesso liberado.');
    } catch (error) {
      setMessage('loginMessage', friendlyError(error), 'error');
    } finally {
      setBusy(submit, false);
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try { await RGCDB.signOut(); } catch (error) { console.warn(error); }
    state.user = null;
    state.profile = null;
    state.properties = [];
    state.sales = [];
    showLogin();
  });

  async function boot() {
    resetSaleForm();
    clearPropertyForm();
    if (!window.RGCDB?.configured) {
      showLogin();
      setMessage('loginMessage', 'Banco ainda não configurado. Abra supabase-config.js e adicione a Project URL e a chave pública.', 'error');
      const submit = document.querySelector('#loginForm button[type="submit"]');
      if (submit) submit.disabled = true;
      return;
    }
    try {
      const session = await RGCDB.getSession();
      if (!session?.user) {
        showLogin();
        return;
      }
      const profile = await RGCDB.getOwnerProfile(session.user.id);
      if (!profile) {
        await RGCDB.signOut();
        showLogin();
        setMessage('loginMessage', 'Esta conta não está cadastrada como owner.', 'error');
        return;
      }
      state.user = session.user;
      state.profile = profile;
      await showDashboard();
    } catch (error) {
      showLogin();
      setMessage('loginMessage', friendlyError(error), 'error');
    }
  }

  boot();
})();
