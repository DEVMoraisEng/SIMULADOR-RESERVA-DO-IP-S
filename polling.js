/* Cota do Apps Script (01/11/2026): telas só consultam o servidor com a aba aberta.
   pollSoVisivel(fn, intervaloMs, opcoes) -> { parar() }
   - UM só setInterval por chamada; a cada ciclo, aba escondida = não consulta.
   - ao voltar a ficar visível, faz UMA consulta se a última tem mais que o intervalo
     (sem criar outro setInterval).
   - opcoes.tetoMs: para depois desse tempo REAL (conta também com a aba escondida)
     e chama opcoes.aoEsgotar(). fn recebe o objeto de controle (para chamar parar()). */
/* INICIO pollSoVisivel */
function pollSoVisivel(fn, intervaloMs, opcoes){
  opcoes = opcoes || {};
  var inicio = Date.now(), ultima = Date.now(), parado = false, timer = null;
  var ctl = { parar: parar };
  function parar(){
    if(parado) return; parado = true;
    if(timer !== null) clearInterval(timer);
    document.removeEventListener('visibilitychange', aoMudar);
  }
  function esgotou(){
    if(opcoes.tetoMs && Date.now() - inicio >= opcoes.tetoMs){
      parar();
      if(opcoes.aoEsgotar) opcoes.aoEsgotar();
      return true;
    }
    return false;
  }
  function rodar(){ ultima = Date.now(); fn(ctl); }
  function ciclo(){
    if(parado || esgotou()) return;
    if(document.hidden) return;
    rodar();
  }
  function aoMudar(){
    if(parado || document.hidden || esgotou()) return;
    if(Date.now() - ultima >= intervaloMs) rodar();
  }
  timer = setInterval(ciclo, intervaloMs);
  document.addEventListener('visibilitychange', aoMudar);
  return ctl;
}
/* FIM pollSoVisivel */
if(typeof window !== 'undefined') window.pollSoVisivel = pollSoVisivel;
