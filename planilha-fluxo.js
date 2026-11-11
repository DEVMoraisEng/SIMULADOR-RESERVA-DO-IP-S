/* =====================================================================
 * planilha-fluxo.js — 07/11/2026 (dono)
 * TABELA DE DISPONIBILIDADES (.pdf / .xlsx) — fluxo padrão por unidade (nome mudado em 08/11/2026)
 * ---------------------------------------------------------------------
 * Usada no mapa de vendas (index.html) e na aba Propostas do portal.
 * Uma linha por unidade à venda (disponível ou reservada):
 *   UNIDADE · VALOR · AVALIAÇÃO · FINANCIAMENTO (80% DA AVALIAÇÃO) ·
 *   SINAL · PARCELA 1 · BALÃO · PARCELA 2 · BALÃO · PÓS-CHAVES
 * O fluxo é o padrão do simulador (fluxo-calc.js, fpcGerar): financiamento
 * de 80% da avaliação, sem FGTS e sem subsídio, sinal em 4x e entrada em
 * 48 meses, com as datas do mês em que a planilha é gerada.
 * Uso: planilhaFluxoPadrao(listaDeUnidades, formato) — formato 'xlsx' (padrão) ou 'pdf';
 *      cada unidade com {unidade, tipo, valorVenda, avaliacao, disponivel, reservado, vendido}
 * 08/11/2026 (dono): também em PDF (jsPDF + autoTable), mesmas colunas e avisos.
 * 10/11/2026 (dono): opção de entrada em 48, 36 ou 24 vezes e FGTS já abatido da entrada (página tabela.html: escolha
 *   no topo; PDF/Excel saem com a escolha). O Excel traz uma aba por prazo (48x, 36x e 24x), a escolhida primeiro.
 *   Uso: planilhaFluxoPadrao(unidades, formato, {prazo: 48|36|24, fgts: valor, fin: valor, finPor: {unidade: valor}})
 *   e tabelaDisponibilidadesDados(unidades, opcoes). 11/11: {ordem: 'unidade'|'preco'|'aval', desc: true|false}. fin/finPor = financiamento editado, sempre até 80% da avaliação.
 * 10/11/2026 (dono): Excel travado (proteção da planilha, senha ipes2026).
 * 10/11/2026 (dono): cores da logo do Reserva do Ipês e a logo (assets/logo-ipes-arvore.jpg) no topo.
 * ------------------------------------------------------------------- */
(function(){
  var BASE = 'https://devmoraiseng.github.io/SIMULADOR-RESERVA-DO-IP-S/';
  try{ if(document.currentScript && document.currentScript.src) BASE = document.currentScript.src.replace(/[^\/]*$/, ''); }catch(e){}

  function carregar(src){
    return new Promise(function(ok, falha){
      var s = document.createElement('script'); s.src = src;
      s.onload = function(){ ok(true); }; s.onerror = function(){ falha(new Error('não carregou ' + src)); };
      document.head.appendChild(s);
    });
  }
  function prontos(formato){
    var p = [];
    if(typeof fpcGerar !== 'function') p.push(carregar(BASE + 'fluxo-calc.js?v=' + Date.now()));
    if(formato === 'dados') return Promise.all(p);
    if(formato === 'pdf'){
      if(!(window.jspdf && window.jspdf.jsPDF)){
        return Promise.all(p.concat([carregar('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js')]))
          .then(function(){ return carregar('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js'); });
      }
      if(!(window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable))
        p.push(carregar('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js'));
      return Promise.all(p);
    }
    if(typeof ExcelJS === 'undefined') p.push(carregar('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'));
    return Promise.all(p);
  }
  /* 10/11/2026 (dono): cores da LOGO do Reserva do Ipês (marrom do tronco + flores amarela, rosa, lilás e cinza) e a
     logo na tabela (PDF, Excel e página). */
  var COR = {marrom: [168, 97, 35], marromEsc: [110, 62, 20], amarelo: [236, 195, 43], rosa: [233, 131, 169],
             lilas: [168, 143, 193], roxo: [126, 93, 175], cinza: [218, 223, 220], creme: [251, 246, 236],
             lilasClaro: [239, 233, 246], amareloClaro: [253, 243, 207], linha: [232, 220, 200]};
  function argb(c){ return 'FF' + c.map(function(x){ return ('0' + x.toString(16)).slice(-2); }).join('').toUpperCase(); }
  var LOGO_URL = BASE + 'assets/logo-ipes-arvore.jpg', logoB64 = null;
  function logo(){   // base64 (sem o prefixo) ou '' se não carregar — a tabela sai sem a logo
    if(logoB64 !== null) return Promise.resolve(logoB64);
    return fetch(LOGO_URL).then(function(r){ if(!r.ok) throw 0; return r.arrayBuffer(); }).then(function(buf){
      var b = new Uint8Array(buf), t = '';
      for(var i = 0; i < b.length; i += 0x8000) t += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      return (logoB64 = btoa(t));
    }).catch(function(){ return (logoB64 = ''); });
  }
  function r2(v){ return Math.round((Number(v) || 0) * 100) / 100; }
  function qtd(q){ var m = String(q || '').match(/^(\d+)\s*X$/i); return m ? Number(m[1]) : 1; }
  function aVenda(u){
    if(!u || u.vendido) return false;
    if(!(Number(u.valorVenda) > 0) || !(Number(u.avaliacao) > 0)) return false;
    return !!(u.disponivel || u.reservado);
  }
  var PRAZOS = [48, 36, 24];
  function opcoesDe(o){
    o = o || {};
    var pz = Number(o.prazo); if(PRAZOS.indexOf(pz) < 0) pz = 48;
    var por = {};
    if(o.finPor) Object.keys(o.finPor).forEach(function(k){ var v = r2(o.finPor[k]); if(v > 0) por[String(k)] = v; });
    /* 11/11/2026 (dono): ordenar só por UNIDADE, VALOR ou AVALIAÇÃO (crescente ou decrescente) */
    var ord = ['unidade', 'preco', 'aval'].indexOf(o.ordem) >= 0 ? o.ordem : 'unidade';
    return {prazo: pz, fgts: Math.max(0, r2(o.fgts)), fin: Math.max(0, r2(o.fin)), finPor: por, ordem: ord, desc: !!o.desc};
  }

  /* fluxo padrão de uma unidade → as colunas da planilha */
  function linhaDa(u, hoje, op){
    /* 10/11/2026 (dono): o financiamento pode ser editado (o geral para todas ou o de cada unidade), sempre até 80% da avaliação */
    var preco = Number(u.valorVenda) || 0, aval = Number(u.avaliacao) || 0, teto = r2(aval * 0.8);
    var pedido = op.finPor[String(u.unidade)] || op.fin || teto, fin = Math.min(pedido, teto);
    var fgts = Math.min(op.fgts, Math.max(0, r2(preco - fin)));   // o FGTS não passa da entrada
    var g = fpcGerar({preco: preco, financiado: fin, fgts: fgts, subsidio: 0, informado: 0, nSinal: 4,
                      prazoEntrada: op.prazo, ano: hoje.getFullYear(), mes: hoje.getMonth() + 1});
    var sinal = 0, obra = [], balao = [], pos = [];
    (g.fluxo || []).forEach(function(x){
      var grupo = x[3];
      if(grupo === 'sinal') sinal += Number(x[1]) * qtd(x[0]);
      else if(grupo === 'obra') obra.push(x);
      else if(grupo === 'balao') balao.push(x);
      else if(grupo === 'pos') pos.push(x);
    });
    return {
      unidade: u.unidade, tipo: String(u.tipo || ''), reservada: !!u.reservado, preco: preco, aval: aval, fin: fin, teto: teto, finEditado: fin < teto,
      fgts: fgts, sinal: r2(sinal),
      p1: obra[0] ? r2(obra[0][1]) : 0, q1: obra[0] ? qtd(obra[0][0]) : 0,
      b1: balao[0] ? r2(balao[0][1]) : 0, b1q: balao[0] ? String(balao[0][0]) : '',
      p2: obra[1] ? r2(obra[1][1]) : 0, q2: obra[1] ? qtd(obra[1][0]) : 0,
      b2: balao[1] ? r2(balao[1][1]) : 0, b2q: balao[1] ? String(balao[1][0]) : '',
      pos: pos[0] ? r2(pos[0][1]) : 0, qp: pos[0] ? qtd(pos[0][0]) : 0,
      total: r2(g.total)
    };
  }
  function moda(lista, campo){
    var c = {}, melhor = '', n = 0;
    lista.forEach(function(l){ var v = l[campo]; if(v === '' || v === 0 || v == null) return; c[v] = (c[v] || 0) + 1; if(c[v] > n){ n = c[v]; melhor = v; } });
    return melhor;
  }
  function baixar(buf, nome, tipo){
    var blob = buf instanceof Blob ? buf : new Blob([buf], {type: tipo || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function brl(v){ return 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}); }

  function avisosDe(op, lista){
    var a = ['Valores de referência (estimativa), calculados pelo fluxo padrão do simulador. As parcelas e os valores podem mudar conforme a data de assinatura do contrato.',
     'Sinal de no mínimo R$ 10.000,00; acima de uma entrada padrão o sinal cresce na proporção do fluxo. FGTS, subsídio ou valor para o sinal maior mudam o fluxo — para o fluxo do cliente, faça a simulação ou a proposta.',
     'Financiamento não garantido: sujeito à análise e aprovação de crédito pela CAIXA e à avaliação do imóvel. Se o crédito aprovado for menor, a entrada e/ou o saldo devido à incorporadora aumentam.'];
    if((lista || []).some(function(l){ return l.finEditado; }))
      a.push('Financiamento informado: onde ele é menor que 80% da avaliação, a diferença vai para a entrada (sinal, parcelas e balões aumentam).');
    if(op.fgts > 0) a.push('FGTS de ' + brl(op.fgts) + ' já abatido da entrada de cada unidade (nunca mais que a entrada). O uso do FGTS depende das regras e da liberação pela CAIXA.');
    a.push('ITBI e registro grátis para a aquisição do primeiro imóvel, conforme proposta assinada.',
     '(R) = unidade reservada: aceita simulação e proposta, mas a proposta só é analisada se houver desistência.');
    return a;
  }
  /* 08/11/2026 (dono) — texto de ATENÇÃO no topo (PDF, Excel e página) */
  var ATENCAO = 'ATENÇÃO: este é o FLUXO PADRÃO, considerando que o crédito liberado pela CAIXA será de 80% da avaliação do imóvel. ' +
    'Esse valor NÃO é garantido — o crédito real só é conhecido depois da análise de crédito do cliente. ' +
    'Se o crédito aprovado for menor, a entrada e o fluxo de pagamento mudam: para o fluxo do cliente, faça a simulação ou a proposta.';
  function subtituloDe(op, lista){
    var ed = (lista || []).some(function(l){ return l.finEditado; });
    return (ed ? 'Financiamento informado (no máximo 80% da avaliação)' : 'Financiamento de 80% da avaliação') + ' · ' + (op.fgts > 0 ? 'FGTS de ' + brl(op.fgts) + ' abatido' : 'sem FGTS') +
      ' · sem subsídio · sinal em 4x · entrada em ' + op.prazo + ' meses';
  }

  /* 08/11/2026 (dono) — botões SIMULAR e SUBIR PASTA em cada linha: abrem o simulador / a proposta com a unidade já
     escolhida (10/11: e com o prazo; o simulador recebe também o FGTS) */
  function linkDe(pag, l, op){
    var u = BASE + pag + '?tipo=' + encodeURIComponent(l.tipo || '') + '&unidade=' + encodeURIComponent(String(l.unidade));
    if(op && op.prazo) u += '&prazo=' + op.prazo;
    if(op && op.fgts > 0 && pag === 'simulador.html') u += '&fgts=' + op.fgts.toFixed(2);
    if(l.finEditado && pag === 'simulador.html') u += '&fin=' + Number(l.fin).toFixed(2);
    return u;
  }

  /* as colunas: o FGTS só aparece quando há FGTS; o PÓS-CHAVES some na entrada em 24x (não tem pós-chaves) */
  function montar(unidades, opcoes){
    var op = opcoesDe(opcoes), hoje = new Date();
    var lista = (unidades || []).filter(aVenda)
      .map(function(u){ return linhaDa(u, hoje, op); })
      .sort(function(a, b){
        var nu = (parseInt(a.unidade, 10) || 0) - (parseInt(b.unidade, 10) || 0);
        var d = op.ordem === 'unidade' ? nu : (a[op.ordem] - b[op.ordem]);
        if(op.desc) d = -d;
        return d || nu;   // empate: pela unidade
      });
    var q1 = moda(lista, 'q1'), q2 = moda(lista, 'q2'), qp = moda(lista, 'qp'), b1q = moda(lista, 'b1q'), b2q = moda(lista, 'b2q');
    var cols = [{k: 'unidade', t: 'UNIDADE', w: 14}, {k: 'preco', t: 'VALOR', w: 24}, {k: 'aval', t: 'AVALIAÇÃO', w: 24},
                {k: 'fin', t: lista.some(function(l){ return l.finEditado; }) ? 'FINANCIAMENTO (ATÉ 80% DA AVALIAÇÃO)' : 'FINANCIAMENTO (80% DA AVALIAÇÃO)', w: 26, destaque: true}];
    if(op.fgts > 0) cols.push({k: 'fgts', t: 'FGTS (abatido)', w: 22, destaque: true});
    cols.push({k: 'sinal', t: 'SINAL (ato + 30/60/90 dias)', w: 25},
      {k: 'p1', t: 'PARCELA 1' + (q1 ? ' (' + q1 + 'x)' : ''), w: 22},
      {k: 'b1', t: 'BALÃO' + (b1q ? ' (' + b1q + ')' : ''), w: 25},
      {k: 'p2', t: 'PARCELA 2' + (q2 ? ' (' + q2 + 'x)' : ''), w: 21},
      {k: 'b2', t: 'BALÃO' + (b2q ? ' (' + String(b2q).toLowerCase() + ')' : ''), w: 25});
    if(lista.some(function(l){ return l.pos > 0; })) cols.push({k: 'pos', t: 'PÓS-CHAVES' + (qp ? ' (' + qp + 'x)' : ''), w: 22});
    return {op: op, lista: lista, cols: cols, cab: cols.map(function(c){ return c.t; }), hoje: hoje, dataBr: hoje.toLocaleDateString('pt-BR'),
            subtitulo: subtituloDe(op, lista), avisos: avisosDe(op, lista)};
  }
  function nomeArq(M, ext){
    return 'Tabela de disponibilidades - Reserva do Ipês - ' + (ext === 'xlsx' ? '' : M.op.prazo + 'x - ') +
      (M.op.fgts > 0 ? 'FGTS ' + M.op.fgts.toLocaleString('pt-BR') + ' - ' : '') + M.dataBr.replace(/\//g, '-') + '.' + ext;
  }

  /* PDF: A4 deitado, cabeçalho com a logo, tabela com as mesmas colunas da planilha */
  function gerarPdf(M, lg){
    var lista = M.lista, cols = M.cols, dataBr = M.dataBr, op = M.op, nc = cols.length;
    var JS = window.jspdf.jsPDF, doc = new JS({orientation: 'landscape', unit: 'mm', format: 'a4'});
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    var limpo = function(t){ return String(t).replace(/—/g, '-'); };
    function cor(fn, c){ doc[fn](c[0], c[1], c[2]); }
    function topo(){
      /* cabeçalho branco com a logo, título no marrom do tronco e a faixa com as cores das flores */
      var xt = 10;
      if(lg){ try{ doc.addImage('data:image/jpeg;base64,' + lg, 'JPEG', 8, 2.2, 16.7, 18, 'logoIpes', 'FAST'); xt = 28; }catch(e){} }
      cor('setTextColor', COR.marrom); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
      doc.text('CONDOMÍNIO RESERVA DO IPÊS', xt, 10.5);
      cor('setTextColor', COR.marromEsc); doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
      doc.text('TABELA DE DISPONIBILIDADES · ENTRADA EM ' + op.prazo + 'x', xt, 16.5);
      doc.setFontSize(8.5); cor('setTextColor', [120, 100, 80]);
      doc.text('Morais Engenharia e Construção', W - 10, 10.5, {align: 'right'});
      doc.setFont('helvetica', 'bold'); cor('setTextColor', COR.marrom);
      doc.text(dataBr, W - 10, 16.5, {align: 'right'});
      var fx = [COR.amarelo, COR.rosa, COR.lilas, COR.cinza], wf = W / fx.length;
      fx.forEach(function(c, i){ cor('setFillColor', c); doc.rect(i * wf, 22, wf + 0.1, 1.6, 'F'); });
      cor('setTextColor', COR.marromEsc); doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
      doc.text(limpo(M.subtitulo), 10, 29);
      /* faixa de ATENÇÃO */
      cor('setFillColor', COR.amareloClaro); doc.rect(8, 31.5, W - 16, 11, 'F');
      cor('setFillColor', COR.marrom); doc.rect(8, 31.5, 1.4, 11, 'F');
      cor('setTextColor', COR.marromEsc); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.2);
      doc.text(doc.splitTextToSize(limpo(ATENCAO), W - 24), 12, 35.5);
    }
    /* larguras: as das colunas + os 2 botões, ajustadas para os 281 mm do A4 deitado menos as margens */
    var ws = cols.map(function(c){ return c.w; }).concat([24, 29]), soma = ws.reduce(function(a, b){ return a + b; }, 0);
    ws = ws.map(function(x){ return x * 281 / soma; });
    var iSim = nc, iProp = nc + 1;
    doc.autoTable({
      head: [['UN.'].concat(cols.slice(1).map(function(c){
        if(c.k === 'fin') return 'FINANCIAM. (' + (/ATÉ/.test(c.t) ? 'ATÉ ' : '') + '80% DA AVALIAÇÃO)';   // cabe na coluna sem quebrar a palavra
        return limpo(c.t); }), ['SIMULAR', 'SUBIR PASTA'])],
      body: lista.map(function(l){
        return cols.map(function(c){ return c.k === 'unidade' ? String(l.unidade) + (l.reservada ? ' (R)' : '') : brl(l[c.k]); }).concat(['SIMULAR', 'SUBIR PASTA']);
      }),
      startY: 46, margin: {top: 46, left: 8, right: 8, bottom: 14},
      theme: 'grid',
      styles: {font: 'helvetica', fontSize: nc > 11 ? 7.2 : 7.6, cellPadding: 1.25, overflow: 'visible', halign: 'right', valign: 'middle', lineColor: COR.linha, lineWidth: 0.15, textColor: [60, 40, 25]},
      headStyles: {fillColor: COR.marrom, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: nc > 11 ? 7.2 : 7.6, overflow: 'linebreak'},
      alternateRowStyles: {fillColor: COR.creme},
      columnStyles: (function(){ var o = {};
        ws.forEach(function(x, i){ o[i] = {cellWidth: x}; });
        o[0].halign = 'center'; o[0].fontStyle = 'bold'; o[0].textColor = COR.marrom;
        cols.forEach(function(c, i){ if(c.destaque) o[i].fillColor = COR.lilasClaro; });
        o[iSim].halign = 'center'; o[iSim].fontStyle = 'bold'; o[iSim].fillColor = COR.amarelo; o[iSim].textColor = COR.marromEsc;
        o[iProp].halign = 'center'; o[iProp].fontStyle = 'bold'; o[iProp].fillColor = COR.roxo; o[iProp].textColor = [255, 255, 255];
        return o; })(),
      didParseCell: function(d){   // o zebrado não pinta por cima dos botões
        if(d.section !== 'body' || d.column.index < iSim) return;
        d.cell.styles.fillColor = d.column.index === iSim ? COR.amarelo : COR.roxo;
        d.cell.styles.lineColor = [255, 255, 255]; d.cell.styles.lineWidth = 0.8;
      },
      didDrawCell: function(d){   // a célula inteira vira link
        if(d.section !== 'body' || d.column.index < iSim) return;
        var l = lista[d.row.index]; if(!l) return;
        doc.link(d.cell.x, d.cell.y, d.cell.width, d.cell.height, {url: linkDe(d.column.index === iSim ? 'simulador.html' : 'proposta.html', l, op)});
      },
      didDrawPage: function(){
        topo();
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); cor('setTextColor', [140, 115, 90]);
        doc.text('Página ' + doc.internal.getNumberOfPages(), W - 10, H - 6, {align: 'right'});
      }
    });
    var y = doc.lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.8); cor('setTextColor', COR.marrom);
    doc.text('Clique em SIMULAR ou SUBIR PASTA na linha da unidade para abrir o simulador / a proposta já com a unidade escolhida (no navegador, Ctrl + clique abre em nova aba).', 10, y);
    y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); cor('setTextColor', [110, 90, 70]);
    M.avisos.forEach(function(t){
      var linhas = doc.splitTextToSize(limpo(t), W - 20);
      if(y + linhas.length * 3.6 > H - 12){ doc.addPage(); topo(); y = 49; doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); cor('setTextColor', [110, 90, 70]); }
      doc.text(linhas, 10, y); y += linhas.length * 3.6 + 1.5;
    });
    baixar(doc.output('blob'), nomeArq(M, 'pdf'), 'application/pdf');
  }

  /* uma aba do Excel (um prazo) */
  async function abaExcel(wb, M, lg){
    var lista = M.lista, op = M.op, dataBr = M.dataBr;
    var cab = M.cab.concat(['SIMULAR', 'SUBIR PASTA']), ncol = cab.length, nc = M.cols.length;
    var ws = wb.addWorksheet('Entrada ' + op.prazo + 'x', {views: [{state: 'frozen', ySplit: 4}], pageSetup: {orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0}});
    var MARROM = argb(COR.marrom), MARROM_ESC = argb(COR.marromEsc), LILAS_CLARO = argb(COR.lilasClaro), CREME = argb(COR.creme);

    /* logo na 1ª coluna, título ao lado; a linha de baixo do título leva as cores das flores */
    ws.mergeCells(1, 2, 1, ncol);
    var t = ws.getCell(1, 2);
    t.value = {richText: [{text: 'CONDOMÍNIO RESERVA DO IPÊS', font: {bold: true, size: 16, color: {argb: MARROM}}},
                          {text: '\nTABELA DE DISPONIBILIDADES · ENTRADA EM ' + op.prazo + 'x', font: {size: 11, color: {argb: MARROM_ESC}}}]};
    t.alignment = {vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true};
    ws.getRow(1).height = 52;
    if(lg){
      try{ ws.addImage(wb.addImage({base64: lg, extension: 'jpeg'}), {tl: {col: 0.12, row: 0.08}, ext: {width: 60, height: 65}, editAs: 'oneCell'}); }catch(e){}
    }
    var fx = [COR.amarelo, COR.rosa, COR.lilas, COR.cinza];
    for(var cc = 1; cc <= ncol; cc++){
      ws.getCell(1, cc).border = {bottom: {style: 'thick', color: {argb: argb(fx[Math.min(fx.length - 1, Math.floor((cc - 1) * fx.length / ncol))])}}};
    }

    ws.mergeCells(2, 1, 2, ncol);
    var s = ws.getCell(2, 1);
    s.value = M.subtitulo + ' · gerado em ' + dataBr;
    s.font = {italic: true, size: 10, color: {argb: MARROM_ESC}};
    s.alignment = {vertical: 'middle', horizontal: 'left', indent: 1};

    ws.mergeCells(3, 1, 3, ncol);
    var at = ws.getCell(3, 1);
    at.value = ATENCAO;
    at.font = {bold: true, size: 10, color: {argb: MARROM_ESC}};
    at.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: argb(COR.amareloClaro)}};
    at.alignment = {vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1};
    at.border = {left: {style: 'thick', color: {argb: MARROM}}};
    ws.getRow(3).height = 46;

    var hr = ws.getRow(4);
    cab.forEach(function(h, i){
      var c = hr.getCell(i + 1);
      c.value = h;
      c.font = {bold: true, size: 10, color: {argb: 'FFFFFFFF'}};
      c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: MARROM}};
      c.alignment = {vertical: 'middle', horizontal: 'center', wrapText: true};
      c.border = {bottom: {style: 'medium', color: {argb: argb(COR.amarelo)}}};
    });
    hr.height = 34;

    var MOEDA = '"R$" #,##0.00';
    lista.forEach(function(l, k){
      var row = ws.getRow(5 + k);
      var un = String(l.unidade).trim();
      row.values = M.cols.map(function(c){ return c.k === 'unidade' ? (/^\d+$/.test(un) ? Number(un) : un) : l[c.k]; });
      row.eachCell(function(c, col){
        c.alignment = {vertical: 'middle', horizontal: col === 1 ? 'center' : 'right'};
        if(col > 1) c.numFmt = MOEDA;
        c.font = col === 1 ? {bold: true, color: {argb: MARROM}} : {color: {argb: 'FF3C2819'}};
        if(k % 2) c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: CREME}};
        c.border = {bottom: {style: 'hair', color: {argb: argb(COR.linha)}}};
      });
      M.cols.forEach(function(c, i){ if(c.destaque) row.getCell(i + 1).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: LILAS_CLARO}}; });
      if(l.reservada){ var cu = row.getCell(1); cu.value = un + ' (R)'; }
      /* botões da linha: links para o simulador e a proposta com a unidade escolhida */
      [[nc + 1, 'SIMULAR', 'simulador.html', argb(COR.amarelo), MARROM_ESC], [nc + 2, 'SUBIR PASTA', 'proposta.html', argb(COR.roxo), 'FFFFFFFF']].forEach(function(bt){
        var c = row.getCell(bt[0]);
        c.value = {text: bt[1], hyperlink: linkDe(bt[2], l, op), tooltip: bt[1] + ' — unidade ' + un};
        c.font = {bold: true, color: {argb: bt[4]}};
        c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: bt[3]}};
        c.alignment = {vertical: 'middle', horizontal: 'center'};
        c.border = {top: {style: 'thin', color: {argb: 'FFFFFFFF'}}, bottom: {style: 'thin', color: {argb: 'FFFFFFFF'}},
                    left: {style: 'thin', color: {argb: 'FFFFFFFF'}}, right: {style: 'thin', color: {argb: 'FFFFFFFF'}}};
      });
    });

    var fim = 5 + lista.length + 1;
    M.avisos.forEach(function(txt, i){
      ws.mergeCells(fim + i, 1, fim + i, ncol);
      var c = ws.getCell(fim + i, 1);
      c.value = txt; c.font = {size: 9, color: {argb: 'FF6E5A46'}};
      c.alignment = {wrapText: true, vertical: 'top', indent: 1};
      ws.getRow(fim + i).height = 26;
    });

    var larg = {unidade: 11, preco: 16, aval: 16, fin: 20, fgts: 16, sinal: 16, p1: 15, b1: 16, p2: 15, b2: 18, pos: 15};
    M.cols.map(function(c){ return larg[c.k] || 15; }).concat([13, 15]).forEach(function(w, i){ ws.getColumn(i + 1).width = w; });
    ws.autoFilter = {from: {row: 4, column: 1}, to: {row: 4 + lista.length, column: ncol}};
    /* 10/11/2026 (dono): planilha TRAVADA — ninguém altera valores nem colunas; dá para selecionar, copiar,
       filtrar e clicar nos botões SIMULAR / SUBIR PASTA. Senha para destravar: ipes2026 */
    await ws.protect('ipes2026', {spinCount: 1000, selectLockedCells: true, selectUnlockedCells: true, autoFilter: true, sort: false,
      formatCells: false, formatColumns: false, formatRows: false, insertColumns: false, insertRows: false, insertHyperlinks: false,
      deleteColumns: false, deleteRows: false, pivotTables: false, objects: false, scenarios: false});
  }

  /* 08/11/2026 — os dados da tabela (usados também pela página tabela.html) */
  window.tabelaDisponibilidadesDados = async function(unidades, opcoes){
    await prontos('dados');
    var M = montar(unidades, opcoes);
    return {lista: M.lista, cols: M.cols, cab: M.cab, opcoes: M.op, prazos: PRAZOS.slice(), dataBr: M.dataBr, atencao: ATENCAO,
      subtitulo: M.subtitulo, avisos: M.avisos, link: function(pag, l){ return linkDe(pag, l, M.op); }, logoUrl: LOGO_URL};
  };

  window.planilhaFluxoPadrao = async function(unidades, formato, opcoes){
    formato = formato === 'pdf' ? 'pdf' : 'xlsx';
    await prontos(formato);
    var M = montar(unidades, opcoes);
    if(!M.lista.length) throw new Error('Nenhuma unidade à venda com valor e avaliação preenchidos.');
    var lg = await logo();
    if(formato === 'pdf'){ gerarPdf(M, lg); return M.lista.length; }

    var wb = new ExcelJS.Workbook();
    wb.creator = 'Morais Engenharia e Construção'; wb.created = M.hoje;
    /* uma aba por prazo — a escolhida primeiro */
    var ordem = [M.op.prazo].concat(PRAZOS.filter(function(p){ return p !== M.op.prazo; }));
    for(var i = 0; i < ordem.length; i++){
      await abaExcel(wb, i === 0 ? M : montar(unidades, {prazo: ordem[i], fgts: M.op.fgts, fin: M.op.fin, finPor: M.op.finPor, ordem: M.op.ordem, desc: M.op.desc}), lg);
    }
    var buf = await wb.xlsx.writeBuffer();
    baixar(buf, nomeArq(M, 'xlsx'));
    return M.lista.length;
  };
})();
