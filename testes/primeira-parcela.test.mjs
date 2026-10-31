/* r97f (31/10/2026, dono): 1ª parcela pré-chaves em novembro ou dezembro; pré-chaves e balões até 30/11/2028.
   Roda com: node --test testes/  (só a conta do fluxo-calc.js; nenhum dado real). */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL("../fluxo-calc.js", import.meta.url), "utf8"), ctx);
const base = { preco: 230000, financiado: 160000, fgts: 0, subsidio: 0, informado: 0, nSinal: 4, prazoEntrada: 24 };
const parc = (g, re) => g.fluxo.find((x) => re.test(x[2]));
const soma = (g) => Math.round(g.fluxo.reduce((s, x) => s + x[1] * ctx.fpcQtd(x[0]), 0) * 100) / 100;

test("proposta de novembro: escolhe novembro (24) ou dezembro (23); a parcela de dezembro é maior e o total igual", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.fpcOpcoesPrimeira(2026, 11))), [{ ano: 2026, mes: 11 }, { ano: 2026, mes: 12 }]);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.fpcOpcoesPrimeira(2026, 10))), [{ ano: 2026, mes: 11 }, { ano: 2026, mes: 12 }], "antes de novembro também");
  const nov = ctx.fpcGerar({ ...base, ano: 2026, mes: 11, primeira: "2026-11" });
  const dez = ctx.fpcGerar({ ...base, ano: 2026, mes: 11, primeira: { ano: 2026, mes: 12 } });
  assert.equal(nov.n1, 12); assert.equal(nov.nPre, 24);
  assert.equal(dez.n1, 11); assert.equal(dez.nPre, 23);
  assert.equal(parc(dez, /MESES 1 A 11/i)[0], "11 X");
  assert.ok(parc(dez, /MESES 1 A/i)[1] > parc(nov, /MESES 1 A/i)[1], "cada parcela sobe");
  assert.equal(soma(nov), soma(dez));
  assert.equal(dez.erroPrazo, "");
});

test("sem escolha vale o mês da proposta (como antes); escolha fora das opções cai na 1ª", () => {
  assert.equal(ctx.fpcGerar({ ...base, ano: 2026, mes: 11 }).n1, 12);
  assert.equal(ctx.fpcGerar({ ...base, ano: 2026, mes: 12 }).n1, 11);
  assert.equal(ctx.fpcGerar({ ...base, ano: 2026, mes: 12, primeira: "2026-11" }).n1, 11, "não começa antes do mês da proposta");
  assert.equal(ctx.fpcGerar({ ...base, ano: 2026, mes: 12, primeira: "2027-01" }).n1, 10);
});

test("a contagem sempre termina em outubro/2028; passar disso é recusado", () => {
  assert.equal(ctx.fpcQtdPre({ ano: 2026, mes: 11 }), 24);
  assert.equal(ctx.fpcQtdPre({ ano: 2026, mes: 12 }), 23);
  assert.equal(ctx.FPC_LIMITE, "2028-11-30");
  assert.match(ctx.fpcGerar({ ...base, ano: 2027, mes: 11 }).erroPrazo, /30\/11\/2028/);
  assert.equal(ctx.fpcGerar({ ...base, ano: 2027, mes: 10 }).erroPrazo, "");
});

test("comissão não muda: 36 com dezembro = 23 + 12 (continua 36x)", () => {
  const g = ctx.fpcGerar({ ...base, prazoEntrada: 36, ano: 2026, mes: 11, primeira: "2026-12" });
  assert.equal(g.nPos, 12);
  assert.equal(g.nPre + g.nPos, 35);
});
