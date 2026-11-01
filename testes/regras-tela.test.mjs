/* 01/11/2026 (tarefa 12, testes e2e): regras puras das telas do simulador.
   Carrega regras-tela.js por node vm, sem DOM e sem rede.
   Roda com: node --test testes/*.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const codigo = fs.readFileSync(new URL("../regras-tela.js", import.meta.url), "utf8");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(codigo, ctx);
const R = ctx.RegrasTela;
const puro = (v) => JSON.parse(JSON.stringify(v));

test("CEP só preenche o campo vazio", () => {
  assert.deepEqual(puro(R.preencherCep({ rua: "RUA DIGITADA" }, { rua: "RUA DO CEP", bairro: "X" })),
    { rua: "RUA DIGITADA", bairro: "X" });
  assert.deepEqual(puro(R.preencherCep({ rua: "  ", bairro: "B" }, { rua: "RUA DO CEP", bairro: "X", uf: "" })),
    { rua: "RUA DO CEP", bairro: "B" });
});

test("nome não pode ter número", () => {
  assert.equal(R.nomeSemNumero("TESTE 01"), false);
  assert.equal(R.nomeSemNumero("COMPRADOR TESTE"), true);
  assert.equal(R.nomeSemNumero(""), true);
});

test("e-mails repetidos (sem diferenciar maiúscula e espaço)", () => {
  assert.deepEqual(puro(R.emailsRepetidos(["a@x", "b@x", "a@x"])), ["a@x"]);
  assert.deepEqual(puro(R.emailsRepetidos(["a@x", " A@X ", "", ""])), ["a@x"]);
  assert.deepEqual(puro(R.emailsRepetidos(["a@x", "b@x"])), []);
});

test("fiadores obrigatórios fora do 24x", () => {
  assert.equal(R.fiadoresObrigatorios(36), true);
  assert.equal(R.fiadoresObrigatorios(48), true);
  assert.equal(R.fiadoresObrigatorios("36"), true);
  assert.equal(R.fiadoresObrigatorios(24), false);
});

test("unidade do link: vendida não troca de casa", () => {
  const livres = [{ valor: "1", rotulo: "1" }, { valor: "3", rotulo: "3" }];
  assert.deepEqual(puro(R.unidadeDoLink(livres, "2")),
    { valor: "", aviso: "A unidade 2 está vendida — escolha outra" });
  assert.deepEqual(puro(R.unidadeDoLink(livres, "3")), { valor: "3", aviso: "" });
  assert.deepEqual(puro(R.unidadeDoLink(livres, "")), { valor: "", aviso: "" });
});

test("certidão de estado civil só para quem não é solteiro", () => {
  assert.equal(R.certidaoExigida("SOLTEIRO"), false);
  assert.equal(R.certidaoExigida("solteira"), false);
  assert.equal(R.certidaoExigida(""), false);
  assert.equal(R.certidaoExigida("CASADO"), true);
  assert.equal(R.certidaoExigida("UNIÃO ESTÁVEL"), true);
  assert.equal(R.certidaoExigida("DIVORCIADO"), true);
});

test("unidade do link: em breve vira 'indisponível'", () => {
  assert.deepEqual(puro(R.unidadeDoLink([{ unidade: 1 }], "9", "indisponível")),
    { valor: "", aviso: "A unidade 9 está indisponível — escolha outra" });
  assert.deepEqual(puro(R.unidadeDoLink([{ unidade: 9 }], "9")), { valor: "9", aviso: "" });
});

/* ---- ligação nas páginas (leitura do HTML; nada roda no navegador) ---- */
const html = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("proposta.html usa as regras e valida sozinha (novalidate)", () => {
  const h = html("proposta.html");
  assert.match(h, /<script src="regras-tela\.js\?v=\w+"><\/script>/);
  assert.match(h, /<form id="formProposta"[^>]*\bnovalidate\b/);
  assert.match(h, /RegrasTela\.fiadoresObrigatorios\(/);
  assert.match(h, /if\(!fiadorInformado\(fn\) && !fiadorExigido\(\)\) continue;/);
  assert.match(h, /RegrasTela\.nomeSemNumero\(/);
  assert.match(h, /RegrasTela\.emailsRepetidos\(/);
  assert.match(h, /RegrasTela\.unidadeDoLink\(/);
  assert.match(h, /<option value="">— escolha a unidade —<\/option>/);
  assert.match(h, /RegrasTela\.preencherCep\(/);
  assert.match(h, /r\.mensagem/);           // FIADORES: mostra a mensagem do servidor
});

test("completar-venda.html envia em partes e respeita data-exigido", () => {
  const h = html("completar-venda.html");
  assert.match(h, /<script src="regras-tela\.js\?v=\w+"><\/script>/);
  assert.doesNotMatch(h, /nenhum documento é opcional/);
  assert.doesNotMatch(h, /Ainda falta preencher para enviar/);
  assert.match(h, /dataset\.exigido/);
  assert.match(h, /RegrasTela\.certidaoExigida\(/);
  assert.match(h, /j\.faltam/);
  assert.match(h, /j\.mensagem/);
});

test("completar.html: CEP só preenche o vazio", () => {
  const h = html("completar.html");
  assert.match(h, /<script src="regras-tela\.js\?v=\w+"><\/script>/);
  assert.equal((h.match(/RegrasTela\.preencherCep\(/g) || []).length >= 2, true);
});

test("simulador.html valida sozinha e não convida a reenviar no teto", () => {
  const h = html("simulador.html");
  assert.match(h, /<form id="formSimulacao"[^>]*\bnovalidate\b/);
  assert.doesNotMatch(h, /aoEsgotar:function\(\)\{ if\(botao\)botao\.disabled=false;/);
  assert.match(h, /não precisa enviar de novo/i);
});

test("scripts embutidos das páginas mexidas compilam", () => {
  for (const p of ["proposta.html", "completar-venda.html", "completar.html", "simulador.html", "enviado.html"]) {
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(html(p)))) assert.doesNotThrow(() => new Function(m[1]), p);
  }
});

test("completar-venda.html: CONTRATO_JA_GERADO mostra a mensagem e os recusados", () => {
  const h = html("completar-venda.html");
  assert.match(h, /j\.recusados/);
  assert.doesNotMatch(h, /throw new Error\(\(j&&j\.erro\)/);
  assert.match(h, /x&&\(x\.mensagem\|\|x\.erro\)/);   // anexarVenda: mensagem primeiro
});

/* ---- rodada de conserto 1 (revisão da tarefa 12) ---- */
test("CEP corrigido troca o que o CEP anterior pôs, nunca o digitado", () => {
  // vazio -> preenchido
  assert.deepEqual(puro(R.preencherCep({ rua: "" }, { rua: "RUA NOVA" }, {})), { rua: "RUA NOVA" });
  // preenchido pelo CEP anterior e não mexido -> trocado
  assert.deepEqual(puro(R.preencherCep({ rua: "RUA ERRADA", bairro: "SETOR ERRADO" },
    { rua: "RUA CERTA", bairro: "SETOR CERTO" }, { rua: "RUA ERRADA", bairro: "SETOR ERRADO" })),
    { rua: "RUA CERTA", bairro: "SETOR CERTO" });
  // digitado pela pessoa (diferente do que o CEP pôs) -> mantido
  assert.deepEqual(puro(R.preencherCep({ rua: "RUA DIGITADA", bairro: "SETOR ERRADO" },
    { rua: "RUA CERTA", bairro: "SETOR CERTO" }, { rua: "RUA ERRADA", bairro: "SETOR ERRADO" })),
    { rua: "RUA DIGITADA", bairro: "SETOR CERTO" });
  // o CEP novo não traz o campo: o que o CEP errado pôs é apagado
  assert.deepEqual(puro(R.preencherCep({ rua: "RUA ERRADA" }, { rua: "" }, { rua: "RUA ERRADA" })), { rua: "" });
});

test("depois do envio: só trava quando servidor E tela não cobram nada", () => {
  assert.deepEqual(puro(R.depoisDoEnvio([], [], [])), { travar: true, falta: [] });
  assert.deepEqual(puro(R.depoisDoEnvio([], ["Comprovante de estado civil"], [])),
    { travar: false, falta: ["Comprovante de estado civil"] });
  assert.deepEqual(puro(R.depoisDoEnvio(["Dia de pagamento"], [], [])), { travar: false, falta: ["Dia de pagamento"] });
  assert.deepEqual(puro(R.depoisDoEnvio(["Dia de pagamento", { rotulo: "RG" }], ["dia de pagamento"], [])),
    { travar: false, falta: ["Dia de pagamento", "RG"] });
  assert.equal(R.depoisDoEnvio([], [], ["arquivo: falhou"]).travar, false);
});

test("completar-venda.html usa depoisDoEnvio; páginas marcam o que o CEP pôs", () => {
  assert.match(html("completar-venda.html"), /RegrasTela\.depoisDoEnvio\(/);
  assert.match(html("proposta.html"), /dataset\.cepAuto/);
  assert.equal((html("completar.html").match(/dataset\.cepAuto/g) || []).length >= 2, true);
});

test("depois do envio: o rótulo da tela com grupo não repete o do servidor", () => {
  assert.deepEqual(puro(R.depoisDoEnvio(["RG do proponente"], ["Proponente: RG do proponente", "Comprovante de endereço"], [])).falta,
    ["RG do proponente", "Comprovante de endereço"]);
});

/* ---- rodada de conserto 2: a pessoa faz parte da chave ---- */
test("depois do envio: itens de pessoas diferentes nunca se juntam", () => {
  assert.deepEqual(puro(R.depoisDoEnvio([], ["Fiador 1: Nome", "Fiador 2: Nome", "Comprador 1: CPF", "Comprador 2: CPF"], [])).falta,
    ["Fiador 1: Nome", "Fiador 2: Nome", "Comprador 1: CPF", "Comprador 2: CPF"]);
  assert.deepEqual(puro(R.depoisDoEnvio(["Nome do fiador 1"], ["Fiador 1: Nome do fiador 1", "Fiador 2: Nome do fiador 2"], [])).falta,
    ["Nome do fiador 1", "Fiador 2: Nome do fiador 2"]);
  // tela + servidor, mesmo item: uma vez só
  assert.deepEqual(puro(R.depoisDoEnvio(["RG do proponente"], ["Proponente: RG do proponente"], [])).falta, ["RG do proponente"]);
  // rótulo que não dá para ligar à pessoa: fica (duplicado é melhor que sumir)
  assert.deepEqual(puro(R.depoisDoEnvio(["Data de nascimento"], ["Proponente: Data de nascimento"], [])).falta,
    ["Data de nascimento", "Proponente: Data de nascimento"]);
});
