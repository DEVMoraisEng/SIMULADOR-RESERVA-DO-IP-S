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
  function gerarPdf(lista, cab, dataBr, lg){
    var JS = window.jspdf.jsPDF, doc = new JS({orientation: 'landscape', unit: 'mm', format: 'a4'});
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    var limpo = function(t){ return String(t).replace(/\u2014/g, '-'); };
    function cor(fn, c){ doc[fn](c[0], c[1], c[2]); }
    function topo(){
      /* cabeçalho branco com a logo, título no marrom do tronco e a faixa com as cores das flores */
      var xt = 10;
      if(lg){ try{ doc.addImage('data:image/jpeg;base64,' + lg, 'JPEG', 8, 2.2, 16.7, 18, 'logoIpes', 'FAST'); xt = 28; }catch(e){} }
      cor('setTextColor', COR.marrom); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
      doc.text('CONDOMÍNIO RESERVA DO IPÊS', xt, 10.5);
      cor('setTextColor', COR.marromEsc); doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
      doc.text('TABELA DE DISPONIBILIDADES', xt, 16.5);
      doc.setFontSize(8.5); cor('setTextColor', [120, 100, 80]);
      doc.text('Morais Engenharia e Construção', W - 10, 10.5, {align: 'right'});
      doc.setFont('helvetica', 'bold'); cor('setTextColor', COR.marrom);
      doc.text(dataBr, W - 10, 16.5, {align: 'right'});
      var fx = [COR.amarelo, COR.rosa, COR.lilas, COR.cinza], wf = W / fx.length;
      fx.forEach(function(c, i){ cor('setFillColor', c); doc.rect(i * wf, 22, wf + 0.1, 1.6, 'F'); });
      cor('setTextColor', COR.marromEsc); doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
      doc.text(limpo(SUBTIT), 10, 29);
      /* faixa de ATENÇÃO */
      cor('setFillColor', COR.amareloClaro); doc.rect(8, 31.5, W - 16, 11, 'F');
      cor('setFillColor', COR.marrom); doc.rect(8, 31.5, 1.4, 11, 'F');
      cor('setTextColor', COR.marromEsc); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.2);
      doc.text(doc.splitTextToSize(limpo(ATENCAO), W - 24), 12, 35.5);
    }
    doc.autoTable({
      head: [['UN.'].concat(cab.slice(1).map(limpo), ['SIMULAR', 'SUBIR PASTA'])],
      body: lista.map(function(l){ return [String(l.unidade) + (l.reservada ? ' (R)' : ''), brl(l.preco), brl(l.aval), brl(l.fin), brl(l.sinal), brl(l.p1), brl(l.b1), brl(l.p2), brl(l.b2), brl(l.pos), 'SIMULAR', 'SUBIR PASTA']; }),
      startY: 46, margin: {top: 46, left: 8, right: 8, bottom: 14},
      theme: 'grid',
      styles: {font: 'helvetica', fontSize: 7.6, cellPadding: 1.25, overflow: 'visible', halign: 'right', valign: 'middle', lineColor: COR.linha, lineWidth: 0.15, textColor: [60, 40, 25]},
      headStyles: {fillColor: COR.marrom, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 7.6, overflow: 'linebreak'},
      alternateRowStyles: {fillColor: COR.creme},
      columnStyles: (function(){ var w = [14, 24, 24, 26, 25, 22, 25, 21, 25, 22, 24, 29], o = {};   // 281 mm = A4 deitado menos as margens
        w.forEach(function(x, i){ o[i] = {cellWidth: x}; });
        o[0].halign = 'center'; o[0].fontStyle = 'bold'; o[0].textColor = COR.marrom; o[3].fillColor = COR.lilasClaro;
        o[10].halign = 'center'; o[10].fontStyle = 'bold'; o[10].fillColor = COR.amarelo; o[10].textColor = COR.marromEsc;
        o[11].halign = 'center'; o[11].fontStyle = 'bold'; o[11].fillColor = COR.roxo; o[11].textColor = [255, 255, 255];
        return o; })(),
      didParseCell: function(d){   // o zebrado não pinta por cima dos botões
        if(d.section === 'body' && d.column.index >= 10) d.cell.styles.fillColor = d.column.index === 10 ? COR.amarelo : COR.roxo;
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
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); cor('setTextColor', [140, 115, 90]);
        doc.text('Página ' + doc.internal.getNumberOfPages(), W - 10, H - 6, {align: 'right'});
      }
    });
    var y = doc.lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.8); cor('setTextColor', COR.marrom);
    doc.text('Clique em SIMULAR ou SUBIR PASTA na linha da unidade para abrir o simulador / a proposta já com a unidade escolhida (no navegador, Ctrl + clique abre em nova aba).', 10, y);
    y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); cor('setTextColor', [110, 90, 70]);
    AVISOS.forEach(function(t){
      var linhas = doc.splitTextToSize(limpo(t), W - 20);
      if(y + linhas.length * 3.6 > H - 12){ doc.addPage(); topo(); y = 49; doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); cor('setTextColor', [110, 90, 70]); }
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
      link: function(pag, l){ return linkDe(pag, l); }, logoUrl: LOGO_URL};
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
    var lg = await logo();
    if(formato === 'pdf'){ gerarPdf(lista, cab, dataBr, lg); return lista.length; }
    cab = cab.concat(['SIMULAR', 'SUBIR PASTA']);

    var wb = new ExcelJS.Workbook();
    wb.creator = 'Morais Engenharia e Construção'; wb.created = hoje;
    var ws = wb.addWorksheet('Tabela de disponibilidades', {views: [{state: 'frozen', ySplit: 4}], pageSetup: {orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0}});
    var MARROM = argb(COR.marrom), MARROM_ESC = argb(COR.marromEsc), LILAS_CLARO = argb(COR.lilasClaro), CREME = argb(COR.creme);
    var ncol = cab.length;

    /* logo na 1ª coluna, título ao lado; a linha de baixo do título leva as cores das flores */
    ws.mergeCells(1, 2, 1, ncol);
    var t = ws.getCell(1, 2);
    t.value = {richText: [{text: 'CONDOMÍNIO RESERVA DO IPÊS', font: {bold: true, size: 16, color: {argb: MARROM}}},
                          {text: '\nTABELA DE DISPONIBILIDADES', font: {size: 11, color: {argb: MARROM_ESC}}}]};
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
    s.value = SUBTIT + ' · gerado em ' + dataBr;
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
      row.values = [/^\d+$/.test(un) ? Number(un) : un, l.preco, l.aval, l.fin, l.sinal, l.p1, l.b1, l.p2, l.b2, l.pos];
      row.eachCell(function(c, col){
        c.alignment = {vertical: 'middle', horizontal: col === 1 ? 'center' : 'right'};
        if(col > 1) c.numFmt = MOEDA;
        c.font = col === 1 ? {bold: true, color: {argb: MARROM}} : {color: {argb: 'FF3C2819'}};
        if(k % 2) c.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: CREME}};
        c.border = {bottom: {style: 'hair', color: {argb: argb(COR.linha)}}};
      });
      row.getCell(4).fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: LILAS_CLARO}};
      if(l.reservada){ var cu = row.getCell(1); cu.value = un + ' (R)'; }
      /* botões da linha: links para o simulador e a proposta com a unidade escolhida */
      [[11, 'SIMULAR', 'simulador.html', argb(COR.amarelo), MARROM_ESC], [12, 'SUBIR PASTA', 'proposta.html', argb(COR.roxo), 'FFFFFFFF']].forEach(function(bt){
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
      c.value = txt; c.font = {size: 9, color: {argb: 'FF6E5A46'}};
      c.alignment = {wrapText: true, vertical: 'top', indent: 1};
      ws.getRow(fim + i).height = 26;
    });

    [11, 16, 16, 20, 16, 15, 16, 15, 18, 15, 13, 15].forEach(function(w, i){ ws.getColumn(i + 1).width = w; });
    ws.autoFilter = {from: {row: 4, column: 1}, to: {row: 4 + lista.length, column: ncol}};
    /* 10/11/2026 (dono): planilha TRAVADA — ninguém altera valores nem colunas; dá para selecionar, copiar,
       filtrar e clicar nos botões SIMULAR / SUBIR PASTA. Senha para destravar: ipes2026 */
    await ws.protect('ipes2026', {spinCount: 1000, selectLockedCells: true, selectUnlockedCells: true, autoFilter: true, sort: false,
      formatCells: false, formatColumns: false, formatRows: false, insertColumns: false, insertRows: false, insertHyperlinks: false,
      deleteColumns: false, deleteRows: false, pivotTables: false, objects: false, scenarios: false});

    var buf = await wb.xlsx.writeBuffer();
    baixar(buf, 'Tabela de disponibilidades - Reserva do Ipês - ' + dataBr.replace(/\//g, '-') + '.xlsx');
    return lista.length;
  };
})();
