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
            unidades.append({
                "unidade": txt(pr, "UNIDADE"),
                "tipo": str(txt(pr, "TIPO") or ""),
                "valorVenda": num(pr, "VALOR DE VENDA"),
                "avaliacao": num(pr, "AVALIACAO"),
                "planta": txt(pr, "PLANTA") or "",
                "informacoes": txt(pr, "INFORMACOES") or "",
                "decorado": sel(pr, "DECORADO") == "SIM",
                "disponivel": sel(pr, "DISPONIVEL", "SIM") != "NAO",
                "vendido": sel(pr, "VENDIDA") == "SIM",
            })
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")

    def chave(u):
        try:
            return int(re.sub(r"\D", "", str(u["unidade"])) or 0)
        except ValueError:
            return 0
    unidades.sort(key=chave)
    with open("unidades.json", "w", encoding="utf-8") as f:
        json.dump(unidades, f, ensure_ascii=False, indent=2)
    print(f"{len(unidades)} unidades -> unidades.json")


if __name__ == "__main__":
    main()
