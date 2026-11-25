"""A stand-in for the tldextract package, used only when the package is not installed.

I wrote it because I could not install tldextract in the environment where I ran these tests. It follows the
algorithm tldextract documents: only the ICANN rules of the Public Suffix List (no private domains), a lookup tree
built from the rules with the labels reversed, lower-cased and punycode-decoded labels, wildcard and exception rules,
and a lenient parse of the host that drops the scheme, path, user info and port. Point PSL_FILE at a copy of
public_suffix_list.dat. Prefer the real package when you can install it.
"""
import os
import re
import sys
from collections import namedtuple

import idna

PSL = os.environ.get("PSL_FILE", "")
if not os.path.isfile(PSL):
    sys.exit("tldextract is not installed, so a copy of public_suffix_list.dat is needed: set PSL_FILE to its path.")
ExtractResult = namedtuple("ExtractResult", "subdomain domain suffix is_private")
_SCHEME = set("abcdefghijklmnopqrstuvwxyz0123456789+-.")
_IP_RE = re.compile(r"^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$")


class _Node:
    __slots__ = ("m", "end")

    def __init__(self):
        self.m = {}
        self.end = False


def _build():
    txt = open(PSL, encoding="utf-8").read()
    a = txt.find("// ===BEGIN ICANN DOMAINS===")
    b = txt.find("// ===END ICANN DOMAINS===")
    root = _Node()
    for ln in txt[a:b].splitlines():
        ln = ln.strip()
        if not ln or ln.startswith("//"):
            continue
        rule = ln.split()[0]
        node = root
        for lab in reversed(rule.split(".")):
            node = node.m.setdefault(lab, _Node())
        node.end = True
    return root


_ROOT = _build()


def _decode(label):
    low = label.lower()
    if low.startswith("xn--"):
        try:
            return idna.decode(low)
        except (UnicodeError, IndexError, idna.IDNAError):
            pass
    return low


def _schemeless(url):
    i = url.find("//")
    if i == 0:
        return url[2:]
    if i < 2 or url[i - 1] != ":" or set(url[: i - 1]) - _SCHEME:
        return url
    return url[i + 2:]


def lenient_netloc(url):
    after = _schemeless(url).partition("/")[0].partition("?")[0].partition("#")[0].rpartition("@")[-1]
    if after and after[0] == "[":
        p = after.partition("]")
        if p[1] == "]":
            return p[0] + "]"
    host = after.partition(":")[0].strip()
    return host.rstrip(".。．｡")


def _suffix_index(labels):
    node = _ROOT
    i = j = len(labels)
    for label in reversed(labels):
        d = _decode(label)
        if d in node.m:
            j -= 1
            node = node.m[d]
            if node.end:
                i = j
            continue
        if "*" in node.m:
            if "!" + d in node.m:
                return j
            return j - 1
        break
    return i


def extract(url):
    netloc = lenient_netloc(url)
    ascii_dots = netloc.replace("。", ".").replace("．", ".").replace("｡", ".")
    labels = ascii_dots.split(".")
    idx = _suffix_index(labels)
    n = len(labels)
    if n == idx and ascii_dots[:1].isdigit() and _IP_RE.fullmatch(ascii_dots):
        return ExtractResult("", ascii_dots, "", False)
    suffix = ".".join(labels[idx:]) if idx != n else ""
    subdomain = ".".join(labels[: idx - 1]) if idx >= 2 else ""
    domain = labels[idx - 1] if idx else ""
    return ExtractResult(subdomain, domain, suffix, False)
