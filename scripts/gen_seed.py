#!/usr/bin/env python3
"""Genera supabase/seed.sql dal piano dei conti del Gestionale YouSud.

Fonti (nessun codice inventato):
  - acc_dump.json: conti, categorie e codici di entrata/uscita, mappatura codice -> riga Mod. D,
    modalità di pagamento, progetti, sezioni delle entrate (estratti dal Gestionale).
  - app.html del Gestionale: sezioni delle uscite (U_SECT) e righe investimenti/imposte.

Uso: python3 scripts/gen_seed.py <acc_dump.json> <app.html> > supabase/seed.sql
"""
import json, re, sys

dump = json.load(open(sys.argv[1], encoding="utf-8"))
html = open(sys.argv[2], encoding="utf-8").read()


def q(v):
    if v is None or v == "":
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


# ---- sezioni delle uscite dal sorgente del Gestionale
i = html.index("U_SECT=[")
j = html.index("];", i)
u_src = html[i:j]
u_sect = []
for m in re.finditer(r'\{s:"([A-E])",it:"([^"]+)",fr:"([^"]+)",L:mkL\((\[\[.*?\]\])\)\}', u_src):
    lines = json.loads(m.group(4))
    u_sect.append({"s": m.group(1), "it": m.group(2), "fr": m.group(3),
                   "L": [{"k": a, "it": b, "fr": c} for a, b, c in lines]})
assert [s["s"] for s in u_sect] == list("ABCDE"), "sezioni uscite non trovate"

inv_sec_it = "Uscite da investimenti in immobilizzazioni o da deflussi di capitale di terzi"
inv_sec_fr = "Dépenses d'investissements en immobilisations ou sorties de capital de tiers"
assert inv_sec_it in html
inv_it = "1) Investimenti in immobilizzazioni inerenti alle attività di interesse generale"
inv_fr = "1) Investissements en immobilisations liés aux activités d'intérêt général"
assert inv_it in html

out = []
w = out.append
w("-- Generato da scripts/gen_seed.py: piano dei conti del Gestionale YouSud (versione codici %s)." % dump["CODES_V"])
w("-- Non modificare a mano: rigenerare dallo script.")
w("begin;")
w("do $seed$")
w("declare v_org uuid;")
w("begin")
w("  insert into public.organizations(name) values ('YouSud ODV') returning id into v_org;")
w("  insert into public.settings(org_id, key, value) values")
w("    (v_org, 'require_document', 'true'), (v_org, 'four_eyes', 'true'), (v_org, 'chart_version', '%s'),"
  "\n    (v_org, 'ai_reading', 'false');" % dump["CODES_V"])

# conti
loc = {"Home": "IT", "Field": "MG"}
rows = []
for n, a in enumerate(dump["ACCOUNTS"]):
    rows.append("    (v_org, %s, %s, %s, %s, %s, %s, %d)" % (
        q(a["c"]), q(a["it"]), q(a["fr"]), q(a["cur"]), q(loc[a["loc"]]), q(a["kind"]), (n + 1) * 10))
w("  insert into public.accounts(org_id, code, name_it, name_fr, currency, location, kind, sort) values")
w(",\n".join(rows) + ";")

# righe del rendiconto
rows = []
sort = 0
for s in u_sect:
    for l in s["L"]:
        sort += 10
        rows.append("    (v_org, 'out', %s, %s, %s, %s, %s, %s, %d)" % (
            q(s["s"]), q(s["it"]), q(s["fr"]), q(l["k"]), q(l["it"]), q(l["fr"]), sort))
sort += 10
rows.append("    (v_org, 'out', 'INV', %s, %s, 'INV', %s, %s, %d)" % (q(inv_sec_it), q(inv_sec_fr), q(inv_it), q(inv_fr), sort))
sort += 10
rows.append("    (v_org, 'out', 'TAX', 'Imposte', 'Impôts', 'TAX', 'Imposte', 'Impôts', %d)" % sort)
sort = 0
for s in dump["E_SECT"]:
    for l in s["L"]:
        sort += 10
        rows.append("    (v_org, 'in', %s, %s, %s, %s, %s, %s, %d)" % (
            q(s["s"]), q(s["it"]), q(s["fr"]), q(l["k"]), q(l["it"]), q(l["fr"]), sort))
w("  insert into public.report_lines(org_id, direction, section, section_it, section_fr, key, name_it, name_fr, sort) values")
w(",\n".join(rows) + ";")

# gruppi
rows = []
for n, c in enumerate(dump["CATS_EX_NEW"]):
    rows.append("    (v_org, 'out', %s, %s, %s, %d)" % (q(c["c"]), q(c["it"]), q(c["fr"]), (n + 1) * 10))
for n, c in enumerate(dump["CATS_IN_NEW"]):
    rows.append("    (v_org, 'in', %s, %s, %s, %d)" % (q(c["c"]), q(c["it"]), q(c["fr"]), (n + 1) * 10))
w("  insert into public.category_groups(org_id, direction, code, name_it, name_fr, sort) values")
w(",\n".join(rows) + ";")

# codici
lines_out = {l["k"] for s in u_sect for l in s["L"]} | {"INV", "TAX"}
lines_in = {l["k"] for s in dump["E_SECT"] for l in s["L"]}
rows = []
for n, c in enumerate(dump["CODES_EX_NEW"]):
    rl = dump["MAP_EX_NEW"].get(c["c"]) or None
    assert rl is None or rl in lines_out, (c["c"], rl)
    rows.append(("out", c, rl, n))
for n, c in enumerate(dump["CODES_IN_NEW"]):
    rl = dump["MAP_IN_NEW"].get(c["c"]) or None
    # E904 (saldo iniziale, gruppo E9): come nel Gestionale (lineOf) non entra nel rendiconto
    if c["cat"] == "E9" or c["c"] == "E904":
        rl = None
    assert rl is None or rl in lines_in, (c["c"], rl)
    rows.append(("in", c, rl, n))
vals = []
for d, c, rl, n in rows:
    vals.append("    (v_org, '%s', %s, (select id from public.category_groups g where g.org_id = v_org and g.direction = '%s' and g.code = %s), %s, %s, %s, %s, %d)" % (
        d, q(c["c"]), d, q(c["cat"]), q(c["it"]), q(c["fr"]), q(rl), dump["CODES_V"], (n + 1) * 10))
w("  insert into public.categories(org_id, direction, code, group_id, name_it, name_fr, report_line_key, chart_version, sort) values")
w(",\n".join(vals) + ";")

# modalità di pagamento
rows = []
for n, m in enumerate(dump["METHODS"]):
    rows.append("    (v_org, %s, %s, %s, %d)" % (q(m["c"]), q(m["it"]), q(m["fr"]), (n + 1) * 10))
w("  insert into public.payment_methods(org_id, code, name_it, name_fr, sort) values")
w(",\n".join(rows) + ";")

# progetti: "General" del Gestionale = centro di costo di struttura
rows = []
for p in dump["PROJECTS_DEF"]:
    if p == "General":
        rows.append("    (v_org, 'Spese generali (fuori progetto)', 'structure', 'General')")
    else:
        rows.append("    (v_org, %s, 'project', %s)" % (q(p), q(p)))
w("  insert into public.projects(org_id, name, kind, legacy_name) values")
w(",\n".join(rows) + ";")

w("end")
w("$seed$;")
w("commit;")
print("\n".join(out))
print("-- conti %d, righe rendiconto %d, gruppi %d, codici %d (uscite %d, entrate %d), metodi %d, progetti %d" % (
    len(dump["ACCOUNTS"]), sum(len(s["L"]) for s in u_sect) + 2 + sum(len(s["L"]) for s in dump["E_SECT"]),
    len(dump["CATS_EX_NEW"]) + len(dump["CATS_IN_NEW"]), len(rows) and len(dump["CODES_EX_NEW"]) + len(dump["CODES_IN_NEW"]),
    len(dump["CODES_EX_NEW"]), len(dump["CODES_IN_NEW"]), len(dump["METHODS"]), len(dump["PROJECTS_DEF"])), file=sys.stderr)
