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
      unidade: u.unidade, tipo: String(u.tipo || ''), reservada: !!u.reservado, preco: preco, aval: aval, fin: fin, sinal: r2(sinal),
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
     'ITBI e registro grátis para a aquisição do primeiro imóvel, conforme proposta assinada.',
     '(R) = unidade reservada: aceita simulação e proposta, mas a proposta só é analisada se houver desistência.'];
  /* 08/11/2026 (dono) — texto de ATENÇÃO no topo (PDF, Excel e página) */
  var ATENCAO = 'ATENÇÃO: este é o FLUXO PADRÃO, considerando que o crédito liberado pela CAIXA será de 80% da avaliação do imóvel. ' +
    'Esse valor NÃO é garantido — o crédito real só é conhecido depois da análise de crédito do cliente. ' +
    'Se o crédito aprovado for menor, a entrada e o fluxo de pagamento mudam: para o fluxo do cliente, faça a simulação ou a proposta.';
  var SUBTIT = 'Financiamento de 80% da avaliação · sem FGTS e sem subsídio · sinal em 4x · entrada em 48 meses';

  /* 08/11/2026 (dono) — botões SIMULAR e SUBIR PASTA em cada linha: abrem o simulador / a proposta com a unidade já escolhida */
  function linkDe(pag, l){ return BASE + pag + '?tipo=' + encodeURIComponent(l.tipo || '') + '&unidade=' + encodeURIComponent(String(l.unidade)); }
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
      doc.text('CONDOMÍNIO RESERVA DO IPÊS - TABELA DE DISPONIBILIDADES', 10, 11.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      doc.text('Morais Engenharia e Construção · ' + dataBr, W - 10, 11.5, {align: 'right'});
      doc.setTextColor(27, 81, 115); doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
      doc.text(limpo(SUBTIT), 10, 25);
      /* faixa de ATENÇÃO */
      doc.setFillColor(255, 244, 214); doc.rect(8, 28, W - 16, 11, 'F');
      doc.setFillColor(183, 121, 31); doc.rect(8, 28, 1.4, 11, 'F');
      doc.setTextColor(122, 74, 22); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.2);
      doc.text(doc.splitTextToSize(limpo(ATENCAO), W - 24), 12, 32);
    }
    doc.autoTable({
      head: [['UN.'].concat(cab.slice(1).map(limpo), ['SIMULAR', 'SUBIR PASTA'])],
      body: lista.map(function(l){ return [String(l.unidade) + (l.reservada ? ' (R)' : ''), brl(l.preco), brl(l.aval), brl(l.fin), brl(l.sinal), brl(l.p1), brl(l.b1), brl(l.p2), brl(l.b2), brl(l.pos), 'SIMULAR', 'SUBIR PASTA']; }),
      startY: 42, margin: {top: 42, left: 8, right: 8, bottom: 14},
      theme: 'grid',
      styles: {font: 'helvetica', fontSize: 7.6, cellPadding: 1.25, overflow: 'visible', halign: 'right', valign: 'middle', lineColor: [213, 221, 227], lineWidth: 0.15, textColor: [30, 40, 50]},
      headStyles: {fillColor: [27, 81, 115], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 7.6, overflow: 'linebreak'},
      alternateRowStyles: {fillColor: [244, 247, 248]},
      columnStyles: (function(){ var w = [14, 24, 24, 26, 25, 22, 25, 21, 25, 22, 24, 29], o = {};   // 281 mm = A4 deitado menos as margens
        w.forEach(function(x, i){ o[i] = {cellWidth: x}; });
        o[0].halign = 'center'; o[0].fontStyle = 'bold'; o[3].fillColor = [204, 232, 230];
        o[10].halign = 'center'; o[10].fontStyle = 'bold'; o[10].fillColor = [239, 183, 0]; o[10].textColor = [122, 74, 22];
        o[11].halign = 'center'; o[11].fontStyle = 'bold'; o[11].fillColor = [39, 174, 96]; o[11].textColor = [255, 255, 255];
        return o; })(),
      didParseCell: function(d){   // o zebrado não pinta por cima dos botões
        if(d.section === 'body' && d.column.index >= 10) d.cell.styles.fillColor = d.column.index === 10 ? [239, 183, 0] : [39, 174, 96];
        if(d.section === 'body' && d.column.index >= 10) d.cell.styles.lineColor = [255, 255, 255];
        if(d.section === 'body' && d.column.index >= 10) d.cell.styles.lineWidth = 0.8;
      },
      didDrawCell: function(d){   // a célula inteira vira link
        if(d.section !== 'body' || d.column.index < 10) return;
        var l = lista[d.row.index]; if(!l) return;
        doc.link(d.cell.x, d.cell.y, d.cell.width, d.cell.height, {url: linkDe(d.column.index === 10 ? 'simulador.html' : 'proposta.html', l)});
      },
      didDrawPage: function(){
        topo();
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110, 120, 130);
        doc.text('Página ' + doc.internal.getNumberOfPages(), W - 10, H - 6, {align: 'right'});
      }
    });
    var y = doc.lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.8); doc.setTextColor(27, 81, 115);
    doc.text('Clique em SIMULAR ou SUBIR PASTA na linha da unidade para abrir o simulador / a proposta já com a unidade escolhida (no navegador, Ctrl + clique abre em nova aba).', 10, y);
    y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(90, 106, 118);
    AVISOS.forEach(function(t){
      var linhas = doc.splitTextToSize(limpo(t), W - 20);
      if(y + linhas.length * 3.6 > H - 12){ doc.addPage(); topo(); y = 45; doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(90, 106, 118); }
      doc.text(linhas, 10, y); y += linhas.length * 3.6 + 1.5;
    });
    baixar(doc.output('blob'), 'Tabela de disponibilidades - Reserva do Ipês - ' + dataBr.replace(/\//g, '-') + '.pdf', 'application/pdf');
  }

  /* 08/11/2026 — os dados da tabela (usados também pela página tabela.html) */
  window.tabelaDisponibilidadesDados = async function(unidades){
    await prontos('dados');
    var hoje = new Date();
    var lista = (unidades || []).filter(aVenda)
      .sort(function(a, b){ return (parseInt(a.unidade, 10) || 0) - (parseInt(b.unidade, 10) || 0); })
      .map(function(u){ return linhaDa(u, hoje); });
    var q1 = moda(lista, 'q1'), q2 = moda(lista, 'q2'), qp = moda(lista, 'qp'), b1q = moda(lista, 'b1q'), b2q = moda(lista, 'b2q');
    return {lista: lista, dataBr: hoje.toLocaleDateString('pt-BR'), atencao: ATENCAO, subtitulo: SUBTIT, avisos: AVISOS.slice(),
      cab: ['UNIDADE', 'VALOR', 'AVALIAÇÃO', 'FINANCIAMENTO (80% DA AVALIAÇÃO)', 'SINAL (ato + 30/60/90 dias)',
        'PARCELA 1' + (q1 ? ' (' + q1 + 'x)' : ''), 'BALÃO' + (b1q ? ' (' + b1q + ')' : ''),
        'PARCELA 2' + (q2 ? ' (' + q2 + 'x)' : ''), 'BALÃO' + (b2q ? ' (' + String(b2q).toLowerCase() + ')' : ''),
        'PÓS-CHAVES' + (qp ? ' (' + qp + 'x)' : '')],
      link: function(pag, l){ return linkDe(pag, l); }};
  };

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
    cab = cab.concat(['SIMULAR', 'SUBIR PASTA']);

    var wb = new ExcelJS.Workbook();
    wb.creator = 'Morais Engenharia e Construção'; wb.created = hoje;
    var ws = wb.addWorksheet('Tabela de disponibilidades', {views: [{state: 'frozen', ySplit: 4}], pageSetup: {orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0}});
    var NAVY = 'FF2A285F', PETROLEO = 'FF1B5173', MENTA = 'FFCCE8E6', CINZA = 'FFF4F7F8';
    var ncol = cab.length;

    ws.mergeCells(1, 1, 1, ncol);
    var t = ws.getCell(1, 1);
    t.value = 'CONDOMÍNIO RESERVA DO IPÊS — TABELA DE DISPONIBILIDADES';
    t.font = {bold: true, size: 15, color: {argb: 'FFFFFFFF'}};
    t.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: NAVY}};
    t.alignment = {vertical: 'middle', horizontal: 'left', indent: 1};
    ws.getRow(1).height = 28;

    ws.mergeCells(2, 1, 2, ncol);
    var s = ws.getCell(2, 1);
    s.value = SUBTIT + ' · gerado em ' + dataBr;
    s.font = {italic: true, size: 10, color: {argb: 'FF1B5173'}};
    s.alignment = {vertical: 'middle', horizontal: 'left', indent: 1};

    ws.mergeCells(3, 1, 3, ncol);
    var at = ws.getCell(3, 1);
    at.value = ATENCAO;
    at.font = {bold: true, size: 10, color: {argb: 'FF7A4A16'}};
    at.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFFFF4D6'}};
    at.alignment = {vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1};
    at.border = {left: {style: 'thick', color: {argb: 'FFB7791F'}}};
    ws.getRow(3).height = 46;

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
      if(l.reservada){ var cu = row.getCell(1); cu.value = un + ' (R)'; }
      /* botões da linha: links para o simulador e a proposta com a unidade escolhida */
      [[11, 'SIMULAR', 'simulador.html', 'FFEFB700', 'FF7A4A16'], [12, 'SUBIR PASTA', 'proposta.html', 'FF27AE60', 'FFFFFFFF']].forEach(function(bt){
        var c = row.getCell(bt[0]);
        c.value = {text: bt[1], hyperlink: linkDe(bt[2], l), tooltip: bt[1] + ' — unidade ' + un};
        c.font = {bold: true, color: {argb: bt[4]}};
        c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: bt[3]}};
        c.alignment = {vertical: 'middle', horizontal: 'center'};
        c.border = {top: {style: 'thin', color: {argb: 'FFFFFFFF'}}, bottom: {style: 'thin', color: {argb: 'FFFFFFFF'}},
                    left: {style: 'thin', color: {argb: 'FFFFFFFF'}}, right: {style: 'thin', color: {argb: 'FFFFFFFF'}}};
      });
    });

    var fim = 5 + lista.length + 1;
    AVISOS.forEach(function(txt, i){
      ws.mergeCells(fim + i, 1, fim + i, ncol);
      var c = ws.getCell(fim + i, 1);
      c.value = txt; c.font = {size: 9, color: {argb: 'FF5A6A76'}};
      c.alignment = {wrapText: true, vertical: 'top', indent: 1};
      ws.getRow(fim + i).height = 26;
    });

    [11, 16, 16, 20, 16, 15, 16, 15, 18, 15, 13, 15].forEach(function(w, i){ ws.getColumn(i + 1).width = w; });
    ws.autoFilter = {from: {row: 4, column: 1}, to: {row: 4 + lista.length, column: ncol}};

    var buf = await wb.xlsx.writeBuffer();
    baixar(buf, 'Tabela de disponibilidades - Reserva do Ipês - ' + dataBr.replace(/\//g, '-') + '.xlsx');
    return lista.length;
  };
})();
