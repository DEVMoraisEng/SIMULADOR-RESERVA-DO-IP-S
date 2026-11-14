/* =====================================================================
 * 14/11/2026 (dono) — SELETOR DE UNIDADE COM MAPINHA
 * Ao abrir a lista de unidades, abre ao lado o mapa do condomínio; passando
 * o mouse numa unidade da lista, ela acende no mapa (e vice-versa). Clicar na
 * lista OU no lote do mapa escolhe a unidade.
 *
 * O <select> original continua sendo a fonte da verdade (value, change e as
 * regras da página não mudam): este arquivo só troca a lista nativa — que não
 * avisa quando o mouse passa por cima das opções — por um painel próprio.
 * No celular (tela estreita ou toque) fica a lista nativa do aparelho.
 *
 * Uso: seletorComMapa(elementoSelect)
 * ===================================================================== */
(function(){
  var SVG_CAMINHO = 'assets/CONDOMINIO_VENDAS.svg', FUNDO = 'assets/mapa-fundo.jpg', CACHE = 'svgMapa-v2';
  var COR_LISTA = '#ECC32B', COR_FORA = '#9AA0A6', COR_HOVER = '#E0531F', COR_SEL = '#7E5DAF';
  var svgTexto = null, esperando = [];

  function pegarSvg(cb){
    if(svgTexto) return cb(svgTexto);
    try{ var c = localStorage.getItem(CACHE); if(c && c.indexOf('<svg') >= 0){ svgTexto = c; return cb(c); } }catch(e){}
    esperando.push(cb); if(esperando.length > 1) return;
    fetch(SVG_CAMINHO).then(function(r){ if(!r.ok) throw 0; return r.text(); }).then(function(t){
      svgTexto = t; try{ localStorage.setItem(CACHE, t); }catch(e){}
      var l = esperando; esperando = []; l.forEach(function(f){ f(t); });
    }).catch(function(){ var l = esperando; esperando = []; l.forEach(function(f){ f(null); }); });
  }
  function css(){
    if(document.getElementById('sm-css')) return;
    var s = document.createElement('style'); s.id = 'sm-css';
    s.textContent =
      '.sm-painel{position:absolute;z-index:999;display:flex;gap:12px;background:#fff;border:1px solid #E7DCC7;border-radius:12px;'+
        'box-shadow:0 12px 34px rgba(42,33,24,.25);padding:10px;font-family:inherit}'+
      '.sm-lista{width:330px;max-height:440px;overflow:auto;border-right:1px solid #F0E6D3;padding-right:6px}'+
      '.sm-op{padding:7px 10px;border-radius:7px;font-size:13.5px;cursor:pointer;color:#2A2118;white-space:nowrap}'+
      '.sm-op:hover,.sm-op.hv{background:#FDF0E8;color:#B0431F}'+
      '.sm-op.sel{background:#EFE9F6;color:#5B3F8C;font-weight:700}'+
      '.sm-op.vazio{color:#8a7a66;cursor:default}'+
      '.sm-mapa{width:620px;display:flex;flex-direction:column;gap:6px}'+
      '.sm-mapa .sm-svg{border-radius:8px;overflow:hidden;background:#EFE7D8;aspect-ratio:6090/3920}'+
      '.sm-mapa svg{display:block;width:100%;height:auto}'+
      '.sm-mapa polygon{stroke:#A86018;stroke-width:3;transition:fill .08s}'+
      '.sm-mapa polygon.sm-ok{cursor:pointer}'+
      '.sm-rot{font-size:12.5px;color:#6B5A45;min-height:18px}'+
      '.sm-rot b{color:#B0431F}'+
      '.sm-leg{display:flex;gap:12px;font-size:11.5px;color:#6B5A45}'+
      '.sm-leg i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:4px;vertical-align:-1px}';
    document.head.appendChild(s);
  }
  function rgba(hex, a){ var n = parseInt(hex.slice(1), 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function numUn(v){ var n = parseInt(String(v).replace(/\D/g, ''), 10); return isNaN(n) ? null : n; }
  function celular(){ return window.innerWidth < 760 || (window.matchMedia && matchMedia('(pointer:coarse)').matches); }

  window.seletorComMapa = function(sel){
    if(!sel || sel.dataset.smLigado) return;
    sel.dataset.smLigado = '1'; css();
    var painel = null, lista = null, caixaSvg = null, rot = null, aberto = false;

    function opcoes(){ return [].slice.call(sel.options).filter(function(o){ return o.value !== '' && numUn(o.value) != null; }); }
    function pintar(destaque){
      if(!caixaSvg) return;
      var na = {}; opcoes().forEach(function(o){ na[numUn(o.value)] = o; });
      caixaSvg.querySelectorAll('polygon[data-un]').forEach(function(p){
        var n = Number(p.dataset.un);
        var cor = na[n] ? COR_LISTA : COR_FORA, a = na[n] ? 0.45 : 0.25;
        if(na[n] && String(numUn(sel.value)) === String(n)){ cor = COR_SEL; a = 0.85; }
        if(destaque != null && n === destaque){ cor = COR_HOVER; a = 0.95; }
        p.style.fill = rgba(cor, a);
        p.style.strokeWidth = (destaque === n) ? '9' : '3';
        p.classList.toggle('sm-ok', !!na[n]);
      });
      if(rot){
        var o = destaque != null ? na[destaque] : null;
        rot.innerHTML = o ? '<b>' + o.text.replace(/</g, '&lt;') + '</b>'
                          : (destaque != null ? 'Unidade ' + destaque + ' — não está na lista' : 'Passe o mouse na lista ou no mapa');
      }
    }
    function marcarLista(n){
      if(!lista) return;
      lista.querySelectorAll('.sm-op').forEach(function(d){ d.classList.toggle('hv', n != null && numUn(d.dataset.v) === n); });
    }
    function escolher(v){
      if(String(sel.value) !== String(v)){ sel.value = v; sel.dispatchEvent(new Event('change', {bubbles:true})); sel.dispatchEvent(new Event('input', {bubbles:true})); }
      fechar(); sel.focus();
    }
    function montarLista(){
      var ops = opcoes();
      lista.innerHTML = ops.length ? '' : '<div class="sm-op vazio">Nenhuma unidade na lista.</div>';
      ops.forEach(function(o){
        var d = document.createElement('div');
        d.className = 'sm-op' + (o.value === sel.value ? ' sel' : ''); d.dataset.v = o.value; d.textContent = o.text;
        d.addEventListener('mouseenter', function(){ pintar(numUn(o.value)); marcarLista(numUn(o.value)); });
        d.addEventListener('click', function(){ escolher(o.value); });
        lista.appendChild(d);
      });
      lista.addEventListener('mouseleave', function(){ pintar(null); marcarLista(null); });
      var s = lista.querySelector('.sel'); if(s) s.scrollIntoView({block:'center'});
    }
    function ligarSvg(txt){
      if(!painel) return;
      if(!txt){ caixaSvg.textContent = 'Não consegui carregar o mapa.'; return; }
      var tmp = document.createElement('div'); tmp.innerHTML = txt;
      var svg = tmp.querySelector('svg'); if(!svg) return;
      svg.removeAttribute('width'); svg.removeAttribute('height'); svg.removeAttribute('id');
      var f = svg.querySelector('#mapaFundo');
      if(f){ f.setAttribute('href', FUNDO); f.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', FUNDO); }
      /* sem ids repetidos na página: o número do lote passa para data-un */
      svg.querySelectorAll('polygon[id]').forEach(function(p){ var n = numUn(p.id); if(n != null) p.dataset.un = n; });
      svg.querySelectorAll('[id]').forEach(function(el){ el.removeAttribute('id'); });
      caixaSvg.innerHTML = ''; caixaSvg.appendChild(svg);
      svg.querySelectorAll('polygon[data-un]').forEach(function(p){
        var n = Number(p.dataset.un);
        p.addEventListener('mouseenter', function(){ pintar(n); marcarLista(n); });
        p.addEventListener('mouseleave', function(){ pintar(null); marcarLista(null); });
        p.addEventListener('click', function(e){
          e.stopPropagation();
          var o = opcoes().filter(function(x){ return numUn(x.value) === n; })[0];
          if(o) escolher(o.value);
        });
      });
      pintar(null);
    }
    function posicionar(){
      if(!painel) return;
      var r = sel.getBoundingClientRect(), larg = painel.offsetWidth, x = r.left + window.scrollX;
      var maxX = window.scrollX + document.documentElement.clientWidth - larg - 8;
      painel.style.left = Math.max(window.scrollX + 8, Math.min(x, maxX)) + 'px';
      painel.style.top = (r.bottom + window.scrollY + 4) + 'px';
    }
    function abrir(){
      if(aberto) return; aberto = true;
      painel = document.createElement('div'); painel.className = 'sm-painel';
      lista = document.createElement('div'); lista.className = 'sm-lista';
      var lado = document.createElement('div'); lado.className = 'sm-mapa';
      caixaSvg = document.createElement('div'); caixaSvg.className = 'sm-svg';
      rot = document.createElement('div'); rot.className = 'sm-rot';
      var leg = document.createElement('div'); leg.className = 'sm-leg';
      leg.innerHTML = '<span><i style="background:' + rgba(COR_LISTA, .7) + '"></i>Na lista</span>' +
                      '<span><i style="background:' + rgba(COR_SEL, .85) + '"></i>Escolhida</span>' +
                      '<span><i style="background:' + rgba(COR_FORA, .45) + '"></i>Fora da lista</span>';
      lado.appendChild(rot); lado.appendChild(caixaSvg); lado.appendChild(leg);
      painel.appendChild(lista); painel.appendChild(lado);
      painel.addEventListener('mousedown', function(e){ e.stopPropagation(); });
      document.body.appendChild(painel);
      montarLista(); posicionar();
      pegarSvg(ligarSvg);
    }
    function fechar(){
      if(!aberto) return; aberto = false;
      if(painel) painel.remove(); painel = lista = caixaSvg = rot = null;
    }
    sel.addEventListener('mousedown', function(e){
      if(celular() || sel.disabled || e.button !== 0) return;   // celular: lista nativa
      e.preventDefault(); e.stopPropagation(); sel.focus();
      if(aberto) fechar(); else abrir();
    });
    sel.addEventListener('keydown', function(e){ if(e.key === 'Escape') fechar(); });
    document.addEventListener('mousedown', function(){ fechar(); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') fechar(); });
    window.addEventListener('resize', fechar);
    window.addEventListener('scroll', function(){ if(aberto) posicionar(); }, {passive:true});
    /* a lista é refeita pela página (dados ao vivo, troca de tipo): o painel aberto acompanha */
    new MutationObserver(function(){ if(aberto && lista){ montarLista(); pintar(null); } }).observe(sel, {childList:true});
    pegarSvg(function(){});   // já deixa o mapa em cache
  };
})();
