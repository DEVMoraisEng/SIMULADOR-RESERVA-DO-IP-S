/* =====================================================================
 * r96 (20/10/26) — FLUXO DA ENTRADA (mesma conta no worker, na simulação
 * offline e na proposta)
 *  • r96i: TODO o valor do cliente vai para o SINAL (mínimo = sinal do fluxo
 *    padrão da unidade). O restante da entrada vai para pré e pós-chaves.
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

/* r97f (31/10/26, dono): 1ª parcela pré-chaves em novembro ou dezembro. Quem fecha até novembro/2026 escolhe
   nov ou dez/2026; depois disso, o mês da proposta ou o seguinte. As pré-chaves e os balões terminam SEMPRE até
   30/11/2028 (última parcela em out/2028, balão da entrega em nov/2028). */
var FPC_FIM_PRE = {ano: 2028, mes: 10}, FPC_LIMITE = '2028-11-30';
function fpcMesSeguinte(a, m){ return m === 12 ? {ano: a + 1, mes: 1} : {ano: a, mes: m + 1}; }
function fpcOpcoesPrimeira(ano, mes){
  var a = Number(ano) || 2026, m = Number(mes) || 11;
  if(a * 12 + m < 2026 * 12 + 11){ a = 2026; m = 11; }
  return [{ano: a, mes: m}, fpcMesSeguinte(a, m)];
}
/* o.primeira = {ano, mes} (uma das opções) ou "AAAA-MM"; inválida ou fora das opções -> 1ª opção */
function fpcPrimeira(o){
  var ops = fpcOpcoesPrimeira(o.ano, o.mes), p = o.primeira, mm;
  if(typeof p === 'string' && (mm = p.match(/^(\d{4})-(\d{2})/))) p = {ano: Number(mm[1]), mes: Number(mm[2])};
  for(var i = 0; p && i < ops.length; i++) if(ops[i].ano === Number(p.ano) && ops[i].mes === Number(p.mes)) return ops[i];
  return ops[0];
}
/* quantas pré-chaves cabem de {ano, mes} até out/2028 (24 em nov/2026, 23 em dez/2026...) */
function fpcQtdPre(p){ return Math.max(0, (FPC_FIM_PRE.ano * 12 + FPC_FIM_PRE.mes) - (p.ano * 12 + p.mes) + 1); }


function fpcR2(v){ return Math.round((Number(v) || 0) * 100) / 100; }
function fpcQtd(q){ var m = String(q || '').match(/^(\d+)\s*X$/i); return m ? Number(m[1]) : 1; }

/* o = {preco, financiado, fgts, subsidio, informado, nSinal (1..4), prazoEntrada, ano, mes (data de referência), primeira,
        diluir: [% 1º balão, % 2º balão] (0/25/50/75/100)}
   r96i (21/10/26) — TODO O VALOR DO CLIENTE VAI PARA O SINAL ("Valor para o sinal").
   O sinal mínimo é o do fluxo padrão da unidade; o cliente pode dar mais. O ato é
   sempre R$ 1.000 (em 1x o sinal inteiro é no ato) e o resto do sinal se divide
   em 30/60/90 dias. O que sobra da entrada (imóvel − financiado − FGTS − subsídio
   − sinal) vai para o pré-chaves (parcelas + balões) e o pós-chaves, na mesma
   proporção do fluxo padrão. */
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
  /* sinal mínimo = o do fluxo padrão; o sinal é o valor do cliente (nunca passa da entrada) */
  var T0 = Math.max(B0, FPC_SINAIS_BASE);
  var Smin = fpcR2(sinalDe(T0));
  var S = (inf >= Smin - 0.004) ? fpcR2(Math.min(inf, T0)) : Smin;
  var R = fpcR2(Math.max(0, B0 - S));
  var devolucao = B0 < FPC_SINAIS_BASE ? FPC_SINAIS_BASE - Math.max(0, B0) : 0;

  /* o restante da entrada: pré-chaves e pós-chaves na proporção do fluxo padrão */
  var g, tpos, baseResto = baseMeio + basePos;
  if(R <= baseResto + 0.01){ g = baseResto ? R / baseResto : 0; tpos = basePos * g; }
  else { g = baseMeio ? (R - basePos) / baseMeio : 0; tpos = basePos; }
  var t12 = bM1 * g, t1324 = bM13 * g;
  var fatorBaloes = R > 0.005 ? g : 0;
  /* r97f (31/10/26, dono): o mês da 1ª parcela pré-chaves é escolhido (o.primeira = {ano, mes}: nov ou dez/2026);
     sem escolha, vale o mês da proposta, como antes. A última pré-chaves é SEMPRE out/2028 e o balão da entrega
     nov/2028: começar um mês depois tira uma parcela da 1ª parte (dez/2026 = 23/35/47) e o valor de cada sobe. */
  var ini = fpcPrimeira(o);
  var meses = (ini.ano - 2026) * 12 + (ini.mes - 11);
  var n1 = Math.max(1, Math.min(12, 12 - Math.max(0, meses)));
  var erroPrazo = meses > 11 ? 'A 1ª parcela não pode passar de outubro/2027: as pré-chaves e os balões terminam até 30/11/2028' : '';

  var fl = [];
  if(nS === 1){
    fl.push(['Na assinatura', S, 'Sinal à vista / ato', 'sinal']);
  } else {
    var cada = fpcR2((S - FPC_ATO) / (nS - 1));
    fl.push(['Na assinatura', FPC_ATO, 'Sinal / ato', 'sinal']);
    [30, 60, 90].slice(0, nS - 1).forEach(function(d, j){
      var v = (j === nS - 2) ? fpcR2(S - FPC_ATO - cada * (nS - 2)) : cada;   // centavos no último
      fl.push([d + ' dias', v, 'Sinal ' + d + ' dias', 'sinal']);
    });
  }
  if(t12 / n1 > 0.005) fl.push([n1 + ' X', t12 / n1, 'Parcelas meses 1 a ' + n1 + ' - DURANTE A OBRA', 'obra']);
  if(t1324 / 12 > 0.005) fl.push(['12 X', t1324 / 12, 'Parcelas meses 13 a 24 - DURANTE A OBRA', 'obra']);
  if(fatorBaloes > 0) FPC_BALOES.forEach(function(b){ fl.push([b[0], b[1] * k * fatorBaloes, b[2], 'balao']); });
  if(nPos && tpos / nPos > 0.005) fl.push([nPos + ' X', tpos / nPos, 'pós-chaves - PÓS A OBRA', 'pos']);

  /* fecha os centavos no último balão (ou na última linha que não é sinal) */
  fl.forEach(function(x){ x[1] = fpcR2(x[1]); });
  var T = fpcR2(S + R);
  var soma = fpcR2(fl.reduce(function(s, x){ return s + x[1] * fpcQtd(x[0]); }, 0));
  var dif = fpcR2(T - soma);
  if(dif){
    var alvo = -1, i;
    for(i = fl.length - 1; i >= 0; i--) if(fl[i][3] !== 'sinal' && fpcQtd(fl[i][0]) === 1){ alvo = i; break; }
    if(alvo < 0) for(i = fl.length - 1; i >= 0; i--) if(fl[i][3] !== 'sinal'){ alvo = i; break; }
    if(alvo >= 0) fl[alvo][1] = fpcR2(fl[alvo][1] + dif / fpcQtd(fl[alvo][0]));
  }
  /* r96e — balões diluídos nas parcelas pré-chaves; o texto da linha vai em x[4] */
  var fluxoOriginal = fl.map(function(x){ return x.slice(0, 4); });
  var dil = fpcDiluir(fl, o.diluir);
  var cobertos = fpcR2(Math.min(inf, S));
  return {total: T, entradaCliente: fpcR2(B0), fluxo: fl, n1: n1, nPos: nPos, nSinal: nS,
          primeira: ini, nPre: n1 + 12, erroPrazo: erroPrazo,
          devolucao: fpcR2(devolucao), totalCalculado: B0 - Math.max(0, inf - S), excedente: fpcR2(Math.max(0, inf - S)),
          sinaisTotal: S, sinalMinimo: Smin, sinaisCobertos: cobertos, faltaSinais: fpcR2(Math.max(0, S - cobertos)),
          fluxoOriginal: fluxoOriginal, diluicao: dil};
}

/* diluir = [% do 1º balão, % do 2º balão] (0, 25, 50, 75 ou 100). Altera fl e
   devolve os % aplicados. Em 100% o balão some (fica só o centavo que não
   divide igual pelas parcelas, se houver). */
var FPC_DIL_OPC = [0, 25, 50, 75, 100];
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
    var add = pct === 100 ? Math.floor(vb / qtd * 100 + 1e-6) / 100 : fpcR2(vb * pct / 100 / qtd);
    if(add <= 0){ pcts.push(0); return; }
    fa[1] = fpcR2(va + add);
    fb[1] = fpcR2(vb - add * qtd);
    fa[4] = (fa[4] ? fa[4] + ' · ' : '') + '↻ + ' + fpcBrlTxt(add) + ' por parcela — ' + pct + '% do ' + fb[2].replace(/^Balão/, 'balão') + ' (era ' + fpcBrlTxt(va) + ')';
    fb[4] = '↻ ' + pct + '% diluído nas parcelas (era ' + fpcBrlTxt(vb) + ')';
    pcts.push(pct);
  });
  /* 100%: os centavos que não dividem igual pelas parcelas vão para o outro balão
     (se ele não foi diluído 100%), para não sobrar um balão de centavos */
  var resto = 0, ultimo100 = -1, alvoResto = -1;
  baloes.forEach(function(bi, b){
    if(pcts[b] === 100){ resto = fpcR2(resto + fl[bi][1]); fl[bi][1] = 0; ultimo100 = bi; }
    else if(fl[bi][1] > 0.004) alvoResto = bi;
  });
  if(resto > 0.004){
    if(alvoResto >= 0) fl[alvoResto][1] = fpcR2(fl[alvoResto][1] + resto);
    else fl[ultimo100][1] = resto;
  }
  return pcts;
}
