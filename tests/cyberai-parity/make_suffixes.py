"""Builds cyberai-suffixes.json from a copy of the Public Suffix List (ICANN section only).

usage: python make_suffixes.py public_suffix_list.dat 2025-12-28 > ../../cyberai-suffixes.json

The second argument is the date of the list snapshot; it is only written into the file as a label.
Format: "s" holds the one-label rules, "m" maps each last label to its longer rules with that label removed.
Rules are kept as written in the list ("!" marks an exception, "*" a wildcard) and are sorted.
"""
import json
import sys

path, snapshot = sys.argv[1], sys.argv[2]
txt = open(path, encoding="utf-8").read()
txt = txt[txt.index("// ===BEGIN ICANN DOMAINS==="):txt.index("// ===END ICANN DOMAINS===")]
single, longer = [], {}
for line in txt.splitlines():
    line = line.strip()
    if not line or line.startswith("//"):
        continue
    rule = line.split()[0]
    labels = rule.split(".")
    if len(labels) == 1:
        single.append(rule)
    else:
        longer.setdefault(labels[-1], []).append(".".join(labels[:-1]))
out = {
    "v": "ICANN section of the Public Suffix List, snapshot %s (rules as written; ! = exception, * = wildcard)" % snapshot,
    "s": " ".join(sorted(single)),
    "m": {tld: " ".join(sorted(longer[tld])) for tld in sorted(longer)},
}
sys.stdout.write(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
