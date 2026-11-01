/* 01/11/2026 (testes e2e, tarefa 12) — regras puras das telas do simulador.
   Sem DOM e sem rede: as páginas chamam estas funções e os testes
   (testes/regras-tela.test.mjs) carregam este arquivo por node vm.
   Usado por: proposta.html, completar-venda.html, completar.html. */
var RegrasTela = (function(){
  function vazio(v){ return v == null || String(v).trim() === ''; }

  /* CEP preenche o campo VAZIO e também o campo que um CEP anterior preencheu e a pessoa
     não mexeu (corrigir o CEP corrige o endereço). O que a pessoa digitou nunca é trocado.
     atual e novo: {campo: valor}; auto (opcional): {campo: valor que o CEP anterior pôs}.
     Devolve o resultado; campo do CEP anterior que o CEP novo não traz volta vazio (''). */
  function preencherCep(atual, novo, auto){
    atual = atual || {}; novo = novo || {}; auto = auto || {};
    var out = {}, chaves = {};
    Object.keys(atual).forEach(function(k){ chaves[k] = 1; });
    Object.keys(novo).forEach(function(k){ chaves[k] = 1; });
    Object.keys(chaves).forEach(function(k){
      var doCep = !vazio(atual[k]) && !vazio(auto[k]) && String(atual[k]) === String(auto[k]);
      if(!vazio(atual[k]) && !doCep) out[k] = atual[k];
      else if(!vazio(novo[k])) out[k] = novo[k];
      else if(doCep) out[k] = '';
    });
    return out;
  }

  /* depois de um envio do link da venda: o que ainda falta (servidor + tela, sem repetir) e se
     a página pode travar ("Enviado ✓") — só quando nada falta e nenhum arquivo falhou.
     Chave de repetição = PESSOA + campo. A tela escreve "Grupo: rótulo" (ex.: "Fiador 1: Nome");
     o servidor escreve o rótulo sozinho (ex.: "Nome do fiador 1"). Os dois só viram o mesmo item
     quando o rótulo já nomeia a pessoa do grupo ("Proponente: RG do proponente" = "RG do proponente").
     Rótulo que não dá para ligar fica: mostrar repetido é melhor que esconder o que falta. */
  function palavras(x){
    return String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  }
  function chaveFalta(t){
    var i = t.indexOf(':');
    if(i < 0) return palavras(t);
    var grupo = palavras(t.slice(0, i)), campo = palavras(t.slice(i + 1));
    if(!grupo) return campo;
    return (' ' + campo + ' ').indexOf(' ' + grupo + ' ') >= 0 ? campo : grupo + '|' + campo;
  }
  function depoisDoEnvio(faltamServidor, faltamTela, falhas){
    var falta = [], vistos = {};
    (faltamServidor || []).concat(faltamTela || []).forEach(function(x){
      var t = (x && typeof x === 'object') ? (x.rotulo || x.nome || '') : x;
      t = String(t == null ? '' : t).trim();
      var k = t && chaveFalta(t);
      if(!t || vistos[k]) return;
      vistos[k] = 1; falta.push(t);
    });
    return {travar: !falta.length && !(falhas || []).length, falta: falta};
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
          fiadoresObrigatorios:fiadoresObrigatorios, unidadeDoLink:unidadeDoLink, certidaoExigida:certidaoExigida,
          depoisDoEnvio:depoisDoEnvio};
})();
