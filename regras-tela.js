/* 01/11/2026 (testes e2e, tarefa 12) — regras puras das telas do simulador.
   Sem DOM e sem rede: as páginas chamam estas funções e os testes
   (testes/regras-tela.test.mjs) carregam este arquivo por node vm.
   Usado por: proposta.html, completar-venda.html, completar.html. */
var RegrasTela = (function(){
  function vazio(v){ return v == null || String(v).trim() === ''; }

  /* CEP só preenche o campo VAZIO: o que a pessoa digitou não é trocado.
     atual e novo: {campo: valor}. Devolve o resultado (sem campos vazios dos dois lados). */
  function preencherCep(atual, novo){
    atual = atual || {}; novo = novo || {};
    var out = {}, chaves = {};
    Object.keys(atual).forEach(function(k){ chaves[k] = 1; });
    Object.keys(novo).forEach(function(k){ chaves[k] = 1; });
    Object.keys(chaves).forEach(function(k){
      if(!vazio(atual[k])) out[k] = atual[k];
      else if(!vazio(novo[k])) out[k] = novo[k];
    });
    return out;
  }

  /* nome de pessoa não tem número ("TESTE 01" não serve para contrato) */
  function nomeSemNumero(v){ return !/\d/.test(String(v == null ? '' : v)); }

  /* e-mails que aparecem mais de uma vez (sem diferenciar maiúscula e espaço); vazio não conta */
  function emailsRepetidos(lista){
    var vistos = {}, rep = [];
    (lista || []).forEach(function(e){
      var k = String(e == null ? '' : e).trim().toLowerCase();
      if(!k) return;
      if(vistos[k] && rep.indexOf(k) < 0) rep.push(k);
      vistos[k] = 1;
    });
    return rep;
  }

  /* fiadores: em 24x não há pós-chaves e o fiador é dispensado; 36x/48x (ou prazo ainda
     não escolhido) exige os dois. Mesma regra do servidor (fiadorDispensadoPrazo_). */
  function fiadoresObrigatorios(prazo){
    var p = Number(prazo) || 0;
    return !p || p > 24;
  }

  /* unidade pedida no link (?unidade=): só é escolhida se estiver na lista de livres.
     lista: valores ou objetos com .unidade/.valor. estado: 'vendida' (padrão) ou 'indisponível'.
     Fora da lista: valor '' (a tela mostra "— escolha a unidade —") e o aviso. */
  function unidadeDoLink(lista, pedida, estado){
    var p = String(pedida == null ? '' : pedida).trim();
    if(!p) return {valor:'', aviso:''};
    var achou = (lista || []).some(function(u){
      var v = (u && typeof u === 'object') ? (u.unidade != null ? u.unidade : u.valor) : u;
      return String(v) === p;
    });
    if(achou) return {valor:p, aviso:''};
    return {valor:'', aviso:'A unidade ' + p + ' está ' + (estado || 'vendida') + ' — escolha outra'};
  }

  /* certidão de estado civil: só para quem não é solteiro (casado, divorciado, viúvo, união estável) */
  function certidaoExigida(estadoCivil){
    var e = String(estadoCivil == null ? '' : estadoCivil).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
    return !!e && e.indexOf('SOLTEIR') !== 0;
  }

  return {preencherCep:preencherCep, nomeSemNumero:nomeSemNumero, emailsRepetidos:emailsRepetidos,
          fiadoresObrigatorios:fiadoresObrigatorios, unidadeDoLink:unidadeDoLink, certidaoExigida:certidaoExigida};
})();
