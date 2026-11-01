/* 01/11/2026 (cota do Apps Script): telas só consultam com a aba aberta e com menos frequência.
   Carrega polling.js (pollSoVisivel) por node vm com document/timers/fetch FALSOS.
   Nenhuma chamada de rede real. Roda com: node --test testes/*.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const raiz = (p) => new URL("../" + p, import.meta.url);
const ler = (p) => fs.readFileSync(raiz(p), "utf8");

function mundo() {
  const w = { agora: 0, hidden: false, timers: [], ouvintes: [], chamadas: 0, criados: [] };
  const ctx = {
    Date: { now: () => w.agora },
    document: {
      get hidden() { return w.hidden; },
      addEventListener: (t, f) => { if (t === "visibilitychange") w.ouvintes.push(f); },
      removeEventListener: (t, f) => { w.ouvintes = w.ouvintes.filter((x) => x !== f); },
    },
    setInterval: (f, ms) => { const t = { f, ms, vivo: true }; w.timers.push(t); w.criados.push(ms); return t; },
    clearInterval: (t) => { t.vivo = false; },
    fetch: () => { w.chamadas++; return Promise.resolve({}); },   // falso: nunca sai da máquina
  };
  vm.createContext(ctx);
  vm.runInContext(ler("polling.js"), ctx);
  w.ctx = ctx;
  w.vivos = () => w.timers.filter((t) => t.vivo);
  w.passa = (ms) => { // avança o relógio e dispara os timers vivos a cada intervalo
    const fim = w.agora + ms;
    while (true) {
      const vivos = w.vivos();
      if (!vivos.length) { w.agora = fim; return; }
      const prox = Math.min(...vivos.map((t) => (t.prox ??= w.agora + t.ms)));
      if (prox > fim) { w.agora = fim; return; }
      w.agora = prox;
      for (const t of vivos) if (t.prox === prox && t.vivo) { t.prox += t.ms; t.f(); }
    }
  };
  w.alterna = (hidden) => { w.hidden = hidden; [...w.ouvintes].forEach((f) => f()); };
  return w;
}

test("aba escondida: zero consultas ao servidor; visível: consulta no intervalo", () => {
  const w = mundo();
  w.ctx.pollSoVisivel(() => w.ctx.fetch("x"), 120000);
  w.hidden = true;
  w.passa(120000 * 10);
  assert.equal(w.chamadas, 0);
  w.hidden = false;
  w.passa(120000 * 3);
  assert.equal(w.chamadas, 3);
});

test("ao voltar a ficar visível: UMA consulta se passou o intervalo, nenhuma se foi recente", () => {
  const w = mundo();
  w.ctx.pollSoVisivel(() => w.ctx.fetch("x"), 120000);
  w.alterna(true); w.passa(300000); assert.equal(w.chamadas, 0);
  w.alterna(false); assert.equal(w.chamadas, 1);
  w.alterna(true); w.alterna(false); assert.equal(w.chamadas, 1, "recente: não repete");
});

test("várias idas e vindas da aba não criam setInterval extra nem ouvinte extra", () => {
  const w = mundo();
  w.ctx.pollSoVisivel(() => w.ctx.fetch("x"), 120000);
  for (let i = 0; i < 6; i++) { w.alterna(true); w.passa(1000); w.alterna(false); w.passa(1000); }
  assert.equal(w.criados.length, 1);
  assert.equal(w.vivos().length, 1);
  assert.equal(w.ouvintes.length, 1);
});

test("teto de 15 min conta tempo real (inclusive com a aba escondida) e para o ciclo", () => {
  const w = mundo();
  let esgotou = 0;
  const h = w.ctx.pollSoVisivel(() => w.ctx.fetch("x"), 15000, { tetoMs: 900000, aoEsgotar: () => esgotou++ });
  w.passa(899000);
  assert.equal(esgotou, 0);
  assert.equal(w.chamadas, 59);          // 15 s, 30 s ... 885 s
  w.passa(60000);
  assert.equal(esgotou, 1);
  assert.equal(w.vivos().length, 0);
  assert.equal(w.ouvintes.length, 0);
  const antes = w.chamadas;
  w.passa(600000); w.alterna(true); w.alterna(false);
  assert.equal(w.chamadas, antes, "depois do teto não consulta mais");
  h.parar(); // idempotente
  // escondida o tempo todo: ao voltar depois do teto, não consulta e avisa
  const v = mundo(); let av = 0;
  v.ctx.pollSoVisivel(() => v.ctx.fetch("x"), 15000, { tetoMs: 900000, aoEsgotar: () => av++ });
  v.hidden = true; v.agora += 1000000; v.alterna(false);
  assert.equal(v.chamadas, 0); assert.equal(av, 1);
});

test("fn pode se parar sozinha (concluído)", () => {
  const w = mundo();
  w.ctx.pollSoVisivel((c) => { w.ctx.fetch("x"); c.parar(); }, 15000);
  w.passa(150000);
  assert.equal(w.chamadas, 1);
  assert.equal(w.vivos().length, 0);
});

test("as quatro telas usam o helper com os valores novos (e nenhum setInterval antigo de consulta)", () => {
  const idx = ler("index.html"), mapa = ler("mapa.html"), sim = ler("simulador.html"), env = ler("enviado.html");
  for (const t of [idx, mapa, sim, env]) assert.match(t, /<script src="polling\.js\?v=[^"]+"><\/script>/);
  assert.match(idx, /pollSoVisivel\(function\(\)\{ if\(!ocupado\(\)\) carregar\(false\); \}, 120000\)/);
  assert.match(mapa, /pollSoVisivel\(function\(\)\{ if\(!ocupado\(\)\) carregar\(false\); \}, 120000\)/);
  assert.match(sim, /\},15000,\{tetoMs:900000,/);
  assert.match(sim, /pollSoVisivel\(verificarServico,120000\)/);
  assert.match(env, /\}, 15000, \{tetoMs: 900000,/);
  assert.doesNotMatch(idx + mapa, /setInterval\(function\(\)\{ if\(!ocupado/);
  assert.doesNotMatch(sim, /setInterval\(verificarServico/);
  assert.doesNotMatch(env, /setInterval\(function\(\)\{\s*tentativas/);
  assert.doesNotMatch(sim, /\},5000\);\s*\}\s*\/\* ===== 31/);
  assert.match(sim, /chega por e-mail/); assert.match(env, /chega por e-mail/);
});
