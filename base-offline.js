/* =====================================================================
 * r96d (20/10/2026) — BASE OFFLINE NO NAVEGADOR
 * ---------------------------------------------------------------------
 * A simulação e a proposta (sem crédito aprovado) já mostram, antes do
 * envio, o financiamento estimado pela base offline (base/base_offline.csv,
 * a mesma que o worker e a nuvem usam). Com o financiamento e o FGTS dá
 * para calcular o SINAL da unidade — que vira o valor de entrada mínimo.
 * As regras de consulta são as mesmas de nuvemConsultar_ (NuvemOffline.gs)
 * e de worker/base_offline.py: perfil, sistema, idade e renda (interpolada).
 * Se mudar lá, muda aqui.
 *   BaseOffline.carregar()  -> Promise (baixa e indexa a base uma vez)
 *   BaseOffline.consultar(d) -> {financiamento, prestacao, prazo, ...}
 *        d = {possuiImovelCidade, jaBeneficiado, fgts3anos, sistemaAmortizacao,
 *             dataNascimento (AAAA-MM-DD), rendaIndividual, prazoMeses}
 *        lança {foraDaBase:true, message} quando não dá para estimar.
 * =================================================================== */
var BaseOffline = (function(){
  var URL_BASE = 'base/base_offline.csv';
  var cache = null, promessa = null;

  function num(v){
    if(v === null || v === undefined || v === '') return null;
    var n = Number(v); if(!isNaN(n)) return n;
    var m = String(v).match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null;
  }
  function r2(v){ return Math.round((Number(v) || 0) * 100) / 100; }
  function fora(msg){ var e = new Error(msg); e.foraDaBase = true; return e; }

  /* CSV com aspas (o campo "erro" pode ter vírgula) */
  function parseCsv(txt){
    var linhas = [], campo = '', linha = [], aspas = false, i, ch;
    for(i = 0; i < txt.length; i++){
      ch = txt[i];
      if(aspas){
        if(ch === '"'){ if(txt[i + 1] === '"'){ campo += '"'; i++; } else aspas = false; }
        else campo += ch;
      } else if(ch === '"') aspas = true;
      else if(ch === ','){ linha.push(campo); campo = ''; }
      else if(ch === '\n'){ linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
      else if(ch !== '\r') campo += ch;
    }
    if(campo !== '' || linha.length){ linha.push(campo); linhas.push(linha); }
    return linhas;
  }

  function indexar(txt){
    var linhas = parseCsv(txt);
    if(!linhas.length) throw fora('base offline vazia');
    var col = {};
    linhas[0].forEach(function(c, i){ col[String(c).trim().toLowerCase()] = i; });
    function cel(l, nome){ var i = col[nome]; return i === undefined ? '' : (l[i] == null ? '' : String(l[i])); }
    var ultimas = {};
    for(var k = 1; k < linhas.length; k++){
      var l = linhas[k];
      var perfil = cel(l, 'perfil').trim().toUpperCase();
      var sistema = (cel(l, 'sistema') || 'PRICE').trim().toUpperCase();
      var idade = parseInt(cel(l, 'idade'), 10), renda = Math.floor(Number(cel(l, 'renda')));
      if(!perfil || isNaN(idade) || isNaN(renda)) continue;
      ultimas[perfil + '|' + sistema + '|' + idade + '|' + renda] = l;   // a última linha da chave vence
    }
    var idx = {}, ok = 0;
    Object.keys(ultimas).forEach(function(ch){
      var l = ultimas[ch];
      if(cel(l, 'status') !== 'ok') return;
      var fin = num(cel(l, 'financiamento')), parc = num(cel(l, 'prestacao'));
      if(fin === null || parc === null) return;
      var p = ch.split('|'), chave = p[0] + '|' + p[1], idade = Number(p[2]), renda = Number(p[3]);
      ok++;
      idx[chave] = idx[chave] || {};
      idx[chave][idade] = idx[chave][idade] || {};
      idx[chave][idade][renda] = {
        financiamento: fin, prestacao: parc,
        prazo: num(cel(l, 'prazo')), comprometimento: num(cel(l, 'comprometimento')),
        produto: cel(l, 'produto').trim().replace(/^CC(?=SBPE)/, '')
      };
    });
    return {idx: idx, total: ok};
  }

  function carregar(){
    if(cache) return Promise.resolve(cache);
    if(promessa) return promessa;
    promessa = fetch(URL_BASE, {cache: 'default'}).then(function(r){
      if(!r.ok) throw fora('base offline indisponível (HTTP ' + r.status + ')');
      return r.text();
    }).then(function(t){ cache = indexar(t); return cache; });
    promessa.catch(function(){ promessa = null; });
    return promessa;
  }

  function perfilDe(d){
    if(d.possuiImovelCidade) return 'CASA';
    if(d.jaBeneficiado) return 'CASA';
    return 'FGTS';
  }
  function idadeDe(nasc){
    var t = String(nasc || '').slice(0, 10), a, m, dd;
    if(t.indexOf('-') >= 0){ var p = t.split('-'); a = +p[0]; m = +p[1]; dd = +p[2]; }
    else { var q = t.split('/'); dd = +q[0]; m = +q[1]; a = +q[2]; }
    if(!a || !m || !dd) throw fora('data de nascimento inválida');
    var h = new Date(), hy = h.getFullYear(), hm = h.getMonth() + 1, hd = h.getDate();
    return hy - a - ((hm < m || (hm === m && hd < dd)) ? 1 : 0);
  }
  function taxa(pv, pmt, n){
    pv = Number(pv); pmt = Number(pmt); n = Math.floor(Number(n));
    if(!(pv > 0 && pmt > 0 && n > 0) || pmt * n <= pv) return null;
    var lo = 1e-7, hi = 0.05;
    for(var i = 0; i < 200; i++){
      var mid = (lo + hi) / 2, val = pmt * (1 - Math.pow(1 + mid, -n)) / mid;
      if(val > pv) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function copia(o){ var c = {}; for(var k in o) c[k] = o[k]; return c; }

  /* porta do nuvemConsultar_ (NuvemOffline.gs) */
  function consultar(d){
    if(!cache) throw fora('base offline ainda não carregou');
    var perfil = perfilDe(d);
    var sistema = String(d.sistemaAmortizacao || 'PRICE').trim().toUpperCase();
    if(sistema !== 'PRICE' && sistema !== 'SAC') sistema = 'PRICE';
    var tab = cache.idx[perfil + '|' + sistema];
    if(!tab && sistema === 'SAC'){ tab = cache.idx[perfil + '|PRICE']; if(tab) sistema = 'PRICE'; }
    if(!tab) throw fora('a base não tem simulações para o perfil ' + perfil);
    var idade = idadeDe(d.dataNascimento), renda = Number(d.rendaIndividual || 0);
    if(!(renda > 0)) throw fora('renda não informada');
    var idades = Object.keys(tab).map(Number).sort(function(a, b){ return a - b; });
    var iRef, prazoIdade = null;
    if(idade < idades[0]) iRef = idades[0];
    else if(idade > idades[idades.length - 1]){
      iRef = idades[idades.length - 1];
      prazoIdade = Math.max(12, Math.floor((80.5 - idade) * 12));
    } else iRef = idades.filter(function(i){ return i >= idade; })[0];
    var pontos = tab[iRef], rendas = Object.keys(pontos).map(Number).sort(function(a, b){ return a - b; });
    var v;
    if(renda < rendas[0]){
      var r0 = rendas[0]; v = copia(pontos[r0]);
      var comp = v.comprometimento || (r0 ? v.prestacao / r0 * 100 : 30);
      var prest = r2(Math.min(v.prestacao, renda * comp / 100));
      var fator = v.prestacao ? prest / v.prestacao : renda / r0;
      v.financiamento = r2(v.financiamento * fator); v.prestacao = prest;
    } else if(renda >= rendas[rendas.length - 1]){
      v = copia(pontos[rendas[rendas.length - 1]]);
    } else if(pontos[renda]){
      v = copia(pontos[renda]);
    } else {
      var lo = rendas.filter(function(r){ return r <= renda; }).pop();
      var hi = rendas.filter(function(r){ return r >= renda; })[0];
      var a = pontos[lo], b = pontos[hi];
      if(a.produto === b.produto && hi > lo){
        var t = (renda - lo) / (hi - lo); v = copia(a);
        v.financiamento = r2(a.financiamento + t * (b.financiamento - a.financiamento));
        v.prestacao = r2(a.prestacao + t * (b.prestacao - a.prestacao));
      } else v = copia(a);
    }
    if(prazoIdade && v.prazo && prazoIdade < v.prazo){
      var n0 = Math.floor(v.prazo), tx = taxa(v.financiamento, v.prestacao, n0);
      var finNovo = tx ? v.prestacao * (1 - Math.pow(1 + tx, -prazoIdade)) / tx : v.financiamento * prazoIdade / n0;
      v.financiamento = r2(Math.min(v.financiamento, finNovo)); v.prazo = prazoIdade;
    }
    v.perfil = perfil; v.sistema = sistema; v.idade = idade; v.idade_ref = iRef;
    return v;
  }

  return {carregar: carregar, consultar: consultar, idadeDe: idadeDe};
})();
