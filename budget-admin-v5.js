(() => {
  'use strict';

  const panel = document.querySelector('[data-panel="budgets"]');
  if (!panel || window.__RGC_BUDGET_V5__) return;
  window.__RGC_BUDGET_V5__ = true;

  const sb = window.RGCDB?.client;
  const $ = (id) => document.getElementById(id);
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const num = (id, min = 0, max = 100000000) => {
    const v = Number($(id)?.value);
    return Number.isFinite(v) ? Math.min(Math.max(v, min), max) : min;
  };
  const statusLabel = (s) => ({
    draft:'Rascunho', sent:'Enviado', approved:'Aprovado', cancelled:'Cancelado'
  }[s] || 'Rascunho');

  let rows = [];

  const style = document.createElement('style');
  style.textContent = `
    .budget-group-title{display:flex;align-items:center;gap:10px;margin-top:4px;padding:11px 12px;border-radius:11px;background:#f5f8fa;border:1px solid #e0e7ec}
    .budget-group-title>span{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#0a3558;color:#fff;font-size:10px;font-weight:900}
    .budget-group-title strong,.budget-group-title small{display:block}.budget-group-title strong{font-size:11px;color:#0a3558}.budget-group-title small{font-size:9px;color:#7b8790;margin-top:2px}
    .budget-layout{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(420px,.95fr);gap:20px;align-items:start}
    .budget-summary{margin-top:18px;border:1px solid #dfe6eb;border-radius:14px;overflow:hidden;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));background:#f8fafb}
    .budget-summary>div{padding:13px 15px;border-bottom:1px solid #e4e9ed;display:flex;justify-content:space-between;gap:12px;font-size:11px}
    .budget-summary>div:nth-child(odd){border-right:1px solid #e4e9ed}.budget-summary .budget-total{grid-column:1/-1;background:#082f54;color:#fff;border:0}.budget-summary .budget-total span,.budget-summary .budget-total strong{color:#fff}.budget-summary .raw-total{grid-column:1/-1;background:#edf3f7;font-weight:800}
    .labor-help{grid-column:1/-1;padding:9px 11px;background:#fff8ee;border-left:3px solid #f28c00;border-radius:0 8px 8px 0;font-size:9px;color:#6f6252}
    .budget-other-wrap{grid-column:1/-1;border:1px dashed #cbd6de;border-radius:12px;padding:12px;background:#fbfcfd}.budget-other-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.budget-other-list{display:grid;gap:8px;margin-top:10px}.budget-other-row{display:grid;grid-template-columns:1fr 180px auto;gap:8px;align-items:end}.budget-other-row button,.budget-other-head button{border:1px solid #c7d3dc;background:#fff;border-radius:8px;padding:9px 10px;font-size:10px;font-weight:800;cursor:pointer}.budget-other-row button{color:#a62f2f;background:#fff5f5}.budget-table .row-actions{display:flex;gap:6px;flex-wrap:wrap}
    @media(max-width:1100px){.budget-layout{grid-template-columns:1fr}}@media(max-width:650px){.budget-summary{grid-template-columns:1fr}.budget-summary>div:nth-child(odd){border-right:0}.budget-other-row{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function addOther(item = {}) {
    const list = $('budgetOtherList');
    if (!list || list.children.length >= 50) return;
    const row = document.createElement('div');
    row.className = 'budget-other-row';
    row.innerHTML = `
      <label><span>Descrição</span><input data-other-description type="text" maxlength="120" placeholder="Ex.: madeira, telhas, frete" value="${esc(item.description || '')}"></label>
      <label><span>Valor (R$)</span><input data-other-value type="number" min="0" max="100000000" step="100" value="${Number(item.value || 0)}"></label>
      <button type="button" data-remove-other>Remover</button>`;
    list.appendChild(row);
  }

  function otherCosts() {
    return [...document.querySelectorAll('#budgetOtherList .budget-other-row')]
      .map((row) => ({
        description: row.querySelector('[data-other-description]')?.value.trim() || '',
        value: Math.max(0, Number(row.querySelector('[data-other-value]')?.value) || 0)
      }))
      .filter((x) => x.description || x.value > 0)
      .slice(0, 50);
  }

  function setup() {
    $('budgetStandard')?.closest('label')?.remove();
    $('budgetFloors')?.closest('label')?.remove();
    $('budgetBaseCost')?.closest('div')?.remove();

    const laborOld = $('budgetLaborPerM2');
    if (laborOld) {
      const label = laborOld.closest('label');
      label.querySelector('span').textContent = 'Diária da equipe (R$)';
      laborOld.id = 'budgetLaborDailyRate';
      laborOld.value = '0';
      laborOld.max = '1000000';
      laborOld.step = '10';

      const days = document.createElement('label');
      days.innerHTML = '<span>Dias previstos de trabalho</span><input id="budgetLaborDays" type="number" min="0" max="3650" step="1" value="0">';
      label.after(days);

      const help = document.createElement('div');
      help.className = 'labor-help';
      help.textContent = 'Mão de obra prevista = diária da equipe × dias previstos. Ex.: R$ 600 × 30 dias = R$ 18.000.';
      days.after(help);
    }

    const grid = $('budgetForm')?.querySelector('.form-grid');
    const groups = [...(grid?.querySelectorAll('.budget-group-title') || [])];
    const observations = groups.find((x) => /Observações e emissão/i.test(x.textContent || ''));

    if (grid && observations && !$('budgetCrushedStoneCost')) {
      observations.querySelector(':scope > span').textContent = '5';
      const box = document.createElement('div');
      box.style.display = 'contents';
      box.innerHTML = `
        <div class="budget-group-title wide"><span>4</span><div><strong>Custo com matéria-prima</strong><small>Materiais básicos e itens livres.</small></div></div>
        <label><span>Brita (R$)</span><input id="budgetCrushedStoneCost" type="number" min="0" max="100000000" step="100" value="0"></label>
        <label><span>Tijolos (R$)</span><input id="budgetBricksCost" type="number" min="0" max="100000000" step="100" value="0"></label>
        <label><span>Areia (R$)</span><input id="budgetSandCost" type="number" min="0" max="100000000" step="100" value="0"></label>
        <label><span>Pedras (R$)</span><input id="budgetStoneCost" type="number" min="0" max="100000000" step="100" value="0"></label>
        <label><span>Cascalhos (R$)</span><input id="budgetGravelCost" type="number" min="0" max="100000000" step="100" value="0"></label>
        <div class="budget-other-wrap">
          <div class="budget-other-head"><div><strong>Outros materiais / custos</strong><small>Adicione o que não estiver listado.</small></div><button type="button" id="addBudgetOtherBtn">+ Adicionar outro</button></div>
          <div id="budgetOtherList" class="budget-other-list"></div>
        </div>`;
      [...box.children].forEach((node) => grid.insertBefore(node, observations));
      addOther();
    }

    const summary = $('budgetForm')?.querySelector('.budget-summary');
    const extrasRow = $('budgetExtrasCost')?.closest('div');
    if (summary && extrasRow && !$('budgetCrushedStoneResult')) {
      const box = document.createElement('div');
      box.style.display = 'contents';
      box.innerHTML = `
        <div><span>Brita</span><strong id="budgetCrushedStoneResult">R$ 0,00</strong></div>
        <div><span>Tijolos</span><strong id="budgetBricksResult">R$ 0,00</strong></div>
        <div><span>Areia</span><strong id="budgetSandResult">R$ 0,00</strong></div>
        <div><span>Pedras</span><strong id="budgetStoneResult">R$ 0,00</strong></div>
        <div><span>Cascalhos</span><strong id="budgetGravelResult">R$ 0,00</strong></div>
        <div><span>Outros</span><strong id="budgetOtherResult">R$ 0,00</strong></div>
        <div class="raw-total"><span>Total matéria-prima / outros</span><strong id="budgetRawMaterialsTotal">R$ 0,00</strong></div>`;
      [...box.children].forEach((node) => summary.insertBefore(node, extrasRow));
    }
  }

  function calculate() {
    const area = num('budgetArea', 20, 5000);
    const extrasPercent = num('budgetExtrasPercent', 0, 100);
    const laborDailyRate = num('budgetLaborDailyRate', 0, 1000000);
    const laborDays = Math.round(num('budgetLaborDays', 0, 3650));
    const cementBagPrice = num('budgetCementBagPrice', 0, 500);
    const cementBagsPerM2 = num('budgetCementBagsPerM2', 0, 20);
    const landCost = num('budgetLandCost');
    const includeLand = Boolean($('budgetIncludeLand')?.checked);

    const electricalCost = num('budgetElectricalCost');
    const hydraulicCost = num('budgetHydraulicCost');
    const finishingCost = num('budgetFinishingCost');
    const marbleCost = num('budgetMarbleCost');
    const flooringCost = num('budgetFlooringCost');
    const steelCost = num('budgetSteelCost');

    const crushedStoneCost = num('budgetCrushedStoneCost');
    const bricksCost = num('budgetBricksCost');
    const sandCost = num('budgetSandCost');
    const stoneCost = num('budgetStoneCost');
    const gravelCost = num('budgetGravelCost');
    const customCosts = otherCosts();
    const otherCostTotal = customCosts.reduce((sum, item) => sum + item.value, 0);
    const rawMaterialsTotal = crushedStoneCost + bricksCost + sandCost + stoneCost + gravelCost + otherCostTotal;

    const laborCost = laborDailyRate * laborDays;
    const laborPerM2 = area > 0 ? laborCost / area : 0;
    const cementBags = area * cementBagsPerM2;
    const cementCost = cementBags * cementBagPrice;

    const directCost = laborCost + cementCost + electricalCost + hydraulicCost + finishingCost + marbleCost + flooringCost + steelCost + rawMaterialsTotal;
    const extrasCost = directCost * (extrasPercent / 100);
    const totalCost = directCost + extrasCost + (includeLand ? landCost : 0);
    const perM2 = area > 0 ? (totalCost - (includeLand ? landCost : 0)) / area : 0;

    const p = {
      clientName: $('budgetClientName')?.value.trim() || '',
      clientDocument: $('budgetClientDocument')?.value.trim() || '',
      clientPhone: $('budgetClientPhone')?.value.trim() || '',
      clientEmail: $('budgetClientEmail')?.value.trim() || '',
      projectType: $('budgetProjectType')?.value || 'Construção residencial',
      area, extrasPercent, laborDailyRate, laborDays, laborPerM2,
      cementBagPrice, cementBagsPerM2, cementBags, landCost, includeLand,
      electricalCost, hydraulicCost, finishingCost, marbleCost, flooringCost, steelCost,
      crushedStoneCost, bricksCost, sandCost, stoneCost, gravelCost,
      otherCosts: customCosts, otherCostTotal, rawMaterialsTotal,
      laborCost, cementCost, extrasCost, totalCost, perM2,
      notes: $('budgetNotes')?.value.trim() || '',
      status: $('budgetStatus')?.value || 'draft'
    };

    const outputs = {
      budgetLaborCost: laborCost, budgetCementCost: cementCost,
      budgetElectricalResult: electricalCost, budgetHydraulicResult: hydraulicCost,
      budgetFinishingResult: finishingCost, budgetMarbleResult: marbleCost,
      budgetFlooringResult: flooringCost, budgetSteelResult: steelCost,
      budgetCrushedStoneResult: crushedStoneCost, budgetBricksResult: bricksCost,
      budgetSandResult: sandCost, budgetStoneResult: stoneCost,
      budgetGravelResult: gravelCost, budgetOtherResult: otherCostTotal,
      budgetRawMaterialsTotal: rawMaterialsTotal, budgetExtrasCost: extrasCost,
      budgetPerM2: perM2, budgetTotal: totalCost
    };
    Object.entries(outputs).forEach(([id, value]) => { if ($(id)) $(id).textContent = money.format(value); });
    if ($('budgetLandResult')) $('budgetLandResult').textContent = includeLand ? money.format(landCost) : 'Não incluído';
    return p;
  }

  function payload(p) {
    return {
      client_name: p.clientName, client_document: p.clientDocument || null,
      client_phone: p.clientPhone || null, client_email: p.clientEmail || null,
      project_type: p.projectType, area: p.area,
      standard_name: null, standard_rate: 0, floors_factor: 1,
      extras_percent: p.extrasPercent, labor_daily_rate: p.laborDailyRate,
      labor_days: p.laborDays, labor_per_m2: p.laborPerM2,
      cement_bag_price: p.cementBagPrice, cement_bags_per_m2: p.cementBagsPerM2,
      land_cost: p.landCost, include_land: p.includeLand,
      electrical_cost: p.electricalCost, hydraulic_cost: p.hydraulicCost,
      finishing_cost: p.finishingCost, marble_cost: p.marbleCost,
      flooring_cost: p.flooringCost, steel_cost: p.steelCost,
      crushed_stone_cost: p.crushedStoneCost, bricks_cost: p.bricksCost,
      sand_cost: p.sandCost, stone_cost: p.stoneCost, gravel_cost: p.gravelCost,
      other_costs: p.otherCosts, other_cost_total: p.otherCostTotal,
      raw_materials_total: p.rawMaterialsTotal, base_cost: 0,
      labor_cost: p.laborCost, cement_cost: p.cementCost,
      extras_cost: p.extrasCost, total_cost: p.totalCost, per_m2: p.perM2,
      notes: p.notes || null, status: p.status
    };
  }

  function mapRow(r) {
    return {
      id: r.id, number: r.quote_number || '', clientName: r.client_name || '',
      clientDocument: r.client_document || '', clientPhone: r.client_phone || '',
      clientEmail: r.client_email || '', projectType: r.project_type || '',
      area: Number(r.area || 0), laborDailyRate: Number(r.labor_daily_rate || 0),
      laborDays: Number(r.labor_days || 0), landCost: Number(r.land_cost || 0),
      includeLand: Boolean(r.include_land), electricalCost: Number(r.electrical_cost || 0),
      hydraulicCost: Number(r.hydraulic_cost || 0), finishingCost: Number(r.finishing_cost || 0),
      marbleCost: Number(r.marble_cost || 0), flooringCost: Number(r.flooring_cost || 0),
      steelCost: Number(r.steel_cost || 0), crushedStoneCost: Number(r.crushed_stone_cost || 0),
      bricksCost: Number(r.bricks_cost || 0), sandCost: Number(r.sand_cost || 0),
      stoneCost: Number(r.stone_cost || 0), gravelCost: Number(r.gravel_cost || 0),
      otherCosts: Array.isArray(r.other_costs) ? r.other_costs : [],
      rawMaterialsTotal: Number(r.raw_materials_total || 0), legacyBaseCost: Number(r.base_cost || 0),
      laborCost: Number(r.labor_cost || 0), cementCost: Number(r.cement_cost || 0),
      extrasCost: Number(r.extras_cost || 0), totalCost: Number(r.total_cost || 0),
      perM2: Number(r.per_m2 || 0), notes: r.notes || '', status: r.status || 'draft'
    };
  }

  function renderRows() {
    const body = $('budgetTableBody');
    if (!body) return;
    const term = ($('budgetSearch')?.value || '').toLowerCase();
    const list = rows.filter((r) => `${r.number} ${r.clientName} ${r.projectType}`.toLowerCase().includes(term));
    body.innerHTML = list.length
      ? list.map((r) => `<tr><td><strong>${esc(r.number)}</strong></td><td>${esc(r.clientName)}</td><td>${esc(r.projectType)}</td><td>${money.format(r.totalCost)}</td><td>${statusLabel(r.status)}</td><td><div class="row-actions"><button type="button" data-budget-print="${r.id}">Imprimir</button><button type="button" data-budget-status="${r.id}">Status</button><button type="button" class="danger" data-budget-delete="${r.id}">Excluir</button></div></td></tr>`).join('')
      : '<tr><td colspan="6">Nenhum orçamento salvo.</td></tr>';
  }

  async function loadRows() {
    if (!sb) return;
    const { data, error } = await sb.from('quotes').select('*').order('created_at', { ascending: false });
    if (error) {
      if ($('budgetTableBody')) $('budgetTableBody').innerHTML = '<tr><td colspan="6">Execute a query atualizada no Supabase.</td></tr>';
      return;
    }
    rows = (data || []).map(mapRow);
    renderRows();
  }

  function printDoc(p) {
    if (!p) return;
    const w = window.open('', '_blank', 'width=900,height=900');
    if (!w) return alert('Libere pop-ups para imprimir.');
    const logo = new URL('assets/logo.png', location.href).href;
    const laborLabel = p.laborDailyRate || p.laborDays
      ? `Mão de obra — ${money.format(p.laborDailyRate)}/dia × ${p.laborDays} dias`
      : 'Mão de obra';

    const costs = [
      [laborLabel, p.laborCost], ['Cimento', p.cementCost], ['Elétrica', p.electricalCost],
      ['Hidráulica', p.hydraulicCost], ['Acabamentos', p.finishingCost], ['Marmoraria', p.marbleCost],
      ['Piso / revestimentos', p.flooringCost], ['Ferragem / aço', p.steelCost], ['Brita', p.crushedStoneCost],
      ['Tijolos', p.bricksCost], ['Areia', p.sandCost], ['Pedras', p.stoneCost], ['Cascalhos', p.gravelCost],
      ...(p.otherCosts || []).map((x) => [`Outro — ${x.description || 'Sem descrição'}`, Number(x.value || 0)]),
      ['Custos extras', p.extrasCost]
    ];
    if (p.legacyBaseCost > 0) costs.unshift(['Base de orçamento antigo', p.legacyBaseCost]);

    const detail = costs.filter(([,v]) => Number(v || 0) > 0)
      .map(([name, value]) => `<div class="cell"><span>${esc(name)}</span><strong>${money.format(Number(value || 0))}</strong></div>`).join('')
      + `<div class="cell"><span>Terreno</span><strong>${p.includeLand ? money.format(p.landCost) : 'Não incluído'}</strong></div>`
      + `<div class="cell"><span>Custo por m²</span><strong>${money.format(p.perM2)}</strong></div>`;

    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Orçamento ${esc(p.number || 'Prévia')}</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#13283a;margin:0;background:#eef2f4}.sheet{width:800px;max-width:100%;margin:24px auto;background:#fff;padding:40px}.head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f28c00;padding-bottom:18px}.head img{width:120px}.head div{text-align:right}.head h1{font-size:20px;margin:0;color:#082f54}.no{font-size:11px;color:#f28c00;font-weight:700;margin-top:5px}.title{margin:24px 0 10px;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#71808c;font-weight:700}.grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #dfe4e8}.cell{padding:12px;border-bottom:1px solid #dfe4e8}.cell:nth-child(odd){border-right:1px solid #dfe4e8}.cell span{display:block;font-size:8px;text-transform:uppercase;color:#87939c;font-weight:700}.cell strong{display:block;font-size:11px;margin-top:4px}.total{margin:20px 0;background:#082f54;color:#fff;padding:18px;display:flex;justify-content:space-between;align-items:center}.total strong{font-size:24px}.notes{border:1px solid #dfe4e8;padding:12px;min-height:55px;font-size:10px;white-space:pre-wrap}.warning{margin-top:24px;font-size:8px;color:#7b8790;line-height:1.5}.actions{text-align:center;margin:18px}.actions button{border:0;background:#f28c00;padding:12px 18px;font-weight:700;border-radius:8px}@media print{body{background:#fff}.sheet{margin:0;width:auto}.actions{display:none}}@media(max-width:650px){.sheet{margin:0;padding:20px}.grid{grid-template-columns:1fr}.cell:nth-child(odd){border-right:0}}</style></head><body><div class="sheet"><div class="head"><img src="${logo}" alt="Rodrigues Group"><div><h1>Orçamento detalhado de obra</h1><div class="no">${esc(p.number || 'PRÉVIA')}</div></div></div><div class="title">Cliente</div><div class="grid"><div class="cell"><span>Nome</span><strong>${esc(p.clientName || 'Não informado')}</strong></div><div class="cell"><span>CPF / CNPJ</span><strong>${esc(p.clientDocument || 'Não informado')}</strong></div><div class="cell"><span>Telefone</span><strong>${esc(p.clientPhone || 'Não informado')}</strong></div><div class="cell"><span>E-mail</span><strong>${esc(p.clientEmail || 'Não informado')}</strong></div></div><div class="title">Projeto</div><div class="grid"><div class="cell"><span>Tipo</span><strong>${esc(p.projectType)}</strong></div><div class="cell"><span>Área</span><strong>${Number(p.area || 0).toLocaleString('pt-BR')} m²</strong></div><div class="cell"><span>Status</span><strong>${esc(statusLabel(p.status))}</strong></div></div><div class="title">Detalhamento dos custos</div><div class="grid">${detail}</div><div class="total"><span>VALOR TOTAL ESTIMADO</span><strong>${money.format(Number(p.totalCost || 0))}</strong></div><div class="title">Observações</div><div class="notes">${esc(p.notes || 'Sem observações adicionais.')}</div><div class="warning"><strong>Aviso:</strong> este documento registra uma estimativa/orçamento interno. Não substitui contrato, nota fiscal, ART/RRT, escritura ou documento legalmente exigido.</div></div><div class="actions"><button onclick="window.print()">Imprimir / Salvar em PDF</button></div></body></html>`);
    w.document.close();
    w.focus();
  }

  function reset() {
    $('budgetForm')?.reset();
    if ($('budgetArea')) $('budgetArea').value = 200;
    if ($('budgetExtrasPercent')) $('budgetExtrasPercent').value = 8;
    if ($('budgetLaborDailyRate')) $('budgetLaborDailyRate').value = 0;
    if ($('budgetLaborDays')) $('budgetLaborDays').value = 0;
    if ($('budgetCementBagPrice')) $('budgetCementBagPrice').value = 42.90;
    if ($('budgetCementBagsPerM2')) $('budgetCementBagsPerM2').value = 1.4;
    if ($('budgetIncludeLand')) $('budgetIncludeLand').checked = true;
    if ($('budgetOtherList')) { $('budgetOtherList').innerHTML = ''; addOther(); }
    if ($('budgetMessage')) $('budgetMessage').textContent = '';
    calculate();
  }

  setup();
  calculate();
  loadRows();

  $('addBudgetOtherBtn')?.addEventListener('click', () => { addOther(); calculate(); });
  $('budgetOtherList')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-other]');
    if (!btn) return;
    btn.closest('.budget-other-row')?.remove();
    if (!$('budgetOtherList')?.children.length) addOther();
    calculate();
  });
  $('budgetOtherList')?.addEventListener('input', calculate);
  $('budgetForm')?.addEventListener('input', calculate);
  $('budgetForm')?.addEventListener('change', calculate);
  $('budgetSearch')?.addEventListener('input', renderRows);
  $('resetBudgetBtn')?.addEventListener('click', reset);
  $('newBudgetBtn')?.addEventListener('click', () => { reset(); $('budgetForm')?.scrollIntoView({ behavior:'smooth', block:'start' }); });
  $('printBudgetPreviewBtn')?.addEventListener('click', () => {
    const p = calculate();
    if (!p.clientName) { if ($('budgetMessage')) $('budgetMessage').textContent = 'Informe o nome do cliente para imprimir a prévia.'; return; }
    printDoc(p);
  });

  $('budgetForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!e.currentTarget.reportValidity()) return;
    if (!sb) { if ($('budgetMessage')) $('budgetMessage').textContent = 'Banco não configurado.'; return; }
    const p = calculate();
    if ($('budgetMessage')) $('budgetMessage').textContent = 'Salvando orçamento...';
    const { data, error } = await sb.from('quotes').insert(payload(p)).select('*').single();
    if (error) {
      if ($('budgetMessage')) $('budgetMessage').textContent = /column|schema cache|quotes|relation/i.test(error.message || '') ? 'Execute a query atualizada no Supabase para liberar todos os campos.' : error.message;
      return;
    }
    const saved = mapRow(data);
    rows.unshift(saved);
    renderRows();
    if ($('budgetMessage')) $('budgetMessage').textContent = `Orçamento ${saved.number} salvo com sucesso.`;
    printDoc(saved);
  });

  $('budgetTableBody')?.addEventListener('click', async (e) => {
    const pbtn = e.target.closest('[data-budget-print]');
    if (pbtn) return printDoc(rows.find((r) => r.id === pbtn.dataset.budgetPrint));
    const sbtn = e.target.closest('[data-budget-status]');
    if (sbtn) {
      const r = rows.find((x) => x.id === sbtn.dataset.budgetStatus);
      if (!r) return;
      const order = ['draft','sent','approved','cancelled'];
      const next = order[(order.indexOf(r.status) + 1) % order.length];
      const { data, error } = await sb.from('quotes').update({ status:next }).eq('id', r.id).select('*').single();
      if (error) return alert(error.message);
      Object.assign(r, mapRow(data));
      return renderRows();
    }
    const dbtn = e.target.closest('[data-budget-delete]');
    if (dbtn) {
      const r = rows.find((x) => x.id === dbtn.dataset.budgetDelete);
      if (!r || !confirm(`Excluir o orçamento ${r.number}?`)) return;
      const { error } = await sb.from('quotes').delete().eq('id', r.id);
      if (error) return alert(error.message);
      rows = rows.filter((x) => x.id !== r.id);
      renderRows();
    }
  });

  document.getElementById('ownerNav')?.addEventListener('click', (e) => {
    if (!e.target.closest('[data-section="budgets"]')) return;
    setTimeout(() => {
      if ($('pageKicker')) $('pageKicker').textContent = 'CALCULADORA';
      if ($('pageTitle')) $('pageTitle').textContent = 'Custos e orçamentos';
      loadRows();
    }, 0);
  });
})();