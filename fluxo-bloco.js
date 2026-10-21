/* =====================================================================
 * r96 (20/10/26) — COMPOSIÇÃO DO FLUXO DE PAGAMENTO + FLUXO DE PAGAMENTO
 * (SINAL · PRÉ-CHAVES · PÓS-CHAVES) — mesmo bloco no e-mail da proposta,
 * no e-mail da simulação (offline e worker), no portal e na tela da proposta.
 * ---------------------------------------------------------------------
 *  1) COMPOSIÇÃO: valor do imóvel − financiado − FGTS − subsídio − valor de
 *     entrada do cliente = ENTRADA TOTAL (o que fica para pagar no fluxo).
 *  2) FLUXO DE PAGAMENTO num quadro só: SINAL, PRÉ-CHAVES e PÓS-CHAVES.
 *     O valor de entrada do cliente paga primeiro o SINAL (na ordem
 *     ato → 30 → 60 → 90); o que passa do sinal abate o pré e o pós-chaves.
 *     O sinal aparece para mostrar para onde foi o dinheiro: a parte paga
 *     fica verde ("já abatido"); o que falta, em vermelho, com a data.
 *  fpResumo_(o) faz a conta; fpHtml_(c, opc) monta o HTML (estilo inline,
 *  serve para e-mail e tela). ES5 puro: roda no Apps Script e no navegador.
 *  o = {preco, financiado, fgts, subsidio, informado, devolucao,
 *       fluxo:[{quando, valor (número, por parcela), desc, grupo, i?, dilTxt?}]}
 * ------------------------------------------------------------------- */
var FP_SINAL_PADRAO_ = 10000;
function fpR2_(v){ return Math.round((Number(v) || 0) * 100) / 100; }
function fpQtd_(q){ var m = String(q || '').match(/^(\d+)\s*X$/i); return m ? Number(m[1]) : 1; }
function fpEsc_(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function fpBrl_(v){
  var n = fpR2_(v), neg = n < 0, s = Math.abs(n).toFixed(2).split('.');
  return (neg ? '-' : '') + 'R$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1];
}
function fpLimpa_(t){
  return String(t || '').replace(/\s*-\s*DURANTE A OBRA/i, '').replace(/\s*-\s*P[OÓ]S A OBRA/i, '')
    .replace(/\s*-\s*pago com o valor para entrada/i, '');
}
/* "À vista no ato" / "4x — R$ 1.000,00 no ato + 30, 60 e 90 dias" */
function fpFormaSinal_(sinais, B){
  B = B || fpBrl_;
  var n = sinais.length;
  if(!n) return '';
  if(n === 1) return 'à vista — 1x, no ato da assinatura';
  var dias = sinais.slice(1).map(function(x){ return String(x.quando).replace(/\s*dias?/i, ''); });
  var ult = dias.pop();
  return n + 'x — ' + B(Number(sinais[0].valor)) + ' no ato + ' + (dias.length ? dias.join(', ') + ' e ' : '') + ult + ' dias';
}

function fpResumo_(o){
  var preco = Number(o.preco) || 0, fin = Number(o.financiado) || 0;
  var fgts = Number(o.fgts) || 0, sub = Number(o.subsidio) || 0, inf = Number(o.informado) || 0;
  var fluxo = (o.fluxo || []).filter(function(x){ return x && (Number(x.valor) || 0) > 0.004; });
  var soma = function(arr){ return fpR2_(arr.reduce(function(s, x){ return s + Number(x.valor) * fpQtd_(x.quando); }, 0)); };
  var sinais = fluxo.filter(function(x){ return x.grupo === 'sinal'; });
  var pre = fluxo.filter(function(x){ return x.grupo === 'obra' || x.grupo === 'balao' || x.grupo === 'outro'; });
  var pos = fluxo.filter(function(x){ return x.grupo === 'pos'; });
  var S = soma(sinais), P = soma(pre), Q = soma(pos);
  /* o valor de entrada paga o sinal primeiro; o que passa dele abate pré/pós */
  var cobertos = fpR2_(Math.min(inf, S)), falta = fpR2_(Math.max(0, S - cobertos));
  var exc = fpR2_(Math.max(0, inf - S));
  var resta = cobertos, linhas = [], faltaEm = [];
  sinais.forEach(function(x){
    var v = fpR2_(Number(x.valor) * fpQtd_(x.quando)), p = fpR2_(Math.min(v, Math.max(0, resta)));
    resta = fpR2_(resta - p);
    var fl = fpR2_(v - p);
    linhas.push({quando: x.quando, desc: x.desc, valor: v, pago: p, falta: fl});
    if(fl > 0.004) faltaEm.push(x.quando);
  });
  var E = fpR2_(preco - fin - fgts - sub - inf);
  var devol = fpR2_(o.devolucao);
  return {preco: preco, fin: fin, fgts: fgts, sub: sub, informado: inf,
          entradaCliente: fpR2_(preco - fin - fgts - sub), E: E, devol: devol,
          sinais: sinais, pre: pre, pos: pos, S: S, P: P, Q: Q, total: fpR2_(S + P + Q),
          cobertos: cobertos, falta: falta, exc: exc, sinalLinhas: linhas, faltaEm: faltaEm,
          aPagar: fpR2_(falta + P + Q), nSinal: sinais.length};
}

/* opc = {B (formatador), notaFinanciado, mudou (array de i alterados), parte ('composicao'|'fluxo'),
          refazer (simulação: avisa quando o valor de entrada não cobre o sinal), financiadoBase}
   r96d — quadro limpo: só a composição e o fluxo, sem textos de explicação.
   O sinal pago com o valor de entrada vale R$ 0,00 no fluxo ("ABATIDO"). */
function fpHtml_(c, opc){
  opc = opc || {};
  var B = opc.B || fpBrl_, esc = fpEsc_;
  var TD = 'border:1px solid #E7DCC7;padding:6px 10px';
  var TAB = '<table style="border-collapse:collapse;width:100%;font-size:13px">';
  var VERDE = 'background:#EAF6EF;color:#1D5433', VERM = 'background:#FDECEA;color:#8A2E17';
  var mudou = opc.mudou || [];
  var falta = c.falta > 0.005;
  function linha(c1, c2, c3, est){
    est = est || '';
    return '<tr><td style="' + TD + ';' + est + '">' + c1 + '</td>' +
      '<td style="' + TD + ';text-align:right;white-space:nowrap;' + est + '">' + c2 + '</td>' +
      '<td style="' + TD + ';color:#6B5A45;font-size:12px;' + est + '">' + (c3 || '') + '</td></tr>';
  }
  function linha2(c1, c2, nota, est){
    est = est || '';
    return '<tr><td style="' + TD + ';' + est + '">' + c1 + (nota ? '<br><span style="font-size:11px;color:#6B5A45;font-weight:400">' + nota + '</span>' : '') + '</td>' +
      '<td style="' + TD + ';text-align:right;white-space:nowrap;width:150px;' + est + '">' + c2 + '</td></tr>';
  }
  function grupo(t, v, cor){
    return '<tr><td colspan="2" style="' + TD + ';background:' + cor + ';color:#fff;font-weight:800;font-size:12px">' + t + '</td>' +
      '<td style="' + TD + ';background:' + cor + ';color:#fff;font-weight:800;text-align:right;white-space:nowrap">' + v + '</td></tr>';
  }
  function titulo(t){ return '<h3 style="color:#7A4A16;font-size:14px;margin:18px 0 6px">' + t + '</h3>'; }
  function selo(t, cor){ return ' <span style="display:inline-block;background:' + cor + ';color:#fff;border-radius:9px;padding:1px 7px;font-size:10px;font-weight:800">' + t + '</span>'; }
  function valorLinha(x){ var q = fpQtd_(x.quando); return (q > 1 ? q + ' × ' : '') + B(Number(x.valor)); }

  /* 1) COMPOSIÇÃO DO FLUXO DE PAGAMENTO */
  var h = titulo('COMPOSIÇÃO DO FLUXO DE PAGAMENTO') + TAB +
    linha2('Valor do imóvel', B(c.preco)) +
    linha2('(−) Valor financiado pela Caixa', B(c.fin), opc.notaFinanciado || '') +
    linha2('(−) FGTS', B(c.fgts)) +
    linha2('(−) Subsídio', B(c.sub)) +
    linha2('(−) Valor para o sinal', B(c.informado), '', 'color:#7A4A16;font-weight:700') +
    linha2('<b>= ENTRADA TOTAL</b>', '<b>' + B(Math.max(0, c.E)) + '</b>', '', 'background:#FBEEC8;color:#5A3A0B') +
    (c.devol > 0.005 ? linha2('Diferença devolvida ao cliente', B(c.devol), 'no ato da assinatura do contrato com o banco', 'background:#FBEEC8;color:#7A4A16') : '') +
    '</table>';
  /* r96f — opc.parte: 'composicao' ou 'fluxo' devolve só aquela parte (a tela
     da simulação/proposta mostra as duas em lugares diferentes) */
  if(opc.parte === 'composicao') return h;
  if(opc.parte === 'fluxo') h = '';

  /* 2) FLUXO DE PAGAMENTO */
  h += titulo('FLUXO DE PAGAMENTO — SINAL · PRÉ-CHAVES · PÓS-CHAVES');
  if(opc.refazer && falta){
    var menor = Number(opc.financiadoBase) > c.fin + 0.5;
    h += '<div style="margin:0 0 8px;padding:12px 14px;background:#FDECEA;border:2px solid #C0392B;border-radius:6px;color:#8A2E17;font-size:13px;line-height:1.6">' +
      '<b>REFAÇA A SIMULAÇÃO.</b> ' + (menor ? 'O financiamento confirmado pela CAIXA (<b>' + B(c.fin) + '</b>) ficou menor que o estimado (<b>' +
      B(opc.financiadoBase) + '</b>) e o sinal subiu para <b>' + B(c.S) + '</b>. ' : 'O sinal desta unidade ficou em <b>' + B(c.S) + '</b>. ') +
      'O valor para o sinal informado (<b>' + B(c.informado) + '</b>) é menor que o sinal mínimo: faça uma nova simulação com valor para o sinal de no mínimo <b>' + B(c.S) + '</b>.</div>';
  }
  var forma = fpFormaSinal_(c.sinais, B) + (c.nSinal > 1 ? ' (ou à vista)' : '');
  var t = TAB + grupo('FLUXO DE PAGAMENTO — A PAGAR (entrada total)', B(c.aPagar), '#5A3A0B');
  t += grupo('1 · SINAL — ' + esc(forma) + (c.cobertos > 0.005 ? (falta ? ' · abatido em parte' : ' · ABATIDO') : ''), B(c.falta), '#2E8B57');
  c.sinalLinhas.forEach(function(x){
    var st, est;
    if(x.falta <= 0.004){ st = '✓ abatido (' + B(x.valor) + ')'; est = VERDE; }
    else if(x.pago > 0.004){ st = '<b>⚠ ' + B(x.pago) + ' abatido de ' + B(x.valor) + '</b>'; est = VERM; }
    else { st = '<b>⚠ a pagar</b>'; est = VERM; }
    t += linha(esc(x.quando) + ' — ' + esc(fpLimpa_(x.desc)), B(x.falta), st, est);
  });
  t += grupo('2 · PRÉ-CHAVES — durante a obra', B(c.P), '#1F6FB2');
  if(!c.pre.length) t += linha('Sem parcelas pré-chaves', '—', '');
  c.pre.forEach(function(x){
    var m = x.i != null && mudou.indexOf(x.i) >= 0;
    t += linha(esc(x.quando), valorLinha(x),
      esc(fpLimpa_(x.desc)) + (x.grupo === 'balao' ? selo('BALÃO', '#A86018') : selo('DURANTE A OBRA', '#1F6FB2')) +
      (m && x.dilTxt ? '<br><b style="color:#1D5433">' + esc(x.dilTxt) + '</b>' : ''), m ? VERDE + ';font-weight:700' : '');
  });
  t += grupo('3 · PÓS-CHAVES — depois da entrega', B(c.Q), '#5B4A8A');
  if(!c.pos.length) t += linha('Sem parcelas pós-chaves neste prazo', '—', '');
  c.pos.forEach(function(x){ t += linha(esc(x.quando), valorLinha(x), esc(fpLimpa_(x.desc)) + selo('PÓS A OBRA', '#5B4A8A')); });
  t += linha('<b>= A pagar no fluxo (entrada total)</b>', '<b>' + B(c.aPagar) + '</b>',
    (falta ? 'restante do sinal ' + B(c.falta) + ' + ' : '') + 'pré-chaves ' + B(c.P) + ' + pós-chaves ' + B(c.Q),
    'background:#FBEEC8;color:#5A3A0B') + '</table>';
  return h + t;
}
