#!/usr/bin/env python3
"""Converte o export .xlsx do Search Console em JSON versionável.

O .xlsx é um artefato manual (baixado do Search Console de tempos em tempos),
então converter uma vez e versionar o JSON é mais confiável do que ler zip em
runtime. Rode de novo quando baixar um export mais recente:

    python3 scripts/dados-migracao/converter-gsc.py ~/Downloads/....xlsx
"""
import sys, json, datetime, openpyxl

if len(sys.argv) < 2:
    sys.exit("uso: converter-gsc.py <arquivo.xlsx>")

wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
saida = {"gerado_em": datetime.date.today().isoformat(), "paginas": [], "consultas": [], "diario": []}

def linhas(aba):
    return [r for r in wb[aba].iter_rows(min_row=2, values_only=True) if r and r[0]]

for aba, chave in (("Páginas", "paginas"), ("Consultas", "consultas")):
    if aba in wb.sheetnames:
        for r in linhas(aba):
            saida[chave].append({
                "chave": r[0], "cliques": int(r[1] or 0), "impressoes": int(r[2] or 0),
                "ctr": round(float(r[3] or 0), 6), "posicao": round(float(r[4] or 0), 2),
            })

if "Gráfico" in wb.sheetnames:
    for r in linhas("Gráfico"):
        d = r[0] if isinstance(r[0], datetime.date) else datetime.date.fromisoformat(str(r[0])[:10])
        saida["diario"].append({
            "data": d.isoformat(), "cliques": int(r[1] or 0), "impressoes": int(r[2] or 0),
            "ctr": round(float(r[3] or 0), 6), "posicao": round(float(r[4] or 0), 2),
        })

destino = __file__.rsplit("/", 1)[0] + "/gsc-search-console.json"
json.dump(saida, open(destino, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"paginas={len(saida['paginas'])} consultas={len(saida['consultas'])} dias={len(saida['diario'])}")
print(f"-> {destino}")
