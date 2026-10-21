/* =====================================================================
 * r96e (21/10/26) — DILUIR OS BALÕES NAS PARCELAS PRÉ-CHAVES (0/25/50/75%)
 * ---------------------------------------------------------------------
 * Botões por balão com a PRÉVIA ao vivo (como fica o balão e as parcelas),
 * na simulação e na proposta. A conta é a do fpcGerar (fluxo-calc.js) com
 * `diluir: [% 1º balão, % 2º balão]` — a mesma regra do portal: o 1º balão
 * (dez/2027) vai para o 1º bloco de parcelas pré-chaves e o balão das chaves
 * para o 2º. O total da entrada não muda. A Morais pode ajustar depois no
 * portal.
 *   DiluirUI.html(g, sel, fn) -> HTML dos botões e da prévia
 *        g   = retorno do fpcGerar (com fluxo e fluxoOriginal)
 *        sel = [% 1º balão, % 2º balão]
 *        fn  = nome da função global chamada no clique: fn(b, pct)
 *   DiluirUI.mudou(fluxo) -> índices das linhas alteradas (para o fpHtml_)
 * =================================================================== */
var DiluirUI = (function(){
  var OPC = [0, 25, 50, 75];
  function brl(v){
    var s = (Math.round((Number(v) || 0) * 100) / 100).toFixed(2).split('.');
    return 'R$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1];
  }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function css(){
    if(document.getElementById('css-diluir')) return;
    var st = document.createElement('style'); st.id = 'css-diluir';
    st.textContent =
      '.dil-box{border:1px solid #E7DCC7;border-radius:10px;background:#FFFDF7;padding:12px 14px;margin:0 0 12px}' +
      '.dil-box .dil-tit{font-weight:800;color:#7A4A16;font-size:13px;margin-bottom:2px}' +
      '.dil-box .dil-sub{font-size:12px;color:#6B5A45;margin-bottom:8px}' +
      '.dil-lin{border-top:1px dashed #E7DCC7;padding:9px 0 4px}' +
      '.dil-rot{font-size:13px;color:#3A2A18}.dil-rot small{display:block;color:#6B5A45;font-size:11.5px}' +
      '.dil-bts{display:flex;gap:6px;flex-wrap:wrap;margin:7px 0 6px}' +
      '.dil-bt{flex:1;min-width:70px;border:1px solid #E7DCC7;background:#fff;border-radius:7px;padding:7px 6px;font-weight:700;color:#7A4A16;cursor:pointer;font-size:13px}' +
      '.dil-bt.on{background:#FBEEC8;border-color:#A86018}' +
      '.dil-prev{font-size:12px;border-radius:6px;padding:6px 9px;background:#F6F0E3;color:#5A3A0B;line-height:1.5}' +
      '.dil-prev.on{background:#EAF6EF;color:#1D5433}.dil-prev s{opacity:.65}';
    document.head.appendChild(st);
  }
  function html(g, sel, fn){
    css();
    var orig = (g && g.fluxoOriginal) || [], novo = (g && g.fluxo) || [];
    var obras = [], baloes = [];
    orig.forEach(function(x, i){ if(x[3] === 'obra') obras.push(i); else if(x[3] === 'balao') baloes.push(i); });
    if(!baloes.length || !obras.length) return '';
    var linhas = baloes.map(function(bi, b){
      var ai = obras[Math.min(b, obras.length - 1)], fb = orig[bi], fa = orig[ai];
      var pct = Number((sel || [])[b]) || 0;
      var bts = OPC.map(function(o){
        return '<button type="button" class="dil-bt' + (o === pct ? ' on' : '') + '" onclick="' + fn + '(' + b + ',' + o + ')">' +
          (o ? o + '%' : 'Não diluir') + '</button>';
      }).join('');
      var prev = pct
        ? '<div class="dil-prev on">Balão: <s>' + brl(fb[1]) + '</s> → <b>' + brl(novo[bi][1]) + '</b> · ' +
          esc(fa[2].replace(/\s*-\s*DURANTE A OBRA/i, '')) + ': <s>' + esc(fa[0]) + ' ' + brl(fa[1]) + '</s> → <b>' +
          esc(novo[ai][0]) + ' ' + brl(novo[ai][1]) + '</b></div>'
        : '<div class="dil-prev">Sem diluição — balão de <b>' + brl(fb[1]) + '</b> (' + esc(fb[0]) + ').</div>';
      return '<div class="dil-lin"><div class="dil-rot"><b>' + esc(fb[2]) + '</b> · ' + brl(fb[1]) +
        '<small>diluir em: ' + esc(fa[2].replace(/\s*-\s*DURANTE A OBRA/i, '')) + ' (' + esc(fa[0]) + ')</small></div>' +
        '<div class="dil-bts">' + bts + '</div>' + prev + '</div>';
    }).join('');
    return '<div class="dil-box"><div class="dil-tit">Diluir balões nas parcelas pré-chaves</div>' +
      '<div class="dil-sub">Escolha quanto de cada balão vai para as parcelas durante a obra. O total da entrada não muda; ' +
      'as linhas alteradas ficam em verde no fluxo de pagamento.</div>' + linhas + '</div>';
  }
  function mudou(fluxo){
    var out = [];
    (fluxo || []).forEach(function(x, i){ if(x[4]) out.push(i); });
    return out;
  }
  return {html: html, mudou: mudou, OPC: OPC};
})();
