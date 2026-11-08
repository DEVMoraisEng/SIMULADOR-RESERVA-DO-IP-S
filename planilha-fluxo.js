/* =====================================================================
 * planilha-fluxo.js — 07/11/2026 (dono)
 * PLANILHA DO FLUXO PADRÃO POR UNIDADE (.xlsx)
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
  function r2(v){ return Math.round((Number(v) || 0) * 100) / 100; }
  function qtd(q){ var m = String(q || '').match(/^(\d+)\s*X$/i); return m ? Number(m[1]) : 1; }
  function aVenda(u){
    if(!u || u.vendido) return false;
    if(!(Number(u.valorVenda) > 0) || !(Number(u.avaliacao) > 0)) return false;
    return !!(u.disponivel || u.reservado);
  }

  /* fluxo padrão de uma unidade → as colunas da planilha */
  function linhaDa(u, hoje){
    var preco = Number(u.valorVenda) || 0, aval = Number(u.avaliacao) || 0, fin = r2(aval * 0.8);
    var g = fpcGerar({preco: preco, financiado: fin, fgts: 0, subsidio: 0, informado: 0, nSinal: 4,
                      prazoEntrada: 48, ano: hoje.getFullYear(), mes: hoje.getMonth() + 1});
    var sinal = 0, obra = [], balao = [], pos = [];
    (g.fluxo || []).forEach(function(x){
      var grupo = x[3];
      if(grupo === 'sinal') sinal += Number(x[1]) * qtd(x[0]);
      else if(grupo === 'obra') obra.push(x);
      else if(grupo === 'balao') balao.push(x);
      else if(grupo === 'pos') pos.push(x);
    });
    return {
      unidade: u.unidade, preco: preco, aval: aval, fin: fin, sinal: r2(sinal),
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

  var AVISOS = ['Valores de referência (estimativa), calculados pelo fluxo padrão do simulador. As parcelas e os valores podem mudar conforme a data de assinatura do contrato.',
     'Sinal de no mínimo R$ 10.000,00; acima de uma entrada padrão o sinal cresce na proporção do fluxo. FGTS, subsídio ou valor para o sinal maior mudam o fluxo — para o fluxo do cliente, faça a simulação ou a proposta.',
     'Financiamento não garantido: sujeito à análise e aprovação de crédito pela CAIXA e à avaliação do imóvel. Se o crédito aprovado for menor, a entrada e/ou o saldo devido à incorporadora aumentam.',
     'ITBI e registro grátis para a aquisição do primeiro imóvel, conforme proposta assinada.'];
  var SUBTIT = 'Financiamento de 80% da avaliação · sem FGTS e sem subsídio · sinal em 4x · entrada em 48 meses';

  function brl(v){ return 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}); }
  /* PDF: A4 deitado, cabeçalho na cor da Morais, tabela com as mesmas colunas da planilha */
  function gerarPdf(lista, cab, dataBr){
    var JS = window.jspdf.jsPDF, doc = new JS({orientation: 'landscape', unit: 'mm', format: 'a4'});
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    var limpo = function(t){ return String(t).replace(/\u2014/g, '-'); };
    function topo(){
      doc.setFillColor(42, 40, 95); doc.rect(0, 0, W, 18, 'F');
      doc.setFillColor(129, 201, 192); doc.rect(0, 18, W, 1.2, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      doc.text('CONDOMÍNIO RESERVA DO IPÊS - FLUXO PADRÃO POR UNIDADE', 10, 11.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.text('Morais Engenharia e Construção · ' + dataBr, W - 10, 11.5, {align: 'right'});
      doc.setTextColor(27, 81, 115); doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
      doc.text(limpo(SUBTIT), 10, 25);
    }
    doc.autoTable({
      head: [cab.map(limpo)],
      body: lista.map(function(l){ return [String(l.unidade), brl(l.preco), brl(l.aval), brl(l.fin), brl(l.sinal), brl(l.p1), brl(l.b1), brl(l.p2), brl(l.b2), brl(l.pos)]; }),
      startY: 29, margin: {top: 29, left: 8, right: 8, bottom: 14},
      theme: 'grid',
      styles: {font: 'helvetica', fontSize: 8.2, cellPadding: 1.25, overflow: 'visible', halign: 'right', valign: 'middle', lineColor: [213, 221, 227], lineWidth: 0.15, textColor: [30, 40, 50]},
      headStyles: {fillColor: [27, 81, 115], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 7.6, overflow: 'linebreak'},
      alternateRowStyles: {fillColor: [244, 247, 248]},
      columnStyles: (function(){ var w = [17, 29, 29, 31, 31, 27, 29, 27, 33, 28], o = {};   // 281 mm = A4 deitado menos as margens
        w.forEach(function(x, i){ o[i] = {cellWidth: x}; });
        o[0].halign = 'center'; o[0].fontStyle = 'bold'; o[3].fillColor = [204, 232, 230];
        return o; })(),
      didDrawPage: function(){
        topo();
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110, 120, 130);
        doc.text('Página ' + doc.internal.getNumberOfPages(), W - 10, H - 6, {align: 'right'});
      }
    });
    var y = doc.lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(90, 106, 118);
    AVISOS.forEach(function(t){
      var linhas = doc.splitTextToSize(limpo(t), W - 20);
      if(y + linhas.length * 3.6 > H - 12){ doc.addPage(); topo(); y = 32; doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(90, 106, 118); }
      doc.text(linhas, 10, y); y += linhas.length * 3.6 + 1.5;
    });
    baixar(doc.output('blob'), 'Fluxo padrão - Reserva do Ipês - ' + dataBr.replace(/\//g, '-') + '.pdf', 'application/pdf');
  }

  window.planilhaFluxoPadrao = async function(unidades, formato){
    formato = formato === 'pdf' ? 'pdf' : 'xlsx';
    await prontos(formato);
    var hoje = new Date();
    var lista = (unidades || []).filter(aVenda)
      .sort(function(a, b){ return (parseInt(a.unidade, 10) || 0) - (parseInt(b.unidade, 10) || 0); })
      .map(function(u){ return linhaDa(u, hoje); });
    if(!lista.length) throw new Error('Nenhuma unidade à venda com valor e avaliação preenchidos.');

    var q1 = moda(lista, 'q1'), q2 = moda(lista, 'q2'), qp = moda(lista, 'qp'), b1q = moda(lista, 'b1q'), b2q = moda(lista, 'b2q');
    var dataBr = hoje.toLocaleDateString('pt-BR');
    var cab = ['UNIDADE', 'VALOR', 'AVALIAÇÃO', 'FINANCIAMENTO (80% DA AVALIAÇÃO)',
      'SINAL (ato + 30/60/90 dias)',
      'PARCELA 1' + (q1 ? ' (' + q1 + 'x)' : ''),
      'BALÃO' + (b1q ? ' (' + b1q + ')' : ''),
      'PARCELA 2' + (q2 ? ' (' + q2 + 'x)' : ''),
      'BALÃO' + (b2q ? ' (' + String(b2q).toLowerCase() + ')' : ''),
      'PÓS-CHAVES' + (qp ? ' (' + qp + 'x)' : '')];
    if(formato === 'pdf'){ gerarPdf(lista, cab, dataBr); return lista.length; }

    var wb = new ExcelJS.Workbook();
    wb.creator = 'Morais Engenharia e Construção'; wb.created = hoje;
    var ws = wb.addWorksheet('Fluxo padrão', {views: [{state: 'frozen', ySplit: 4}], pageSetup: {orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0}});
    var NAVY = 'FF2A285F', PETROLEO = 'FF1B5173', MENTA = 'FFCCE8E6', CINZA = 'FFF4F7F8';
    var ncol = cab.length;

    ws.mergeCells(1, 1, 1, ncol);
    var t = ws.getCell(1, 1);
    t.value = 'CONDOMÍNIO RESERVA DO IPÊS — FLUXO PADRÃO POR UNIDADE';
    t.font = {bold: true, size: 15, color: {argb: 'FFFFFFFF'}};
    t.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: NAVY}};
    t.alignment = {vertical: 'middle', horizontal: 'left', indent: 1};
    ws.getRow(1).height = 28;

    ws.mergeCells(2, 1, 2, ncol);
    var s = ws.getCell(2, 1);
    s.value = SUBTIT + ' · gerado em ' + dataBr;
    s.font = {italic: true, size: 10, color: {argb: 'FF1B5173'}};
    s.alignment = {vertical: 'middle', horizontal: 'left', indent: 1};

    var hr = ws.getRow(4);
    cab.forEach(function(h, i){
      var c = hr.getCell(i + 1);
      c.value = h;
      c.font = {bold: true, size: 10, color: {argb: 'FFFFFFFF'}};
      c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: PETROLEO}};
      c.alignment = {vertical: 'middle', horizontal: 'center', wrapText: true};
      c.border = {bottom: {style: 'medium', color: {argb: 'FF81C9C0'}}};
    });
    hr.height = 34;

    var MOEDA = '"R$" #,##0.00';
    lista.forEach(function(l, k){
      var row = ws.getRow(5 + k);
      var un = String(l.unidade).trim();
      row.values = [/^\d+$/.test(un) ? Number(un) : un, l.preco, l.aval, l.fin, l.sinal, l.p1, l.b1, l.p2, l.b2, l.pos];
      row.eachCell(function(c, col){
        c.alignment = {vertical: 'middle', horizontal: col === 1 ? 'center' : 'right'};
        if(col > 1) c.numFmt = MOEDA;
        if(col === 1) c.font = {bold: true};
        if(k % 2) c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: CINZA}};
        c.border = {bottom: {style: 'hair', color: {argb: 'FFD5DDE3'}}};
      });
      row.getCell(4).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: MENTA}};
    });

    var fim = 5 + lista.length + 1;
    AVISOS.forEach(function(txt, i){
      ws.mergeCells(fim + i, 1, fim + i, ncol);
      var c = ws.getCell(fim + i, 1);
      c.value = txt; c.font = {size: 9, color: {argb: 'FF5A6A76'}};
      c.alignment = {wrapText: true, vertical: 'top', indent: 1};
      ws.getRow(fim + i).height = 26;
    });

    [11, 16, 16, 20, 16, 15, 16, 15, 18, 15].forEach(function(w, i){ ws.getColumn(i + 1).width = w; });
    ws.autoFilter = {from: {row: 4, column: 1}, to: {row: 4 + lista.length, column: ncol}};

    var buf = await wb.xlsx.writeBuffer();
    baixar(buf, 'Fluxo padrão - Reserva do Ipês - ' + dataBr.replace(/\//g, '-') + '.xlsx');
    return lista.length;
  };
})();
