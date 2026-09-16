(() => {
  'use strict';

  if (!/owner\.html$/i.test(location.pathname)) return;

  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const sb = window.RGCDB?.client;
  if (!sb) return;

  const style = document.createElement('style');
  style.textContent = `
    .budget-wrap{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.75fr);gap:18px;align-items:start}
    .budget-result{position:sticky;top:86px;padding:22px;border-radius:18px;background:#082f54;color:#fff}
    .budget-result .kicker{font-size:10px;letter-spacing:.12em;font-weight:800;color:#ffae38}
    .budget-total{font-size:32px;font-weight:800;margin:8px 0 18px;overflow-wrap:anywhere}
    .budget-lines{display:grid;gap:8px}.budget-lines>div{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.12);font-size:11px}.budget-lines span{color:#c7d3dc}.budget-lines strong{text-align:right}
    .budget-extra-title{margin:18px 0 10px;font-size:11px;font-weight:800;color:#082f54;text-transform:uppercase;letter-spacing:.08em}
    .budget-table .row-actions{display:flex;gap:6px;flex-wrap:wrap}.budget-table .row-actions button{white-space:nowrap}
    .budget-note{margin-top:12px;font-size:10px;line-height:1.5;color:#7d8993}
    .budget-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
    @media(max-width:1050px){.budget-wrap{grid-template-columns:1fr}.budget-result{position:static}}
  `;
  document.head.appendChild(style);

  const nav = document.getElementById('ownerNav');
  const content = document.querySelector('.content-area');
  if (!nav || !content || document.querySelector('[data-section="budgets"]')) return;

  const salesBtn = nav.querySelector('[data-section="sales"]');
  const calcBtn = document.createElement('button');
  calcBtn.type = 'button';
  calcBtn.className = 'nav-item';
  calcBtn.dataset.section = 'budgets';
  calcBtn.innerHTML = '<span>▧</span> Calculadora';
  nav.insertBefore(calcBtn, salesBtn || null);

  const salesPanel = content.querySelector('[data-panel="sales"]');
  const panel = document.createElement('section');
  panel.className = 'panel-section';
  panel.dataset.panel = 'budgets';
  panel.innerHTML = `
    <div class="section-toolbar">
      <div><span>ORÇAMENTOS</span><h2>Calculadora administrativa</h2><p>Monte custos, salve no banco e gere um comprovante detalhado para impressão.</p></div>
    </div>
    <div class="budget-wrap">
      <form class="panel-card form-card" id="budgetForm">
        <div class="form-title"><div><span>NOVO ORÇAMENTO</span><h3>Cliente e projeto</h3></div></div>
        <div class="form-grid">
          <label><span>Cliente *</span><input id="bClient" type="text" required></label>
          <label><span>CPF / CNPJ</span><input id="bDoc" type="text"></label>
          <label><span>Telefone</span><input id="bPhone" type="tel"></label>
          <label><span>E-mail</span><input id="bEmail" type="email"></label>
          <label class="wide"><span>Tipo de projeto</span><select id="bProject"><option>Construção residencial</option><option>Casa de alto padrão</option><option>Reforma / ampliação</option><option>Gestão de obra</option><option>Outro</option></select></label>
          <label><span>Área construída (m²)</span><input id="bArea" type="number" min="20" max="5000" step="1" value="200" required></label>
          <label><span>Padrão / referência por m²</span><select id="bStandard"><option value="2200">Econômico — R$ 2.200/m²</option><option value="3200" selected>Médio — R$ 3.200/m²</option><option value="4800">Alto padrão — R$ 4.800/m²</option><option value="7000">Luxo — R$ 7.000/m²</option></select></label>
          <label><span>Pavimentos</span><select id="bFloors"><option value="1">1 pavimento</option><option value="1.06">2 pavimentos (+6%)</option><option value="1.10">3 pavimentos (+10%)</option></select></label>
          <label><span>Custos extras (%)</span><input id="bExtras" type="number" min="0" max="100" step="1" value="8"></label>
        </div>

        <div class="budget-extra-title">Custos base</div>
        <div class="form-grid">
          <label><span>Mão de obra (R$/m²)</span><input id="bLabor" type="number" min="0" step="10" value="950"></label>
          <label><span>Cimento — saco 50 kg (R$)</span><input id="bCementPrice" type="number" min="0" step="0.01" value="42.90"></label>
          <label><span>Consumo de cimento (sacos/m²)</span><input id="bCementRate" type="number" min="0" step="0.1" value="1.4"></label>
          <label><span>Terreno / aquisição (R$)</span><input id="bLand" type="number" min="0" step="1000" value="0"></label>
        </div>
        <label class="check-row"><input id="bIncludeLand" type="checkbox" checked><span><strong>Incluir terreno no total</strong><small>Desmarque para calcular somente a construção.</small></span></label>

        <div class="budget-extra-title">Custos adicionais detalhados</div>
        <div class="form-grid">
          <label><span>Elétrica (R$)</span><input id="bElectrical" type="number" min="0" step="100" value="0"></label>
          <label><span>Hidráulica (R$)</span><input id="bHydraulic" type="number" min="0" step="100" value="0"></label>
          <label><span>Acabamentos (R$)</span><input id="bFinishing" type="number" min="0" step="100" value="0"></label>
          <label><span>Marmoraria (R$)</span><input id="bMarble" type="number" min="0" step="100" value="0"></label>
          <label><span>Piso / revestimentos (R$)</span><input id="bFlooring" type="number" min="0" step="100" value="0"></label>
          <label><span>Ferragem / aço (R$)</span><input id="bSteel" type="number" min="0" step="100" value="0"></label>
          <label><span>Status</span><select id="bStatus"><option value="draft">Rascunho</option><option value="sent">Enviado</option><option value="approved">Aprovado</option><option value="cancelled">Cancelado</option></select></label>
          <label class="wide"><span>Observações</span><textarea id="bNotes" rows="3" placeholder="Materiais, condições, validade, observações do projeto..."></textarea></label>
        </div>
        <div class="budget-actions"><button class="primary-btn" type="submit">Salvar orçamento</button><button class="secondary-btn" type="button" id="bPrint">Imprimir prévia</button><button class="secondary-btn" type="button" id="bReset">Limpar</button></div>
        <p class="form-message" id="bMessage" aria-live="polite"></p>
      </form>

      <aside class="budget-result" aria-live="polite">
        <span class="kicker">ESTIMATIVA ADMINISTRATIVA</span>
        <div class="budget-total" id="bTotal">R$ 0,00</div>
        <div class="budget-lines" id="bLines"></div>
        <p class="budget-note">Estimativa interna. Os valores podem ser revisados após visita técnica, projeto executivo e atualização de preços.</p>
      </aside>
    </div>

    <div class="panel-card list-card" style="margin-top:18px">
      <div class="list-head"><div><span>HISTÓRICO</span><h3>Orçamentos salvos</h3></div><input id="bSearch" type="search" placeholder="Buscar cliente..."></div>
      <div class="table-wrap"><table class="sales-table budget-table"><thead><tr><th>Nº</th><th>Cliente</th><th>Projeto</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody id="bTable"></tbody></table></div>
    </div>
    <div class="legal-warning" style="margin-top:16px"><strong>Importante:</strong> o documento gerado é um orçamento/comprovante de estimativa e não substitui contrato, nota fiscal, ART/RRT, escritura ou outro documento legalmente exigido.</div>
  `;
  content.insertBefore(panel, salesPanel || null);

  const $ = (id) => document.getElementById(id);
  let rows = [];
  let preview = null;

  const n = (id, min = 0, max = 100000000) => {
    const v = Number($(id)?.value);
    return Number.isFinite(v) ? Math.min(Math.max(v, min), max) : min;
  };
  const statusLabel = (s) => ({draft:'Rascunho',sent:'Enviado',approved:'Aprovado',cancelled:'Cancelado'}[s] || 'Rascunho');

  function calc() {
    const area = n('bArea', 20, 5000);
    const standardRate = n('bStandard', 0, 50000);
    const floorsFactor = n('bFloors', 1, 2);
    const extrasPercent = n('bExtras', 0, 100);
    const laborPerM2 = n('bLabor', 0, 10000);
    const cementBagPrice = n('bCementPrice', 0, 500);
    const cementBagsPerM2 = n('bCementRate', 0, 20);
    const landCost = n('bLand');
    const includeLand = $('bIncludeLand').checked;
    const electricalCost = n('bElectrical');
    const hydraulicCost = n('bHydraulic');
    const finishingCost = n('bFinishing');
    const marbleCost = n('bMarble');
    const flooringCost = n('bFlooring');
    const steelCost = n('bSteel');
    const baseCost = area * standardRate * floorsFactor;
    const laborCost = area * laborPerM2;
    const cementBags = area * cementBagsPerM2;
    const cementCost = cementBags * cementBagPrice;
    const direct = baseCost + laborCost + cementCost + electricalCost + hydraulicCost + finishingCost + marbleCost + flooringCost + steelCost;
    const extrasCost = direct * extrasPercent / 100;
    const totalCost = direct + extrasCost + (includeLand ? landCost : 0);
    const perM2 = area ? (totalCost - (includeLand ? landCost : 0)) / area : 0;
    preview = {
      clientName:$('bClient').value.trim(), clientDocument:$('bDoc').value.trim(), clientPhone:$('bPhone').value.trim(), clientEmail:$('bEmail').value.trim(),
      projectType:$('bProject').value, area, standardName:$('bStandard').selectedOptions[0]?.textContent || '', standardRate, floorsFactor,
      extrasPercent, laborPerM2, cementBagPrice, cementBagsPerM2, cementBags, landCost, includeLand,
      electricalCost, hydraulicCost, finishingCost, marbleCost, flooringCost, steelCost,
      baseCost, laborCost, cementCost, extrasCost, totalCost, perM2, notes:$('bNotes').value.trim(), status:$('bStatus').value
    };
    $('bTotal').textContent = money.format(totalCost);
    $('bLines').innerHTML = [
      ['Construção base',baseCost],['Mão de obra',laborCost],['Cimento',cementCost],['Elétrica',electricalCost],['Hidráulica',hydraulicCost],['Acabamentos',finishingCost],['Marmoraria',marbleCost],['Piso / revestimentos',flooringCost],['Ferragem / aço',steelCost],['Custos extras',extrasCost],['Terreno',includeLand?landCost:null],['Custo por m²',perM2]
    ].map(([k,v]) => `<div><span>${k}</span><strong>${v === null ? 'Não incluído' : money.format(v)}</strong></div>`).join('');
    return preview;
  }

  function mapRow(r) {
    return { id:r.id, number:r.quote_number, clientName:r.client_name || '', clientDocument:r.client_document || '', clientPhone:r.client_phone || '', clientEmail:r.client_email || '', projectType:r.project_type || '', area:Number(r.area||0), standardName:r.standard_name||'', standardRate:Number(r.standard_rate||0), floorsFactor:Number(r.floors_factor||1), extrasPercent:Number(r.extras_percent||0), laborPerM2:Number(r.labor_per_m2||0), cementBagPrice:Number(r.cement_bag_price||0), cementBagsPerM2:Number(r.cement_bags_per_m2||0), landCost:Number(r.land_cost||0), includeLand:Boolean(r.include_land), electricalCost:Number(r.electrical_cost||0), hydraulicCost:Number(r.hydraulic_cost||0), finishingCost:Number(r.finishing_cost||0), marbleCost:Number(r.marble_cost||0), flooringCost:Number(r.flooring_cost||0), steelCost:Number(r.steel_cost||0), baseCost:Number(r.base_cost||0), laborCost:Number(r.labor_cost||0), cementCost:Number(r.cement_cost||0), extrasCost:Number(r.extras_cost||0), totalCost:Number(r.total_cost||0), perM2:Number(r.per_m2||0), notes:r.notes||'', status:r.status||'draft', createdAt:r.created_at||'' };
  }

  async function loadRows() {
    const { data, error } = await sb.from('quotes').select('*').order('created_at', { ascending:false });
    if (error) {
      if (/quotes|relation|schema cache/i.test(error.message || '')) $('bTable').innerHTML = '<tr><td colspan="6">Execute o arquivo QUERY-ORCAMENTOS.sql no Supabase para ativar este módulo.</td></tr>';
      else $('bTable').innerHTML = `<tr><td colspan="6">${esc(error.message)}</td></tr>`;
      return;
    }
    rows = (data || []).map(mapRow);
    renderRows();
  }

  function renderRows(filter = '') {
    const term = filter.trim().toLowerCase();
    const list = rows.filter(r => `${r.number} ${r.clientName} ${r.projectType}`.toLowerCase().includes(term));
    $('bTable').innerHTML = list.length ? list.map(r => `<tr><td><strong>${esc(r.number)}</strong></td><td>${esc(r.clientName)}</td><td>${esc(r.projectType)}</td><td>${money.format(r.totalCost)}</td><td>${statusLabel(r.status)}</td><td><div class="row-actions"><button type="button" data-bprint="${r.id}">Imprimir</button><button type="button" data-bstatus="${r.id}">Status</button><button type="button" class="danger" data-bdelete="${r.id}">Excluir</button></div></td></tr>`).join('') : '<tr><td colspan="6">Nenhum orçamento salvo.</td></tr>';
  }

  function payload(p) {
    return { client_name:p.clientName, client_document:p.clientDocument||null, client_phone:p.clientPhone||null, client_email:p.clientEmail||null, project_type:p.projectType, area:p.area, standard_name:p.standardName, standard_rate:p.standardRate, floors_factor:p.floorsFactor, extras_percent:p.extrasPercent, labor_per_m2:p.laborPerM2, cement_bag_price:p.cementBagPrice, cement_bags_per_m2:p.cementBagsPerM2, land_cost:p.landCost, include_land:p.includeLand, electrical_cost:p.electricalCost, hydraulic_cost:p.hydraulicCost, finishing_cost:p.finishingCost, marble_cost:p.marbleCost, flooring_cost:p.flooringCost, steel_cost:p.steelCost, base_cost:p.baseCost, labor_cost:p.laborCost, cement_cost:p.cementCost, extras_cost:p.extrasCost, total_cost:p.totalCost, per_m2:p.perM2, notes:p.notes||null, status:p.status };
  }

  function printDoc(p, auto = true) {
    const w = window.open('', '_blank', 'width=900,height=900');
    if (!w) return alert('Libere pop-ups para imprimir o orçamento.');
    const number = p.number || 'PRÉVIA';
    const logo = new URL('assets/logo.png', location.href).href;
    const costs = [['Construção base',p.baseCost],['Mão de obra',p.laborCost],['Cimento',p.cementCost],['Elétrica',p.electricalCost],['Hidráulica',p.hydraulicCost],['Acabamentos',p.finishingCost],['Marmoraria',p.marbleCost],['Piso / revestimentos',p.flooringCost],['Ferragem / aço',p.steelCost],['Custos extras',p.extrasCost],['Terreno',p.includeLand?p.landCost:null]];
    const detail = costs.map(([k,v]) => `<div class="cell"><span>${k}</span><strong>${v===null?'Não incluído':money.format(Number(v||0))}</strong></div>`).join('');
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Orçamento ${esc(number)}</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#13283a;margin:0;background:#eef2f4}.sheet{width:800px;max-width:100%;margin:24px auto;background:#fff;padding:40px}.head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f28c00;padding-bottom:18px}.head img{width:120px}.head div{text-align:right}.head h1{font-size:20px;margin:0;color:#082f54}.no{font-size:11px;color:#f28c00;font-weight:700;margin-top:5px}.title{margin:24px 0 10px;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#71808c;font-weight:700}.grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #dfe4e8}.cell{padding:12px;border-bottom:1px solid #dfe4e8}.cell:nth-child(odd){border-right:1px solid #dfe4e8}.cell span{display:block;font-size:8px;text-transform:uppercase;color:#87939c;font-weight:700}.cell strong{display:block;font-size:11px;margin-top:4px}.total{margin:20px 0;background:#082f54;color:#fff;padding:18px;display:flex;justify-content:space-between;align-items:center}.total strong{font-size:24px}.notes{border:1px solid #dfe4e8;padding:12px;min-height:55px;font-size:10px}.warning{margin-top:24px;font-size:8px;color:#7b8790;line-height:1.5}.actions{text-align:center;margin:18px}.actions button{border:0;background:#f28c00;padding:12px 18px;font-weight:700;border-radius:8px}@media print{body{background:#fff}.sheet{margin:0;width:auto;box-shadow:none}.actions{display:none}}@media(max-width:650px){.sheet{margin:0;padding:20px}.grid{grid-template-columns:1fr}.cell:nth-child(odd){border-right:0}}</style></head><body><div class="sheet"><div class="head"><img src="${logo}" alt="Rodrigues Group"><div><h1>Orçamento / Comprovante de estimativa</h1><div class="no">${esc(number)}</div></div></div><div class="title">Cliente</div><div class="grid"><div class="cell"><span>Nome</span><strong>${esc(p.clientName||'Não informado')}</strong></div><div class="cell"><span>CPF / CNPJ</span><strong>${esc(p.clientDocument||'Não informado')}</strong></div><div class="cell"><span>Telefone</span><strong>${esc(p.clientPhone||'Não informado')}</strong></div><div class="cell"><span>E-mail</span><strong>${esc(p.clientEmail||'Não informado')}</strong></div></div><div class="title">Projeto</div><div class="grid"><div class="cell"><span>Tipo</span><strong>${esc(p.projectType)}</strong></div><div class="cell"><span>Área</span><strong>${Number(p.area||0).toLocaleString('pt-BR')} m²</strong></div><div class="cell"><span>Padrão</span><strong>${esc(p.standardName||'')}</strong></div><div class="cell"><span>Custo por m²</span><strong>${money.format(Number(p.perM2||0))}</strong></div></div><div class="title">Detalhamento dos custos</div><div class="grid">${detail}</div><div class="total"><span>VALOR TOTAL ESTIMADO</span><strong>${money.format(Number(p.totalCost||0))}</strong></div><div class="title">Observações</div><div class="notes">${esc(p.notes||'Sem observações adicionais.')}</div><div class="warning"><strong>Aviso:</strong> este documento registra uma estimativa/orçamento interno. Não substitui contrato, nota fiscal, ART/RRT, escritura ou documento legalmente exigido.</div></div><div class="actions"><button onclick="window.print()">Imprimir / Salvar em PDF</button></div></body></html>`);
    w.document.close(); w.focus(); if (auto) setTimeout(() => w.print(), 350);
  }

  $('budgetForm').addEventListener('input', calc);
  $('budgetForm').addEventListener('change', calc);
  $('budgetForm').addEventListener('submit', async (e) => {
    e.preventDefault(); if (!e.currentTarget.reportValidity()) return;
    const p = calc();
    $('bMessage').textContent = 'Salvando orçamento...';
    const { data, error } = await sb.from('quotes').insert(payload(p)).select('*').single();
    if (error) { $('bMessage').textContent = /quotes|relation|schema cache/i.test(error.message||'') ? 'A tabela quotes ainda não existe. Execute QUERY-ORCAMENTOS.sql no Supabase.' : error.message; return; }
    const saved = mapRow(data); rows.unshift(saved); renderRows($('bSearch').value); $('bMessage').textContent = `Orçamento ${saved.number} salvo com sucesso.`; printDoc(saved, false);
  });
  $('bPrint').addEventListener('click', () => printDoc(calc(), false));
  $('bReset').addEventListener('click', () => { $('budgetForm').reset(); $('bArea').value=200; $('bStandard').value=3200; $('bFloors').value=1; $('bExtras').value=8; $('bLabor').value=950; $('bCementPrice').value=42.90; $('bCementRate').value=1.4; $('bIncludeLand').checked=true; calc(); $('bMessage').textContent=''; });
  $('bSearch').addEventListener('input', e => renderRows(e.target.value));
  $('bTable').addEventListener('click', async (e) => {
    const pbtn = e.target.closest('[data-bprint]'); if (pbtn) return printDoc(rows.find(r => r.id === pbtn.dataset.bprint), true);
    const sbtn = e.target.closest('[data-bstatus]');
    if (sbtn) { const r = rows.find(x => x.id === sbtn.dataset.bstatus); if (!r) return; const order=['draft','sent','approved','cancelled']; const next=order[(order.indexOf(r.status)+1)%order.length]; const {data,error}=await sb.from('quotes').update({status:next}).eq('id',r.id).select('*').single(); if(error)return alert(error.message); Object.assign(r,mapRow(data)); return renderRows($('bSearch').value); }
    const dbtn = e.target.closest('[data-bdelete]');
    if (dbtn) { const r = rows.find(x => x.id === dbtn.dataset.bdelete); if (!r || !confirm(`Excluir o orçamento ${r.number}?`)) return; const {error}=await sb.from('quotes').delete().eq('id',r.id); if(error)return alert(error.message); rows=rows.filter(x=>x.id!==r.id); renderRows($('bSearch').value); }
  });

  nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-section="budgets"]');
    if (!b) return;
    setTimeout(() => { const k=$('pageKicker'), t=$('pageTitle'); if(k)k.textContent='CALCULADORA'; if(t)t.textContent='Custos e orçamentos'; loadRows(); }, 0);
  });

  const obs = new MutationObserver(() => { if (!document.getElementById('dashboardView')?.hidden) loadRows(); });
  const dash = document.getElementById('dashboardView'); if (dash) obs.observe(dash,{attributes:true,attributeFilter:['hidden']});
  calc();
})();
