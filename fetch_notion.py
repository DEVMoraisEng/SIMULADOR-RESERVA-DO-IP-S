# -*- coding: utf-8 -*-
"""Lê a base UNIDADES RESERVA DOS IPÊS no Notion e gera unidades.json,
consumido pelo simulador (auto-preenchimento) e pelo mapa.
Rodado pelo GitHub Actions. Requer os secrets NOTION_TOKEN e NOTION_DB_UNIDADES."""
import os, json, requests

TOKEN = os.environ["NOTION_TOKEN"]
DB = os.environ["NOTION_DB_UNIDADES"]
H = {"Authorization": f"Bearer {TOKEN}", "Notion-Version": "2022-06-28",
     "Content-Type": "application/json"}


def txt(p):
    if not p: return ""
    t = p.get("type")
    if t in ("rich_text", "title"):
        return "".join(x.get("plain_text", "") for x in p.get(t, []))
    if t == "number": return p.get("number")
    if t == "checkbox": return p.get("checkbox")
    if t == "select": return (p.get("select") or {}).get("name", "")
    if t == "files":
        fs = p.get("files") or []
        if fs:
            f = fs[0]
            return (f.get("file") or f.get("external") or {}).get("url", "")
    return ""


def main():
    unidades, cursor = [], None
    while True:
        body = {"page_size": 100}
        if cursor: body["start_cursor"] = cursor
        r = requests.post(f"https://api.notion.com/v1/databases/{DB}/query",
                          headers=H, json=body, timeout=30)
        r.raise_for_status()
        data = r.json()
        for row in data["results"]:
            pr = row["properties"]
            unidades.append({
                "unidade": txt(pr.get("UNIDADE")),
                "tipo": str(txt(pr.get("TIPO")) or ""),
                "valorVenda": txt(pr.get("VALOR DE VENDA")) or 0,
                "avaliacao": txt(pr.get("AVALIAÇÃO")) or 0,
                "planta": txt(pr.get("PLANTA")) or "",
                "informacoes": txt(pr.get("INFORMAÇÕES")) or "",
                "decorado": str(txt(pr.get("DECORADO")) or "").strip().upper() == "SIM",
                "disponivel": str(txt(pr.get("DISPONÍVEL")) or "SIM").strip().upper() not in ("NÃO", "NAO"),
            })
        if not data.get("has_more"): break
        cursor = data.get("next_cursor")
    unidades.sort(key=lambda u: (u["unidade"] or 0))
    with open("unidades.json", "w", encoding="utf-8") as f:
        json.dump(unidades, f, ensure_ascii=False, indent=2)
    print(f"{len(unidades)} unidades -> unidades.json")


if __name__ == "__main__":
    main()
