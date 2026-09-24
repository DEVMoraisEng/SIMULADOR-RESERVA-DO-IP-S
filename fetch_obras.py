#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch_obras.py — PORTAL-MORAIS
Publica dist/obras.json, lido pela obras.html (aba de OBRAS).

Lê duas bases:
  (EMP) Projeto 2.0        -> as obras
  ATIVIDADES DE PROJETOS   -> as atividades de cada obra

E publica também as OPÇÕES das colunas de seleção (para o formulário de
"Solicitar nova obra" só oferecer valores que existem) e a lista de PESSOAS
(id + nome) que aparecem nas colunas de pessoa — é o id que a API do Notion
aceita para gravar Responsável Pela Obra e ENGENHEIRO RT.

FICA DE FORA, de propósito (o dist/ é público para quem tem a URL):
CPF/CNPJ, DATA DE NASCIMENTO e CONTA da obra. Nenhuma dessas é usada na tela.

Variáveis de ambiente: NOTION_TOKEN (o mesmo dos outros fetch_*.py) e
ERP_CSV_OBRAS (a aba Obras do Mais Controle, a mesma da Análise de Dados) —
com ela cada obra sai marcada com "em_mc": se já existe no Mais Controle.
"""

import csv
import io
import os
import re
from datetime import datetime, timezone

import requests

from fetch_vendas import ler_banco, api, gravar, norm, SAIDA, TOKEN

ID_OBRAS = "306c5ab532d3812fa14fe9a281510128"   # (EMP) Projeto 2.0
ID_ATIV = "306c5ab532d381fb864edee432bb128d"    # ATIVIDADES DE PROJETOS
ID_CADASTRO = "3e2c5ab532d38055a241db35f74e7bbc"  # PROPRIETÁRIOS (cadastro) — só o NOME sai daqui
ID_LIGACOES = "313c5ab532d3801e974ced0bb656c9d5"  # LIGAÇÕES DE ÁGUA E ENERGIA (só a contagem por obra)
ID_VENDAS = "33cc5ab532d38047ae3aee8b87ac1f4d"    # BANCO DE DADOS VENDAS (só a contagem por obra)


def conta_alerta(p):
    """Situação da coluna CONTA sem revelar o nome da conta."""
    if not p or p.get("type") != "select":
        return None                      # ainda é a fórmula antiga: sem alerta
    v = norm(((p.get("select") or {}).get("name")) or "")
    if not v:
        return "VAZIA"
    if v == norm("CRIAR CONTA"):
        return "CRIAR CONTA"
    if v == norm("DÚVIDA"):
        return "DÚVIDA"
    return None


def contar_por_relacao(db_id, rotulo, coluna):
    """Quantas linhas de uma base apontam para cada obra (relação `coluna`).
    Serve para a tela travar os botões de ligação com "JÁ CRIADO" (item 9).
    Falhar aqui não derruba o build: a tela só deixa de mostrar o aviso."""
    cont = {}
    try:
        for pg in ler_banco(db_id, rotulo):
            ip = por_nome(pg.get("properties") or {})
            for oid in ids(ip.get(norm(coluna))):
                k = oid.replace("-", "")
                cont[k] = cont.get(k, 0) + 1
    except SystemExit as e:
        print(f"  contagem de {rotulo} não lida: {e}", flush=True)
    return cont

ERP_CSV_OBRAS = os.environ.get("ERP_CSV_OBRAS", "").strip() or \
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQAVoeaF7ztdWagGt87vVr5dsNxFvpQ3uS6g5q3Ip6ppYchJxCaepob5SjWHhKIMjlNsLC1BXtzCKRd/pub?gid=931586083&single=true&output=csv"


def padronizar_endereco(s):
    """Mesma regra do Apps Script / fetch_analise_dados.py."""
    t = str(s or "").replace("\u2013", "-").replace("\u2014", "-").upper()
    t = re.sub(r"\s+", " ", t).strip()
    if not t:
        return t
    t = re.sub(r"\bQUADRA\b", "QD", t)
    t = re.sub(r"\bLOTE\b", "LT", t)
    t = re.sub(r"\b(QD|LT|CS)\.(?=\s*\d)", r"\1", t)
    t = re.sub(r"\bLT\s*(\d+[A-Z]?)\s*-+\s*(\d+[A-Z]?)\b", r"LT \1~\2", t)
    t = re.sub(r"\bLT (\d+) (\d+)\b", r"LT \1~\2", t)
    t = re.sub(r"\s*-+\s*", " ", t)
    t = re.sub(r"\b(QD|LT|CS)(?=\d)", r"\1 ", t)
    t = re.sub(r"^([A-Z]{1,4})(?=\d)", r"\1 ", t)
    t = re.sub(r"\bQD 0+ (\d+)", r"QD \1", t)
    t = re.sub(r"\bB (\d+)\b", r"B\1", t)

    def pad(m):
        a, sa, b, sb = m.group(2), m.group(3) or "", m.group(4), m.group(5) or ""
        r = m.group(1) + " " + (a if len(a) >= 2 else "0" + a) + sa
        if b:
            r += "-" + (b if len(b) >= 2 else "0" + b) + sb
        return r
    t = re.sub(r"\b(QD|LT) 0*(\d+)([A-Z]?)(?:~0*(\d+)([A-Z]?))?(?![\dA-Z])", pad, t)
    return re.sub(r"\s+", " ", t.replace("~", "-")).strip()


def obras_no_mc():
    """Conjunto de nomes (padronizados) das obras que existem no Mais Controle.
    None = não deu para ler (aí a tela não acusa nada, em vez de acusar tudo)."""
    try:
        r = requests.get(ERP_CSV_OBRAS, timeout=60)
        if r.status_code != 200:
            print(f"  ERP obras: HTTP {r.status_code}", flush=True)
            return None
        rows = list(csv.DictReader(io.StringIO(r.content.decode("utf-8-sig"))))
        nomes = {padronizar_endereco(x.get("nome")) for x in rows if x.get("nome")}
        print(f"  ERP obras: {len(nomes)} obras no Mais Controle", flush=True)
        return nomes or None
    except Exception as e:
        print(f"  ERP obras: falhou — {e}", flush=True)
        return None


# colunas da obra que NUNCA vão para o arquivo público
PROIBIDAS = {norm(x) for x in ["CPF/CNPJ", "DATA DE NASCIMENTO", "CONTA", "Nº DA CONTA"]}


def txt(p):
    """Texto de qualquer tipo de coluna (listas viram 'a, b')."""
    if not p:
        return None
    t = p.get("type")
    v = p.get(t)
    if t == "title" or t == "rich_text":
        return "".join(x.get("plain_text", "") for x in (v or [])) or None
    if t in ("select", "status"):
        return (v or {}).get("name")
    if t == "multi_select":
        return ", ".join(x.get("name", "") for x in (v or [])) or None
    if t == "people":
        return ", ".join(x.get("name") or "" for x in (v or [])) or None
    if t == "date":
        return ((v or {}).get("start") or "")[:10] or None
    if t == "number":
        return v
    if t == "checkbox":
        return "Sim" if v else None
    if t == "formula":
        if not v:
            return None
        fv = v.get(v.get("type"))
        if v.get("type") == "date":
            return ((fv or {}).get("start") or "")[:10] or None
        return fv
    if t == "rollup":
        if (v or {}).get("type") == "array":
            partes = [txt(x) for x in v.get("array") or []]
            return ", ".join(str(x) for x in partes if x not in (None, "")) or None
        return (v or {}).get((v or {}).get("type"))
    if t in ("url", "email", "phone_number"):
        return v
    return None


def ids(p):
    t = (p or {}).get("type")
    if t in ("people", "relation"):
        return [x.get("id") for x in (p.get(t) or []) if x.get("id")]
    return []


def por_nome(props):
    return {norm(k): v for k, v in (props or {}).items()}


def pega(ip, *nomes):
    for n in nomes:
        v = ip.get(norm(n))
        if v is not None:
            return v
    return None


# banco CONTAS BANCÁRIAS (mantido pelo robo_mc_contas.py) — id não é segredo
CONTAS_DB_ID = os.environ.get("CONTAS_DB_ID", "").strip() or "3e4c5ab532d380afbd3bf9f7af31d2a7"


def main():
    if not TOKEN:
        raise SystemExit("Falta o secret NOTION_TOKEN.")
    os.makedirs(SAIDA, exist_ok=True)

    esquema = api("GET", f"/databases/{ID_OBRAS}").get("properties") or {}
    opcoes = {}
    for nome, d in esquema.items():
        t = d.get("type")
        if t in ("select", "status", "multi_select"):
            opcoes[nome] = [o.get("name") for o in (d.get(t) or {}).get("options") or []]
    esq_ativ = api("GET", f"/databases/{ID_ATIV}").get("properties") or {}
    opcoes_ativ = {}
    for nome, d in esq_ativ.items():
        t = d.get("type")
        if t in ("select", "status", "multi_select"):
            opcoes_ativ[nome] = [o.get("name") for o in (d.get(t) or {}).get("options") or []]
    no_mc = obras_no_mc()
    fmt_cota = None
    for nome, d in esquema.items():
        if norm(nome) == norm("COTA DA EMPRESA (%)") and d.get("type") == "number":
            fmt_cota = (d.get("number") or {}).get("format")

    pessoas = {}
    lig_por_obra = contar_por_relacao(ID_LIGACOES, "LIGAÇÕES", "Vínculo Obra")
    ven_por_obra = contar_por_relacao(ID_VENDAS, "VENDAS", "OBRA-AUTO")

    def guarda_pessoas(p):
        for u in ((p or {}).get("people") or []):
            if u.get("id") and u.get("name"):
                pessoas[u["id"]] = u["name"]

    obras = []
    for pg in ler_banco(ID_OBRAS, "OBRAS"):
        props = pg.get("properties") or {}
        for v in props.values():
            if (v or {}).get("type") == "people":
                guarda_pessoas(v)
        ip = por_nome(props)
        cota = txt(pega(ip, "COTA DA EMPRESA (%)"))
        if isinstance(cota, (int, float)) and fmt_cota == "percent":
            cota = round(cota * 100, 4)          # a tela trabalha em 0-100
        resp = pega(ip, "Responsável Pela Obra")
        rt = pega(ip, "ENGENHEIRO RT")
        obras.append({
            "id": pg.get("id"),
            "url": pg.get("url"),
            "criada": (pg.get("created_time") or "")[:10],
            "titulo": txt(pega(ip, "Projeto")),
            "setor": txt(pega(ip, "SETOR")),
            "cidade": txt(pega(ip, "Cidade")),
            "proprietario": txt(pega(ip, "Proprietário")),
            "proprietario_real": txt(pega(ip, "Proprietário Real")),
            "resp": txt(resp), "resp_ids": ids(resp),
            "rt": txt(rt), "rt_ids": ids(rt),
            "status": txt(pega(ip, "Status")),
            "liberar": txt(pega(ip, "Liberar Obra Para Processo Interno")),
            "projeto_finalizado": txt(pega(ip, "Projeto Finalizado")),
            "orcamento_finalizado": txt(pega(ip, "Orçamento Finalizado")),
            "projeto_aprovado": txt(pega(ip, "Projeto Aprovado")),
            "data_inicial": txt(pega(ip, "Data Inicial")),
            "data_prevista": txt(pega(ip, "Data Prevista P/ Término")),
            "data_conclusao": txt(pega(ip, "Data de Conclusão do Processo")),
            "controle_prazo": txt(pega(ip, "CONTROLE DE PRAZO")),
            "n_casas": txt(pega(ip, "Nº DE CASAS")),
            "cota": cota,
            "data_lote": txt(pega(ip, "DATA DE AQUISIÇÃO DO LOTE")),
            "implantacao": txt(pega(ip, "IMPLANTAÇÃO")),
            "area_lote": txt(pega(ip, "ÁREA DO LOTE")),
            "area_averbada": txt(pega(ip, "ÁREA CONSTRUÍDA AVERBADA")),
            "area_habite": txt(pega(ip, "ÁREA PÓS HABITE-SE")),
            "estudo_layout": txt(pega(ip, "PRECISA DE ESTUDO DE LAYOUT")),
            "mais_controle": txt(pega(ip, "MAIS CONTROLE")),
            "em_mc": (None if no_mc is None else padronizar_endereco(txt(pega(ip, "Projeto"))) in no_mc),
            # 23/09/26 — CONTA virou seleção com o nome real da conta. O NOME não
            # sai aqui (arquivo público); só a situação, para os Alertas:
            # "CRIAR CONTA", "DÚVIDA", "VAZIA" ou null (conta escolhida / PF).
            "conta_alerta": conta_alerta(pega(ip, "CONTA")),
            "lig_criadas": lig_por_obra.get(str(pg.get("id")).replace("-", ""), 0),
            "vendas_criadas": ven_por_obra.get(str(pg.get("id")).replace("-", ""), 0),
        })

    atividades = []
    for pg in ler_banco(ID_ATIV, "ATIVIDADES DE PROJETOS"):
        props = pg.get("properties") or {}
        ip = por_nome(props)
        r = pega(ip, "Responsável")
        guarda_pessoas(r)
        obra = ids(pega(ip, "(EMP) Projeto 2.0"))
        atividades.append({
            "id": pg.get("id"),
            "url": pg.get("url"),
            "titulo": txt(pega(ip, "Atividade")),
            "tipo": txt(pega(ip, "Tipo")),
            "status": txt(pega(ip, "Status")),
            "resp": [u.get("name") for u in ((r or {}).get("people") or []) if u.get("name")],
            "data_criacao": txt(pega(ip, "Data de criação")),
            "data_inicio": txt(pega(ip, "Data De Início")),
            "data_final": txt(pega(ip, "Data Final Prevista")),
            "data_conclusao": txt(pega(ip, "Data De Conclusão da Atividade")),
            "controle_prazo": txt(pega(ip, "CONTROLE DE PRAZO")),
            "obra_id": obra[0] if obra else None,
        })

    # nada proibido escapa (checagem final, caso alguém renomeie coluna)
    for o in obras:
        for k in list(o.keys()):
            if norm(k) in PROIBIDAS:
                o.pop(k)

    # nomes do cadastro de proprietários: a MESMA lista serve para Proprietário e
    # Proprietário Real no formulário. CPF/CNPJ e conta não saem daqui.
    proprietarios = []
    try:
        for pg in ler_banco(ID_CADASTRO, "PROPRIETÁRIOS"):
            for v in (pg.get("properties") or {}).values():
                if (v or {}).get("type") == "title":
                    nome = txt(v)
                    if nome:
                        proprietarios.append(nome.strip())
    except SystemExit as e:
        print(f"  cadastro de proprietários não lido: {e}", flush=True)
    proprietarios = sorted(set(proprietarios), key=norm)

    # 25/09/26 — lista de CONTAS BANCÁRIAS para a escolha na obra, pronta no
    # arquivo (a tela abre já com ela, sem esperar o Apps Script). Vai SÓ o
    # nome da opção — o mesmo texto que aparece na coluna CONTA da obra —
    # das contas marcadas "Aparece" e ativas no ERP. Nada de banco, agência,
    # número ou id do ERP.
    # contas_todas alimenta a aba "Contas bancárias" (Conta, Aparece,
    # Situação) — também só nome, marcação e situação.
    contas, contas_todas = [], []
    try:
        for pg in ler_banco(CONTAS_DB_ID, "CONTAS BANCÁRIAS"):
            ip = pg.get("properties") or {}
            ap = pega(ip, "Aparece")
            aparece = bool(ap and ap.get("type") == "checkbox" and ap.get("checkbox"))
            situacao = (txt(pega(ip, "Situação no ERP")) or "").strip()
            tit = next((v for v in ip.values() if v.get("type") == "title"), None)
            titulo = (txt(tit) or "").strip()
            if not titulo:
                continue
            contas_todas.append({"id": pg["id"], "conta": titulo, "aparece": aparece, "situacao": situacao})
            if not aparece or "SUMIU" in norm(situacao):
                continue
            nome = (txt(pega(ip, "Nome na obra")) or "").strip() or " ".join(titulo.replace(",", " ").split())[:100]
            contas.append({"opcao": nome})
    except SystemExit as e:
        print(f"  contas bancárias não lidas: {e}", flush=True)
    contas.sort(key=lambda c: norm(c["opcao"]))
    contas_todas.sort(key=lambda c: norm(c["conta"]))

    gravar("obras.json", {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "contas": contas,
        "contas_todas": contas_todas,
        "obras": obras,
        "atividades": atividades,
        "opcoes": {k: v for k, v in opcoes.items() if norm(k) not in PROIBIDAS},
        "opcoes_atividades": opcoes_ativ,
        "proprietarios": proprietarios,
        "pessoas": sorted([{"id": k, "nome": v} for k, v in pessoas.items()], key=lambda x: norm(x["nome"])),
    })
    print(f"obras.json: {len(obras)} obras, {len(atividades)} atividades, {len(pessoas)} pessoas, {len(contas)} contas", flush=True)


if __name__ == "__main__":
    main()
