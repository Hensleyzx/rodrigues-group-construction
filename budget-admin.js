(() => {
  'use strict';

  const panel = document.querySelector('[data-panel="budgets"]');
  if (!panel || window.__RGC_BUDGET_ADMIN__) return;
  window.__RGC_BUDGET_ADMIN__ = true;

  const sb = window.RGCDB?.client;
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
  const $ = (id) => document.getElementById(id);
  let rows = [];
  let preview = null;

  const style = document.createElement('style');
  style.textContent = `
    .budget-group-title{display:flex;align-items:center;gap:10px;margin-top:4px;padding:11px 12px;border-radius:11px;background:#f5f8fa;border:1px solid #e0e7ec}
    .budget-group-title>span{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#0a3558;color:#fff;font-size:10px;font-weight:900}
    .budget-group-title strong,.budget-group-title small{display:block}.budget-group-title strong{font-size:11px;color:#0a3558}.budget-group-title small{font-size:9px;color:#7b8790;margin-top:2px}
    .budget-layout{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(420px,.95fr);gap:20px;align-items:start}
    .budget-summary{margin-top:18px;border:1px solid #dfe6eb;border-radius:14px;overflow:hidden;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));background:#f8fafb}
    .budget-summary>div{padding:13px 15px;border-bottom:1px solid #e4e9ed;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:11px}
    .budget-summary>div:nth-child(odd){border-right:1px solid #e4e9ed}.budget-summary span{color:#697680}.budget-summary strong{color:#12314b;text-align:right}
    .budget-summary .budget-total{grid-column:1/-1;background:#082f54;color:#fff;border:0}.budget-summary .budget-total span,.budget-summary .budget-total strong{color:#fff}.budget-summary .budget-total strong{font-size:20px}
    .budget-summary .raw-total{grid-column:1/-1;background:#edf3f7;font-weight:800}
    .budget-table .row-actions{display:flex;gap:6px;flex-wrap:wrap}.budget-table .row-actions button{white-space:nowrap}
    .budget-other-wrap{grid-column:1/-1;border:1px dashed #cbd6de;border-radius:12px;padding:12px;background:#fbfcfd}
    .budget-other-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
    .budget-other-head strong{font-size:11px;color:#0a3558}.budget-other-head small{display:block;font-size:9px;color:#7b8790;margin-top:2px}
    .budget-other-head button{border:1px solid #c7d3dc;background:#fff;border-radius:8px;padding:8px 10px;font-size:10px;font-weight:800;color:#0a3558;cursor:pointer}
    .budget-other-list{display:grid;gap:8px}
    .budget-other-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(130px,.38fr) auto;gap:8px;align-items:end}
    .budget-other-row label{min-width:0}.budget-other-row button{height:40px;border:1px solid #e3c1c1;background:#fff5f5;color:#a62f2f;border-radius:9px;padding:0 10px;font-weight:800;cursor:pointer}
    @media(max-width:1100px){.budget-layout{grid-template-columns:1fr}}
    @media(max-width:650px){
      .budget-summary{grid-template-columns:1fr}.budget-summary>div:nth-child(odd){border-right:0}
      .budget-other-row{grid-template-columns:1fr}.budget-other-row button{width:100%}
    }
  `;
  document.head.appendChild(style);

  function num(id, min = 0, max = 100000000) {
    const v = Number($(id)?.value);
    return Number.isFinite(v) ? Math.min(Math.max(v, min), max) : min;
  }

  function statusLabel(status) {
    return ({ draft:'Rascunho', sent:'Enviado', approved:'Aprovado', cancelled:'Cancelado' }[status] || 'Rascunho');
  }

  function makeLabel(id, text) {
    return `<label><span>${text}</span><input id="${id}" type="number" min="0" max="100000000" step="100" value="0" /></label>`;
  }

  function injectRawMaterialFields() {
    const formGrid = $('budgetForm')?.querySelector('.form-grid');
    if (!formGrid || $('budgetCrushedStoneCost')) return;

    const groups = [...formGrid.querySelectorAll('.budget-group-title')];
    const observationsGroup = groups.find(el => /Observações e emissão/i.test(el.textContent || ''));
    if (!observationsGroup) return;

    observationsGroup.querySelector(':scope > span')?.replaceChildren(document.createTextNode('5'));

    const wrap = document.createElement('div');
    wrap.style.display = 'contents';
    wrap.innerHTML = `
      <div class="budget-group-title wide"><span>4</span><div><strong>Custo com matéria-prima</strong><small>Informe os materiais básicos. Use “Outros” para qualquer item que não esteja na lista.</small></div></div>
      ${makeLabel('budgetCrushedStoneCost','Brita (R$)')}
      ${makeLabel('budgetBricksCost','Tijolos (R$)')}
      ${makeLabel('budgetSandCost','Areia (R$)')}
      ${makeLabel('budgetStoneCost','Pedras (R$)')}
      ${makeLabel('budgetGravelCost','Cascalhos (R$)')}
      <div class="budget-other-wrap">
        <div class="budget-other-head">
          <div><strong>Outros materiais / custos</strong><small>Adicione quantos itens forem necessários, com nome e valor.</small></div>
          <button type="button" id="addBudgetOtherBtn">+ Adicionar outro</button>
        </div>
        <div class="budget-other-list" id="budgetOtherList"></div>
      </div>
    `;
    const nodes = [...wrap.children];
    nodes.forEach(node => formGrid.insertBefore(node, observationsGroup));

    addOtherRow();
  }

  function injectSummaryRows() {
    const summary = $('budgetForm')?.querySelector('.budget-summary');
    if (!summary || $('budgetCrushedStoneResult')) return;
    const extrasRow = $('budgetExtrasCost')?.closest('div');
    if (!extrasRow) return;

    const holder = document.createElement('div');
    holder.style.display = 'contents';
    holder.innerHTML = `
      <div><span>Brita</span><strong id="budgetCrushedStoneResult">R$ 0,00</strong></div>
      <div><span>Tijolos</span><strong id="budgetBricksResult">R$ 0,00</strong></div>
      <div><span>Areia</span><strong id="budgetSandResult">R$ 0,00</strong></div>
      <div><span>Pedras</span><strong id="budgetStoneResult">R$ 0,00</strong></div>
      <div><span>Cascalhos</span><strong id="budgetGravelResult">R$ 0,00</strong></div>
      <div><span>Outros</span><strong id="budgetOtherResult">R$ 0,00</strong></div>
      <div class="raw-total"><span>Total matéria-prima / outros</span><strong id="budgetRawMaterialsTotal">R$ 0,00</strong></div>
    `;
    [...holder.children].forEach(node => summary.insertBefore(node, extrasRow));
  }

  function otherRows() {
    return [...document.querySelectorAll('#budgetOtherList .budget-other-row')].map(row => {
      const description = row.querySelector('[data-other-description]')?.value.trim() || '';
      const valueRaw = Number(row.querySelector('[data-other-value]')?.value);
      const value = Number.isFinite(valueRaw) ? Math.max(0, Math.min(valueRaw, 100000000)) : 0;
      return { description, value };
    }).filter(item => item.description || item.value > 0).slice(0, 50);
  }

  function addOtherRow(item = {}) {
    const list = $('budgetOtherList');
    if (!list) return;
    if (list.children.length >= 50) return;
    const row = document.createElement('div');
    row.className = 'budget-other-row';
    row.innerHTML = `
      <label><span>Descrição</span><input data-other-description type="text" maxlength="120" placeholder="Ex.: madeira, telhas, frete..." value="${esc(item.description || '')}" /></label>
      <label><span>Valor (R$)</span><input data-other-value type="number" min="0" max="100000000" step="100" value="${Number(item.value || 0)}" /></label>
      <button type="button" data-remove-other>Remover</button>
    `;
    list.appendChild(row);
  }

  function restoreOtherRows(items) {
    const list = $('budgetOtherList');
    if (!list) return;
    list.innerHTML = '';
    const safeItems = Array.isArray(items) ? items.slice(0, 50) : [];
    if (safeItems.length) safeItems.forEach(addOtherRow);
    else addOtherRow();
  }

  function calc() {
    const area = num('budgetArea', 20, 5000);
    const standardRate = num('budgetStandard', 0, 50000);
    const floorsFactor = num('budgetFloors', 1, 2);
    const extrasPercent = num('budgetExtrasPercent', 0, 100);
    const laborPerM2 = num('budgetLaborPerM2', 0, 10000);
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
    const otherCosts = otherRows();
    const otherCostTotal = otherCosts.reduce((sum, item) => sum + Number(item.value || 0), 0);
    const rawMaterialsTotal = crushedStoneCost + bricksCost + sandCost + stoneCost + gravelCost + otherCostTotal;

    const baseCost = area * standardRate * floorsFactor;
    const laborCost = area * laborPerM2;
    const cementBags = area * cementBagsPerM2;
    const cementCost = cementBags * cementBagPrice;
    const direct = baseCost + laborCost + cementCost + electricalCost + hydraulicCost + finishingCost + marbleCost + flooringCost + steelCost + rawMaterialsTotal;
    const extrasCost = direct * (extrasPercent / 100);
    const totalCost = direct + extrasCost + (includeLand ? landCost : 0);
    const perM2 = area > 0 ? (totalCost - (includeLand ? landCost : 0)) / area : 0;

    preview = {
      clientName: $('budgetClientName')?.value.trim() || '',
      clientDocument: $('budgetClientDocument')?.value.trim() || '',
      clientPhone: $('budgetClientPhone')?.value.trim() || '',
      clientEmail: $('budgetClientEmail')?.value.trim() || '',
      projectType: $('budgetProjectType')?.value || 'Construção residencial',
      area,
      standardName: $('budgetStandard')?.selectedOptions?.[0]?.textContent || '',
      standardRate,
      floorsFactor,
      extrasPercent,
      laborPerM2,
      cementBagPrice,
      cementBagsPerM2,
      cementBags,
      landCost,
      includeLand,
      electricalCost,
      hydraulicCost,
      finishingCost,
      marbleCost,
      flooringCost,
      steelCost,
      crushedStoneCost,
      bricksCost,
      sandCost,
      stoneCost,
      gravelCost,
      otherCosts,
      otherCostTotal,
      rawMaterialsTotal,
      baseCost,
      laborCost,
      cementCost,
      extrasCost,
      totalCost,
      perM2,
      notes: $('budgetNotes')?.value.trim() || '',
      status: $('budgetStatus')?.value || 'draft'
    };

    const values = {
      budgetBaseCost: baseCost,
      budgetLaborCost: laborCost,
      budgetCementCost: cementCost,
      budgetElectricalResult: electricalCost,
      budgetHydraulicResult: hydraulicCost,
      budgetFinishingResult: finishingCost,
      budgetMarbleResult: marbleCost,
      budgetFlooringResult: flooringCost,
      budgetSteelResult: steelCost,
      budgetCrushedStoneResult: crushedStoneCost,
      budgetBricksResult: bricksCost,
      budgetSandResult: sandCost,
      budgetStoneResult: stoneCost,
      budgetGravelResult: gravelCost,
      budgetOtherResult: otherCostTotal,
      budgetRawMaterialsTotal: rawMaterialsTotal,
      budgetExtrasCost: extrasCost,
      budgetPerM2: perM2,
      budgetTotal: totalCost
    };
    Object.entries(values).forEach(([id, v]) => {
      if ($(id)) $(id).textContent = money.format(v);
    });
    if ($('budgetLandResult')) $('budgetLandResult').textContent = includeLand ? money.format(landCost) : 'Não incluído';
    return preview;
  }

  function normalizeOtherCosts(value) {
    if (!Array.isArray(value)) return [];
    return value.map(item => ({
      description: String(item?.description || '').slice(0, 120),
      value: Math.max(0, Number(item?.value || 0))
    })).filter(item => item.description || item.value > 0).slice(0, 50);
  }

  function mapRow(r) {
    const custom = normalizeOtherCosts(r.other_costs);
    return {
      id: r.id,
      number: r.quote_number || '',
      clientName: r.client_name || '',
      clientDocument: r.client_document || '',
      clientPhone: r.client_phone || '',
      clientEmail: r.client_email || '',
      projectType: r.project_type || '',
      area: Number(r.area || 0),
      standardName: r.standard_name || '',
      standardRate: Number(r.standard_rate || 0),
      floorsFactor: Number(r.floors_factor || 1),
      extrasPercent: Number(r.extras_percent || 0),
      laborPerM2: Number(r.labor_per_m2 || 0),
      cementBagPrice: Number(r.cement_bag_price || 0),
      cementBagsPerM2: Number(r.cement_bags_per_m2 || 0),
      landCost: Number(r.land_cost || 0),
      includeLand: Boolean(r.include_land),
      electricalCost: Number(r.electrical_cost || 0),
      hydraulicCost: Number(r.hydraulic_cost || 0),
      finishingCost: Number(r.finishing_cost || 0),
      marbleCost: Number(r.marble_cost || 0),
      flooringCost: Number(r.flooring_cost || 0),
      steelCost: Number(r.steel_cost || 0),
      crushedStoneCost: Number(r.crushed_stone_cost || 0),
      bricksCost: Number(r.bricks_cost || 0),
      sandCost: Number(r.sand_cost || 0),
      stoneCost: Number(r.stone_cost || 0),
      gravelCost: Number(r.gravel_cost || 0),
      otherCosts: custom,
      otherCostTotal: Number(r.other_cost_total || custom.reduce((s, i) => s + i.value, 0)),
      rawMaterialsTotal: Number(r.raw_materials_total || 0),
      baseCost: Number(r.base_cost || 0),
      laborCost: Number(r.labor_cost || 0),
      cementCost: Number(r.cement_cost || 0),
      extrasCost: Number(r.extras_cost || 0),
      totalCost: Number(r.total_cost || 0),
      perM2: Number(r.per_m2 || 0),
      notes: r.notes || '',
      status: r.status || 'draft',
      createdAt: r.created_at || ''
    };
  }

  function payload(p) {
    return {
      client_name: p.clientName,
      client_document: p.clientDocument || null,
      client_phone: p.clientPhone || null,
      client_email: p.clientEmail || null,
      project_type: p.projectType,
      area: p.area,
      standard_name: p.standardName,
      standard_rate: p.standardRate,
      floors_factor: p.floorsFactor,
      extras_percent: p.extrasPercent,
      labor_per_m2: p.laborPerM2,
      cement_bag_price: p.cementBagPrice,
      cement_bags_per_m2: p.cementBagsPerM2,
      land_cost: p.landCost,
      include_land: p.includeLand,
      electrical_cost: p.electricalCost,
      hydraulic_cost: p.hydraulicCost,
      finishing_cost: p.finishingCost,
      marble_cost: p.marbleCost,
      flooring_cost: p.flooringCost,
      steel_cost: p.steelCost,
      crushed_stone_cost: p.crushedStoneCost,
      bricks_cost: p.bricksCost,
      sand_cost: p.sandCost,
      stone_cost: p.stoneCost,
      gravel_cost: p.gravelCost,
      other_costs: p.otherCosts,
      other_cost_total: p.otherCostTotal,
      raw_materials_total: p.rawMaterialsTotal,
      base_cost: p.baseCost,
      labor_cost: p.laborCost,
      cement_cost: p.cementCost,
      extras_cost: p.extrasCost,
      total_cost: p.totalCost,
      per_m2: p.perM2,
      notes: p.notes || null,
      status: p.status
    };
  }

  function renderRows(filter = '') {
    const body = $('budgetTableBody');
    if (!body) return;
    const term = filter.trim().toLowerCase();
    const list = rows.filter(r => `${r.number} ${r.clientName} ${r.projectType}`.toLowerCase().includes(term));
    body.innerHTML = list.length
      ? list.map(r => `<tr><td><strong>${esc(r.number)}</strong></td><td>${esc(r.clientName)}</td><td>${esc(r.projectType)}</td><td>${money.format(r.totalCost)}</td><td>${statusLabel(r.status)}</td><td><div class="row-actions"><button type="button" data-budget-print="${r.id}">Imprimir</button><button type="button" data-budget-status="${r.id}">Status</button><button type="button" class="danger" data-budget-delete="${r.id}">Excluir</button></div></td></tr>`).join('')
      : '<tr><td colspan="6">Nenhum orçamento salvo.</td></tr>';
  }

  async function loadRows() {
    if (!sb) return;
    const { data, error } = await sb.from('quotes').select('*').order('created_at', { ascending:false });
    if (error) {
      const body = $('budgetTableBody');
      if (body) body.innerHTML = `<tr><td colspan="6">${/quotes|relation|schema cache|column/i.test(error.message || '') ? 'Execute a versão atualizada de QUERY-ORCAMENTOS.sql no Supabase para ativar todos os campos.' : esc(error.message)}</td></tr>`;
      return;
    }
    rows = (data || []).map(mapRow);
    renderRows($('budgetSearch')?.value || '');
  }

  function printDoc(p, auto = true) {
    if (!p) return;
    const w = window.open('', '_blank', 'width=900,height=900');
    if (!w) return alert('Libere pop-ups para imprimir o orçamento.');
    const number = p.number || 'PRÉVIA DE ORÇAMENTO';
    const logo = new URL('assets/logo.png', location.href).href;

    const costs = [
      ['Construção base', p.baseCost],
      ['Mão de obra', p.laborCost],
      ['Cimento', p.cementCost],
      ['Elétrica', p.electricalCost],
      ['Hidráulica', p.hydraulicCost],
      ['Acabamentos', p.finishingCost],
      ['Marmoraria', p.marbleCost],
      ['Piso / revestimentos', p.flooringCost],
      ['Ferragem / aço', p.steelCost],
      ['Brita', p.crushedStoneCost],
      ['Tijolos', p.bricksCost],
      ['Areia', p.sandCost],
      ['Pedras', p.stoneCost],
      ['Cascalhos', p.gravelCost]
    ];
    (p.otherCosts || []).forEach(item => {
      costs.push([`Outro — ${item.description || 'Sem descrição'}`, item.value]);
    });
    costs.push(['Custos extras', p.extrasCost]);

    const detail = costs
      .filter(([, value]) => Number(value || 0) > 0)
      .map(([k, v]) => `<div class="cell"><span>${esc(k)}</span><strong>${money.format(Number(v || 0))}</strong></div>`)
      .join('') +
      `<div class="cell"><span>Terreno</span><strong>${p.includeLand ? money.format(Number(p.landCost || 0)) : 'Não incluído'}</strong></div>` +
      `<div class="cell"><span>Custo por m²</span><strong>${money.format(Number(p.perM2 || 0))}</strong></div>`;

    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Orçamento ${esc(number)}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#13283a;margin:0;background:#eef2f4}.sheet{width:800px;max-width:100%;margin:24px auto;background:#fff;padding:40px}
      .head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f28c00;padding-bottom:18px}.head img{width:120px}.head div{text-align:right}.head h1{font-size:20px;margin:0;color:#082f54}.no{font-size:11px;color:#f28c00;font-weight:700;margin-top:5px}
      .title{margin:24px 0 10px;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#71808c;font-weight:700}.grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #dfe4e8}
      .cell{padding:12px;border-bottom:1px solid #dfe4e8}.cell:nth-child(odd){border-right:1px solid #dfe4e8}.cell span{display:block;font-size:8px;text-transform:uppercase;color:#87939c;font-weight:700}.cell strong{display:block;font-size:11px;margin-top:4px}
      .rawtotal{margin:12px 0;background:#edf3f7;border-left:4px solid #0a3558;padding:12px 14px;display:flex;justify-content:space-between;gap:15px;font-size:10px}.rawtotal strong{font-size:14px}
      .total{margin:20px 0;background:#082f54;color:#fff;padding:18px;display:flex;justify-content:space-between;align-items:center}.total strong{font-size:24px}.notes{border:1px solid #dfe4e8;padding:12px;min-height:55px;font-size:10px;white-space:pre-wrap}
      .warning{margin-top:24px;font-size:8px;color:#7b8790;line-height:1.5}.actions{text-align:center;margin:18px}.actions button{border:0;background:#f28c00;padding:12px 18px;font-weight:700;border-radius:8px}
      @media print{body{background:#fff}.sheet{margin:0;width:auto}.actions{display:none}}@media(max-width:650px){.sheet{margin:0;padding:20px}.grid{grid-template-columns:1fr}.cell:nth-child(odd){border-right:0}}
    </style></head><body><div class="sheet">
      <div class="head"><img src="${logo}" alt="Rodrigues Group"><div><h1>Orçamento detalhado de obra</h1><div class="no">${esc(number)}</div></div></div>
      <div class="title">Cliente</div><div class="grid"><div class="cell"><span>Nome</span><strong>${esc(p.clientName || 'Não informado')}</strong></div><div class="cell"><span>CPF / CNPJ</span><strong>${esc(p.clientDocument || 'Não informado')}</strong></div><div class="cell"><span>Telefone</span><strong>${esc(p.clientPhone || 'Não informado')}</strong></div><div class="cell"><span>E-mail</span><strong>${esc(p.clientEmail || 'Não informado')}</strong></div></div>
      <div class="title">Projeto</div><div class="grid"><div class="cell"><span>Tipo</span><strong>${esc(p.projectType)}</strong></div><div class="cell"><span>Área</span><strong>${Number(p.area || 0).toLocaleString('pt-BR')} m²</strong></div><div class="cell"><span>Padrão</span><strong>${esc(p.standardName || '')}</strong></div><div class="cell"><span>Status</span><strong>${esc(statusLabel(p.status))}</strong></div></div>
      <div class="title">Detalhamento dos custos</div><div class="grid">${detail}</div>
      <div class="rawtotal"><span>MATÉRIA-PRIMA / OUTROS</span><strong>${money.format(Number(p.rawMaterialsTotal || 0))}</strong></div>
      <div class="total"><span>VALOR TOTAL ESTIMADO</span><strong>${money.format(Number(p.totalCost || 0))}</strong></div>
      <div class="title">Observações</div><div class="notes">${esc(p.notes || 'Sem observações adicionais.')}</div>
      <div class="warning"><strong>Aviso:</strong> este documento registra uma estimativa/orçamento interno. Não substitui contrato, nota fiscal, ART/RRT, escritura ou documento legalmente exigido.</div>
    </div><div class="actions"><button onclick="window.print()">Imprimir / Salvar em PDF</button></div></body></html>`);
    w.document.close();
    w.focus();
    if (auto) setTimeout(() => w.print(), 350);
  }

  function reset() {
    $('budgetForm')?.reset();
    if ($('budgetArea')) $('budgetArea').value = 200;
    if ($('budgetStandard')) $('budgetStandard').value = 3200;
    if ($('budgetFloors')) $('budgetFloors').value = 1;
    if ($('budgetExtrasPercent')) $('budgetExtrasPercent').value = 8;
    if ($('budgetLaborPerM2')) $('budgetLaborPerM2').value = 950;
    if ($('budgetCementBagPrice')) $('budgetCementBagPrice').value = 42.90;
    if ($('budgetCementBagsPerM2')) $('budgetCementBagsPerM2').value = 1.4;
    if ($('budgetIncludeLand')) $('budgetIncludeLand').checked = true;
    restoreOtherRows([]);
    if ($('budgetMessage')) $('budgetMessage').textContent = '';
    calc();
  }

  injectRawMaterialFields();
  injectSummaryRows();

  $('addBudgetOtherBtn')?.addEventListener('click', () => {
    addOtherRow();
    calc();
  });

  $('budgetOtherList')?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-remove-other]');
    if (!btn) return;
    btn.closest('.budget-other-row')?.remove();
    if (!$('budgetOtherList')?.children.length) addOtherRow();
    calc();
  });

  $('budgetOtherList')?.addEventListener('input', calc);
  $('budgetForm')?.addEventListener('input', calc);
  $('budgetForm')?.addEventListener('change', calc);

  $('budgetForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!e.currentTarget.reportValidity()) return;
    if (!sb) {
      if ($('budgetMessage')) $('budgetMessage').textContent = 'Banco não configurado.';
      return;
    }
    const p = calc();
    if ($('budgetMessage')) $('budgetMessage').textContent = 'Salvando orçamento...';
    const { data, error } = await sb.from('quotes').insert(payload(p)).select('*').single();
    if (error) {
      if ($('budgetMessage')) {
        $('budgetMessage').textContent = /quotes|relation|schema cache|column/i.test(error.message || '')
          ? 'Atualize a tabela quotes: execute a versão mais recente de QUERY-ORCAMENTOS.sql no Supabase.'
          : error.message;
      }
      return;
    }
    const saved = mapRow(data);
    rows.unshift(saved);
    renderRows($('budgetSearch')?.value || '');
    if ($('budgetMessage')) $('budgetMessage').textContent = `Orçamento ${saved.number} salvo com sucesso.`;
    printDoc(saved, false);
  });

  $('printBudgetPreviewBtn')?.addEventListener('click', () => {
    const p = calc();
    if (!p.clientName) {
      if ($('budgetMessage')) $('budgetMessage').textContent = 'Informe o nome do cliente para imprimir a prévia.';
      return;
    }
    printDoc(p, false);
  });

  $('resetBudgetBtn')?.addEventListener('click', reset);
  $('newBudgetBtn')?.addEventListener('click', () => {
    reset();
    $('budgetForm')?.scrollIntoView({ behavior:'smooth', block:'start' });
  });
  $('budgetSearch')?.addEventListener('input', e => renderRows(e.target.value));

  $('budgetTableBody')?.addEventListener('click', async (e) => {
    const pbtn = e.target.closest('[data-budget-print]');
    if (pbtn) return printDoc(rows.find(r => r.id === pbtn.dataset.budgetPrint), true);

    const sbtn = e.target.closest('[data-budget-status]');
    if (sbtn) {
      const r = rows.find(x => x.id === sbtn.dataset.budgetStatus);
      if (!r) return;
      const order = ['draft','sent','approved','cancelled'];
      const next = order[(order.indexOf(r.status) + 1) % order.length];
      const { data, error } = await sb.from('quotes').update({ status:next }).eq('id', r.id).select('*').single();
      if (error) return alert(error.message);
      Object.assign(r, mapRow(data));
      return renderRows($('budgetSearch')?.value || '');
    }

    const dbtn = e.target.closest('[data-budget-delete]');
    if (dbtn) {
      const r = rows.find(x => x.id === dbtn.dataset.budgetDelete);
      if (!r || !confirm(`Excluir o orçamento ${r.number}?`)) return;
      const { error } = await sb.from('quotes').delete().eq('id', r.id);
      if (error) return alert(error.message);
      rows = rows.filter(x => x.id !== r.id);
      renderRows($('budgetSearch')?.value || '');
    }
  });

  document.getElementById('ownerNav')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-section="budgets"]');
    if (!b) return;
    setTimeout(() => {
      if ($('pageKicker')) $('pageKicker').textContent = 'CALCULADORA';
      if ($('pageTitle')) $('pageTitle').textContent = 'Custos e orçamentos';
      loadRows();
    }, 0);
  });

  calc();
  loadRows();
})();
