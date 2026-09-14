# -*- coding: utf-8 -*-
"""Lê a base UNIDADES RESERVA DOS IPÊS no Notion e gera unidades.json.
Leitura robusta: casa o nome da coluna sem depender de acento/caixa/espaço e
aceita número, fórmula, rollup ou texto (por isso VALOR DE VENDA / AVALIAÇÃO
funcionam mesmo se a coluna não for do tipo Número puro)."""
import os
import re
import json
import unicodedata
import requests

TOKEN = os.environ["NOTION_TOKEN"]
DB = os.environ["NOTION_DB_UNIDADES"]
H = {"Authorization": f"Bearer {TOKEN}", "Notion-Version": "2022-06-28",
     "Content-Type": "application/json"}


def _norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return " ".join(s.upper().split())


def _find(pr, nome):
    alvo = _norm(nome)
    for k, v in pr.items():
        if _norm(k) == alvo:
            return v
    return None


def _val(prop):
    if not prop:
        return None
    t = prop.get("type")
    if t in ("rich_text", "title"):
        return "".join(x.get("plain_text", "") for x in prop.get(t, []))
    if t == "number":
        return prop.get("number")
    if t == "select":
        return (prop.get("select") or {}).get("name", "")
    if t == "status":
        return (prop.get("status") or {}).get("name", "")
    if t == "checkbox":
        return prop.get("checkbox")
    # multi_select FALTAVA: a coluna voltava None, o sel() caía no valor
    # padrao "SIM" e unidade marcada como NAO no Notion saia disponivel.
    if t == "multi_select":
        return "|".join(x.get("name", "") for x in prop.get("multi_select") or [])
    if t == "formula":
        f = prop.get("formula", {})
        return f.get("number", f.get("string", f.get("boolean")))
    if t == "rollup":
        r = prop.get("rollup", {})
        if r.get("type") == "number":
            return r.get("number")
        arr = r.get("array", [])
        return _val(arr[0]) if arr else None
    if t == "files":
        fs = prop.get("files") or []
        if fs:
            f = fs[0]
            return (f.get("file") or f.get("external") or {}).get("url", "")
    if t == "email":
        return prop.get("email")
    if t == "date":
        return (prop.get("date") or {}).get("start")
    return None


def txt(pr, nome):
    v = _val(_find(pr, nome))
    return "" if v is None else v


def num(pr, nome):
    v = _val(_find(pr, nome))
    if isinstance(v, bool):
        return 0
    if isinstance(v, (int, float)):
        return v
    if isinstance(v, str) and v.strip():
        s = re.sub(r"[^\d,.\-]", "", v)
        if "," in s and "." in s:
            s = s.replace(".", "").replace(",", ".")
        elif "," in s:
            s = s.replace(",", ".")
        try:
            return float(s)
        except ValueError:
            return 0
    return 0


def sel(pr, nome, default=""):
    return _norm(txt(pr, nome) or default)


def sim_nao(pr, nome):
    """True / False / None (coluna nao existe ou esta vazia).

    Nao usar `valor or default`: um checkbox desmarcado vale False e cairia no
    default, invertendo a resposta. Por isso a ausencia da coluna e tratada
    separadamente de um NAO explicito.
    """
    prop = _find(pr, nome)
    if prop is None:
        return None
    if prop.get("type") == "checkbox":
        return bool(prop.get("checkbox"))
    v = _val(prop)
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return v != 0
    t = _norm(v or "")
    if not t:
        return None
    if t in ("NAO", "FALSE", "N", "0"):
        return False
    if t in ("SIM", "TRUE", "S", "1"):
        return True
    return None


PASTA_PLANTAS = "assets/plantas"


def baixar_plantas(unidades):
    """A URL de arquivo do Notion é assinada e EXPIRA em 1 hora — publicar
    ela no unidades.json deixaria a planta quebrada quase sempre (o Actions
    roda de 6 em 6h). Então a imagem é baixada uma vez por tipo e passa a ser
    servida pelo próprio repositório, onde não expira.

    Se o download falhar, mantém a URL do Notion: no pior caso a imagem some,
    em vez de o pipeline inteiro parar."""
    os.makedirs(PASTA_PLANTAS, exist_ok=True)
    baixados = {}
    for u in unidades:
        url = u.get("planta") or ""
        nome = "decorado" if u.get("decorado") else f"tipo-{str(u.get('tipo') or '').strip()}"
        destino = f"{PASTA_PLANTAS}/{nome}.jpg"
        if nome in baixados:
            u["planta"] = baixados[nome]
            continue
        if not url.startswith("http"):
            if os.path.exists(destino):
                u["planta"] = destino
                baixados[nome] = destino
            continue
        try:
            r = requests.get(url, timeout=60)
            r.raise_for_status()
            with open(destino, "wb") as f:
                f.write(r.content)
            u["planta"] = destino
            baixados[nome] = destino
            print(f"  planta {nome}: {len(r.content)//1024} KB -> {destino}")
        except Exception as e:
            print(f"  planta {nome}: falhou ({e}) — mantendo a URL do Notion")
            baixados[nome] = url


def main():
    unidades, cursor = [], None
    while True:
        body = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        r = requests.post(f"https://api.notion.com/v1/databases/{DB}/query",
                          headers=H, json=body, timeout=30)
        r.raise_for_status()
        data = r.json()
        for row in data["results"]:
            pr = row["properties"]
            # VENDIDA tem tres estados: SIM, NAO e RESERVADA.
            vend_cru = _norm(txt(pr, "VENDIDA") or "")
            vendida = vend_cru == "SIM"
            reservada = vend_cru in ("RESERVADA", "RESERVADO")
            disp = sim_nao(pr, "DISPONIVEL")
            unidades.append({
                "unidade": txt(pr, "UNIDADE"),
                "tipo": str(txt(pr, "TIPO") or ""),
                "valorVenda": num(pr, "VALOR DE VENDA"),
                "avaliacao": num(pr, "AVALIACAO"),
                "planta": txt(pr, "PLANTA") or "",
                "informacoes": txt(pr, "INFORMACOES") or "",
                "decorado": sim_nao(pr, "DECORADO") is True,
                # coluna ausente/vazia = disponivel; vendida sempre tira de
                # disponivel, mesmo se esquecerem de trocar as duas colunas.
                "disponivel": (True if disp is None else disp)
                              and not vendida and not reservada,
                "reservado": reservada,
                "vendido": vendida,
                "vendidaCru": vend_cru or "NAO",
            })
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")

    baixar_plantas(unidades)

    def chave(u):
        try:
            return int(re.sub(r"\D", "", str(u["unidade"])) or 0)
        except ValueError:
            return 0
    unidades.sort(key=chave)
    with open("unidades.json", "w", encoding="utf-8") as f:
        json.dump(unidades, f, ensure_ascii=False, indent=2)
    disp = sum(1 for u in unidades if u["disponivel"])
    vend = sum(1 for u in unidades if u["vendido"])
    res = sum(1 for u in unidades if u["reservado"])
    print(f"{len(unidades)} unidades -> unidades.json "
          f"({disp} disponiveis, {res} reservadas, {vend} vendidas, "
          f"{len(unidades) - disp - vend - res} em breve)")


if __name__ == "__main__":
    main()
