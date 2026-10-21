/* =====================================================================
 * r96 (20/10/26) — FLUXO DA ENTRADA (mesma conta no worker, na simulação
 * offline e na proposta)
 *  • O valor de entrada do cliente paga primeiro o SINAL REAL da unidade
 *    (R$ 10.000 no fluxo padrão; mais quando a entrada passa do padrão).
 *    Só o que passar do sinal abate o restante do fluxo (pré e pós-chaves).
 *  • Forma do sinal escolhida na simulação/proposta: 1x (à vista, no ato)
 *    até 4x (R$ 1.000 no ato + 30/60/90 dias). O total do sinal não muda.
 *  • Sinal nunca abaixo de R$ 10.000: se FGTS/subsídio deixariam a entrada
 *    menor, a diferença é devolvida na assinatura com o banco.
 * ------------------------------------------------------------------- */
var FPC_ATO = 1000, FPC_MES = 3000, FPC_SINAIS_BASE = 10000;
var FPC_BALOES = [['20/12/2027', 10000, 'Balão em dezembro/2027'], ['Entrega das chaves', 7000, 'Balão na entrega das chaves']];
var FPC_BALOES_BASE = 17000, FPC_M1A12 = 12 * 860, FPC_M13A24 = 12 * 330, FPC_POS_UNIT = 788.3332806666667;
var FPC_BASE_MEIO = FPC_BALOES_BASE + FPC_M1A12 + FPC_M13A24;
var FPC_BASE_CHEIA = FPC_SINAIS_BASE + FPC_BASE_MEIO + 24 * FPC_POS_UNIT;   // 60.200
var FPC_POS_PARCELAS = {24: 0, 36: 12, 48: 24};

function fpcR2(v){ return Math.round((Number(v) || 0) * 100) / 100; }
function fpcQtd(q){ var m = String(q || '').match(/^(\d+)\s*X$/i); return m ? Number(m[1]) : 1; }

/* o = {preco, financiado, fgts, subsidio, informado, nSinal (1..4), prazoEntrada, ano, mes (data de referência),
        diluir: [% 1º balão, % 2º balão] (0/25/50/75)} */
function fpcGerar(o){
  var prazo = Number(o.prazoEntrada) || 48;
  var nPos = FPC_POS_PARCELAS.hasOwnProperty(prazo) ? FPC_POS_PARCELAS[prazo] : 24;
  var basePos = nPos * FPC_POS_UNIT, baseMeio = FPC_BASE_CHEIA - FPC_SINAIS_BASE - basePos;
  var k = baseMeio / FPC_BASE_MEIO;
  var bM1 = FPC_M1A12 * k, bM13 = FPC_M13A24 * k;
  var nS = Math.max(1, Math.min(4, Math.round(Number(o.nSinal) || 4)));
  var inf = Number(o.informado) || 0;
  var B0 = (Number(o.preco) || 0) - (Number(o.financiado) || 0) - (Number(o.fgts) || 0) - (Number(o.subsidio) || 0);

  function sinalDe(T){
    if(T <= FPC_BASE_CHEIA + 0.01) return FPC_SINAIS_BASE;
    var g = (T - FPC_ATO - basePos) / (3 * FPC_MES + baseMeio);
    return FPC_ATO + 3 * FPC_MES * g;
  }
  /* o valor de entrada paga o sinal real; só o excedente abate o fluxo */
  var exc = 0, T = Math.max(B0, FPC_SINAIS_BASE);
  for(var it = 0; it < 60; it++){
    T = Math.max(B0 - exc, FPC_SINAIS_BASE);
    var nv = Math.max(0, inf - sinalDe(T));
    if(Math.abs(nv - exc) < 1e-7){ exc = nv; break; }
    exc = nv;
  }
  T = Math.max(B0 - exc, FPC_SINAIS_BASE);
  var calc = B0 - exc;
  var devolucao = calc < FPC_SINAIS_BASE ? FPC_SINAIS_BASE - Math.max(0, calc) : 0;

  var ato, s3, g, t12, t1324, tpos;
  if(T <= FPC_BASE_CHEIA + 0.01){
    ato = FPC_ATO; s3 = FPC_MES;
    g = (T - FPC_SINAIS_BASE) / (baseMeio + basePos);
    t12 = bM1 * g; t1324 = bM13 * g; tpos = basePos * g;
  } else {
    ato = FPC_ATO; tpos = basePos;
    g = (T - FPC_ATO - basePos) / (3 * FPC_MES + baseMeio);
    s3 = FPC_MES * g; t12 = bM1 * g; t1324 = bM13 * g;
  }
  var fatorBaloes = T <= FPC_SINAIS_BASE ? 0 : g;
  var meses = ((Number(o.ano) || 2026) - 2026) * 12 + ((Number(o.mes) || 11) - 11);
  var n1 = Math.max(1, Math.min(12, 12 - Math.max(0, meses)));

  var S = ato + 3 * s3, fl = [];
  if(nS === 1){
    fl.push(['Na assinatura', S, 'Sinal à vista / ato', 'sinal']);
  } else {
    var cada = (S - FPC_ATO) / (nS - 1);
    fl.push(['Na assinatura', FPC_ATO, 'Sinal / ato', 'sinal']);
    [30, 60, 90].slice(0, nS - 1).forEach(function(d){ fl.push([d + ' dias', cada, 'Sinal ' + d + ' dias', 'sinal']); });
  }
  if(t12 / n1 > 0.005) fl.push([n1 + ' X', t12 / n1, 'Parcelas meses 1 a ' + n1 + ' - DURANTE A OBRA', 'obra']);
  if(t1324 / 12 > 0.005) fl.push(['12 X', t1324 / 12, 'Parcelas meses 13 a 24 - DURANTE A OBRA', 'obra']);
  if(fatorBaloes > 0) FPC_BALOES.forEach(function(b){ fl.push([b[0], b[1] * k * fatorBaloes, b[2], 'balao']); });
  if(nPos && tpos / nPos > 0.005) fl.push([nPos + ' X', tpos / nPos, 'pós-chaves - PÓS A OBRA', 'pos']);

  /* fecha os centavos no último balão (ou na última linha que não é sinal) */
  fl.forEach(function(x){ x[1] = fpcR2(x[1]); });
  /* r96e — o excedente é medido sobre o sinal JÁ ARREDONDADO: assim a
     ENTRADA TOTAL e o "a pagar" do fluxo batem no centavo */
  var sR = fpcR2(fl.filter(function(x){ return x[3] === 'sinal'; }).reduce(function(s, x){ return s + x[1] * fpcQtd(x[0]); }, 0));
  T = Math.max(B0 - Math.max(0, inf - sR), FPC_SINAIS_BASE);
  var soma = fpcR2(fl.reduce(function(s, x){ return s + x[1] * fpcQtd(x[0]); }, 0));
  var dif = fpcR2(T - soma);
  if(dif){
    var alvo = -1, i;
    for(i = fl.length - 1; i >= 0; i--) if(fl[i][3] !== 'sinal' && fpcQtd(fl[i][0]) === 1){ alvo = i; break; }
    if(alvo < 0) for(i = fl.length - 1; i >= 0; i--) if(fl[i][3] !== 'sinal'){ alvo = i; break; }
    if(alvo < 0) alvo = fl.length - 1;
    if(alvo >= 0) fl[alvo][1] = fpcR2(fl[alvo][1] + dif / fpcQtd(fl[alvo][0]));
  }
  /* r96e (21/10/26) — DILUIR OS BALÕES NAS PARCELAS PRÉ-CHAVES (0/25/50/75%).
     Mesma regra do portal: o 1º balão (dez/2027) vai para o 1º bloco de
     parcelas pré-chaves e o balão das chaves para o 2º, pela quantidade de
     parcelas do bloco. O total não muda: os centavos ficam no balão.
     Cada linha alterada recebe o texto da diluição em x[4]. */
  var fluxoOriginal = fl.map(function(x){ return x.slice(0, 4); });
  var dil = fpcDiluir(fl, o.diluir);
  var sinaisTotal = fpcR2(fl.filter(function(x){ return x[3] === 'sinal'; })
    .reduce(function(s, x){ return s + x[1] * fpcQtd(x[0]); }, 0));
  var cobertos = fpcR2(Math.min(inf, sinaisTotal));
  return {total: fpcR2(T), entradaCliente: fpcR2(B0), fluxo: fl, n1: n1, nPos: nPos, nSinal: nS,
          devolucao: fpcR2(devolucao), totalCalculado: calc, excedente: fpcR2(Math.max(0, inf - sinaisTotal)),
          sinaisTotal: sinaisTotal, sinaisCobertos: cobertos, faltaSinais: fpcR2(Math.max(0, sinaisTotal - cobertos)),
          fluxoOriginal: fluxoOriginal, diluicao: dil};
}

/* diluir = [% do 1º balão, % do 2º balão] (0, 25, 50 ou 75). Altera fl e
   devolve os % aplicados. */
var FPC_DIL_OPC = [0, 25, 50, 75];
function fpcBrlTxt(v){
  var s = fpcR2(v).toFixed(2).split('.');
  return 'R$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1];
}
function fpcDiluir(fl, diluir){
  var pcts = [], obras = [], baloes = [];
  fl.forEach(function(x, i){ if(x[3] === 'obra') obras.push(i); else if(x[3] === 'balao') baloes.push(i); });
  baloes.forEach(function(bi, b){
    var pct = Math.round(Number((diluir || [])[b]) || 0);
    if(FPC_DIL_OPC.indexOf(pct) < 0) pct = 0;
    if(!pct || !obras.length){ pcts.push(0); return; }
    var ai = obras[Math.min(b, obras.length - 1)], fb = fl[bi], fa = fl[ai];
    var qtd = fpcQtd(fa[0]), vb = fb[1], va = fa[1];
    var add = fpcR2(vb * pct / 100 / qtd);
    if(add <= 0){ pcts.push(0); return; }
    fa[1] = fpcR2(va + add);
    fb[1] = fpcR2(vb - add * qtd);
    fa[4] = (fa[4] ? fa[4] + ' · ' : '') + '↻ + ' + fpcBrlTxt(add) + ' por parcela — ' + pct + '% do ' + fb[2].replace(/^Balão/, 'balão') + ' (era ' + fpcBrlTxt(va) + ')';
    fb[4] = '↻ ' + pct + '% diluído nas parcelas (era ' + fpcBrlTxt(vb) + ')';
    pcts.push(pct);
  });
  return pcts;
}
