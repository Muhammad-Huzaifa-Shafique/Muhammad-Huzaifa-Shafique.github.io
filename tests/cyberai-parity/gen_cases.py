"""Builds the test cases: hand-written and seeded random inputs, with the answers of the real CyberAI.py (internet off).

usage: python gen_cases.py        (writes cases.json next to this file, about 5 MB; run_parity.js reads it)
"""
import json
import os
import random
import urllib.parse
from difflib import SequenceMatcher

import ref

tldextract = ref.tldextract
HERE = os.path.dirname(os.path.abspath(__file__))

R = random.Random(20261125)
TRUSTED = ref.DEFAULT_TRUSTED

WORDS = ["login", "secure", "verify", "update", "account", "paypal", "bank", "gift", "free", "promo", "www", "mail",
         "example", "google", "microsoft", "apple", "pittstate", "shop", "cdn", "a", "b", "x", "news", "support",
         "xn--p1ai", "пример", "pаypal", "münchen", "日本", "LOGIN", "PayPal",
         "a" * 30, "very-long-label-number-" + "z" * 12, "kK", "café"]
TLDS = ["com", "net", "org", "edu", "co.uk", "com.au", "xyz", "invalidtld", "ru", "рф", "xn--p1ai", "jp", "kobe.jp",
        "ck", "COM", "info", "io", "gov", "blogspot.com", "ac.uk", "com.br", "city.kobe.jp", "a.b.kobe.jp"]


def label():
    w = R.choice(WORDS)
    r = R.random()
    if r < 0.12:
        w = "-".join([w] * R.randint(2, 5))
    elif r < 0.18:
        w = w + "-" + R.choice(WORDS)
    elif r < 0.22:
        w = w.upper()
    return w


def host():
    r = R.random()
    if r < 0.05:
        return ".".join(str(R.randint(0, 300)) for _ in range(4))
    if r < 0.08:
        return R.choice(["[::1]", "[2001:db8::1]", "[bad]", "[::ffff:1.2.3.4]", "[fe80::1%25eth0]", "[1.2.3.4]", "[v1.x]", "[", "]", "[::1"])
    return ".".join([label() for _ in range(R.choice([0, 0, 1, 1, 2, 3, 4, 5]))] + [R.choice(TLDS)])


def url():
    r = R.random()
    if r < 0.06:
        return "".join(R.choice("abcxyz:/.@-_ ?#[]%\\\téа／1:0") for _ in range(R.randint(1, 40)))
    sch = R.choice(["http://", "https://", "https://", "HTTP://", "ftp://", "//", "", "", "hxxp://", "javascript:", "mailto:", " http://", "http:/",
                    "http:///", "https:\\\\", "x1+y-z.://", "1http://", "\x01http://"])
    ui = R.choice(["", "", "", "user@", "user:pw@", "a@b@", "@"])
    port = R.choice(["", "", "", ":8080", ":", ":abc", ":80:90"])
    path = R.choice(["", "", "/", "/verify?x=1", "/a b", "#frag", "?q=1", "/\nx", "/%2e"])
    return sch + ui + host() + port + path


def mutate(d):
    r = R.random()
    if r < 0.2:
        i = R.randrange(len(d)); return d[:i] + d[i + 1:]
    if r < 0.4:
        i = R.randrange(len(d) + 1); return d[:i] + R.choice("abcl1o0e-") + d[i:]
    if r < 0.6:
        i = R.randrange(len(d)); return d[:i] + R.choice("1o0аоерx") + d[i + 1:]
    if r < 0.7:
        return d.replace("l", "1").replace("o", "0")
    if r < 0.8:
        return R.choice(["mail.", "accounts.", "secure-login.", "www.", "a.b."]) + d
    if r < 0.9:
        return d.rsplit(".", 1)[0] + "." + R.choice(["net", "co", "org", "com.au", "co.uk", "xyz"])
    return d.upper() if R.random() < .5 else d.title()


def edomain():
    r = R.random()
    if r < 0.12:
        return host().replace("[", "").replace("]", "")
    base = R.choice(TRUSTED)
    if r < 0.2:
        return base
    d = base
    for _ in range(R.choice([1, 1, 2, 3])):
        d = mutate(d)
    return d


def addr(domain=None):
    return R.choice(["support", "no-reply", "A.B", "service", "x"]) + "@" + (domain if domain is not None else edomain())


BODY = ["verify", "reset", "urgent", "bank", "paypal", "password", "account", "suspend", "click here", "VERIFY", "Click Here",
        "Account", "ſuspend", "banK", "hello", "meeting at 3", "invoice", "free gift", "http://a.test/x", "https://b.test/y?z=1",
        "see attached", "10.0.0.1", "wire transfer"]


def raw_email(dom=None):
    lines = []
    sender = addr(dom() if dom else None)
    f = R.random()
    if f < 0.45:
        lines.append("From: %s <%s>" % (R.choice(["PayPal", "Support Team", "IT", "Émile"]), sender))
    elif f < 0.7:
        lines.append("From: " + sender)
    elif f < 0.8:
        lines.append(R.choice(["from:", "FROM:", "From :"]) + " " + sender)
    elif f < 0.9:
        lines.append("From: Someone without an address")
    if R.random() < 0.5:
        rp = R.choice([sender, addr(dom() if dom else None), "Name <%s>" % sender, "<%s>" % addr(), sender.upper(), ""])
        lines.append(R.choice(["Reply-To: ", "reply-to: ", "REPLY-TO:", "Reply-To:\t"]) + rp)
    if R.random() < 0.5:
        lines.append("Subject: " + " ".join(R.choice(BODY) for _ in range(R.randint(1, 4))))
    if R.random() < 0.3:
        lines.append("Received: from mx (203.0.113.%d)" % R.randint(1, 254))
    if R.random() < 0.2:
        lines.append("To: you@example.com")
    R.shuffle(lines)
    body = " ".join(R.choice(BODY) for _ in range(R.randint(0, 8)))
    nl = R.choice(["\n", "\n", "\n", "\r\n"])
    return nl.join(lines) + nl + nl + body


def email_input():
    r = R.random()
    if r < 0.45:
        return addr()
    if r < 0.5:
        return R.choice(["  %s  " % addr(), "a@b@c.com", "@", "no at sign", "x@y z.com", "\n" + addr(), addr() + "\n"])
    return raw_email()


def pdf_text():
    parts = []
    for _ in range(R.randint(0, 8)):
        parts.append(R.choice(["https://a.example/x", "http://b.example/y?q=1", "HTTP://UPPER.example", "see", "text", "'https://q.example/z'",
                               '"http://dq.example"', "<http://angle.example/a>", "https://a.example/x", "https://uni.example/é", "ftp://no.example"]))
    sep = R.choice([" ", "\n", "   ", "　", "\t", "\x1c", " ", "﻿"])
    return sep.join(parts)


def rstr(alpha, n):
    return "".join(R.choice(alpha) for _ in range(n))


out = {"url": [], "email": [], "pdf": [], "ratio": [], "urlparse": [], "extract": []}

# --- hand-written cases ------------------------------------------------------------------------------
URLS = ["http://secure-login-paypal.example.com/verify", "https://www.google.com", "https://bankofamerica.com", "http://free-gift-card.xyz",
        "http://a-b-c-d-e.example.com", "http://a.b.c.d.example.com", "http://" + "a" * 41 + ".com", "http://xn--pypal-4ve.com", "http://pаypal.com",
        "example.com/path?x=1", "paypal-login.example.com", "http://192.168.0.1/login", "http://[::1]:8080/x", "http://user:pw@host.com:99/p",
        "https://accounts.google.com.evil.example/", "http://login.microsoft.com.verify-account.update.secure.example.org/",
        "", "http://", "http:///x", "HTTP://EXAMPLE.COM", "http://exa mple.com", "https://paypal.com", "http://UPDATE.EXAMPLE.COM"]
EMAILS = ["support@paypa1.com", "support@paypal.com", "SUPPORT@PAYPAL.COM", "x@PAYPA1.COM", "x@accounts.google.com", "x@google.com.evil.test",
          "x@pаypal.com", "x@xn--pypal-4ve.com", "x@mail.pittstate.edu", "x@pittstate.net", "x@bbc.co.uk", "x@micr0soft.com", "x@appIe.com",
          "x@1.2.3.4", "x@[1.2.3.4]", "x@localhost", "x@a.invalidtld", "no-at-sign", "a@b@c", "x@ y.com",
          "From: PayPal <service@paypa1.com>\nReply-To: <x@evil.test>\n\nUrgent: click here to verify your account password",
          "From: me@example.com\nReply-To: me@example.com\n\nhello",
          "From: me@example.com\nReply-To: Me <me@example.com>\n\nhello",
          "From: me@example.com\nreply-to: ME@EXAMPLE.COM\n\nhello",
          "Subject: hi\n\nyour account was suspended", "From: x@apple.com.fake.example\n\nbank transfer", "From: a@b.com\r\nReply-To: a@c.com\r\n\r\nverify"]
for u in URLS:
    out["url"].append([u, None, ref.run("url", u)])
for e in EMAILS:
    out["email"].append([e, None, ref.run("email", e)])
for t in ["see https://a.example/x and https://a.example/x and http://b.example", "", "no links", "HTTP://X.EXAMPLE https://y.example"]:
    out["pdf"].append([t, None, ref.run("pdf", t)])
for tr in (["amazon.com", "intranet.local", "example.co.uk", "公司.cn"], ["a.b", "b.c"], []):
    for e in ["x@amazon.co", "x@mail.amazon.com", "x@intranet.local", "x@www.intranet.local", "x@example.co.uk", "x@evil.example.co.uk", "x@公司.cn", "x@amaz0n.com"]:
        out["email"].append([e, tr, ref.run("email", e, tr)])

# --- random cases ------------------------------------------------------------------------------------
for _ in range(3000):
    u = url()
    out["url"].append([u, None, ref.run("url", u)])
for _ in range(4000):
    e = email_input()
    tr = None if R.random() < 0.9 else R.choice([["amazon.com", "paypal.com"], ["example.co.uk", "intranet.local"], ["google.com"], []])
    out["email"].append([e, tr, ref.run("email", e, tr)])
for _ in range(500):
    t = pdf_text()
    out["pdf"].append([t, None, ref.run("pdf", t)])


# --- cases that reach the Malware threshold (5 points or more) --------------------------------------------
HEAVY = ["paypal.com", "paypa1.com", "paypal.co", "paypall.com", "paypal.cm", "pay-pal.com", "paypal.org"]
for _ in range(600):
    tr = R.sample(HEAVY, R.randint(3, len(HEAVY)))
    e = raw_email(lambda: mutate(R.choice(tr + ["paypal.com"])))
    out["email"].append([e, tr, ref.run("email", e, tr)])
for e in ["From: A <x@paypa1.com>\nReply-To: <y@evil.test>\n\nurgent verify your account"]:
    for tr in (HEAVY, HEAVY[:3], HEAVY[:4], HEAVY[:5]):
        out["email"].append([e, tr, ref.run("email", e, tr)])

ALPH = ["ab", "abc", "abcdef", "abcdefghijklmnopqrstuvwxyz.-0123456789", "aаbо\U0001f600"]
for _ in range(6000):
    al = R.choice(ALPH)
    a, b = rstr(al, R.randint(0, 45)), rstr(al, R.randint(0, 45))
    out["ratio"].append([a, b, SequenceMatcher(None, a, b).ratio()])
for _ in range(400):                      # long b: exercises difflib's autojunk
    al = R.choice(ALPH[:4])
    a, b = rstr(al, R.randint(0, 260)), rstr(al, R.randint(195, 420))
    out["ratio"].append([a, b, SequenceMatcher(None, a, b).ratio()])
for t in TRUSTED:
    for _ in range(300):
        a = mutate(t)
        out["ratio"].append([a, t, SequenceMatcher(None, a, t).ratio()])

for _ in range(6000):
    u = url()
    try:
        p = urllib.parse.urlparse(u)
        exp = {"netloc": p.netloc, "hostname": p.hostname}
    except Exception:
        exp = {"error": True}
    out["urlparse"].append([u, exp])

SUF = json.load(open(os.path.join(HERE, "..", "..", "cyberai-suffixes.json"), encoding="utf-8"))
rules = [r for r in SUF["s"].split(" ")] + [rest + "." + tld for tld, rests in SUF["m"].items() for rest in rests.split(" ")]
rules = [r.lstrip("!").replace("*.", "zz.") for r in rules]   # inputs only: exception and wildcard rules become ordinary names
doms = []
for _ in range(5000):
    r = R.choice(rules)
    doms.append(R.choice(["", "x.", "a.b.", "WWW.", "münchen.", "xn--80ak6aa92e."]) + r)
for _ in range(1500):
    doms.append(host().replace("[", "").replace("]", ""))
doms += ["localhost", "a", "", ".", "a.", "..", "a..b", ".com", "COM", "1.2.3.4", "01.02.03.004", "256.1.1.1", "xn--p1ai", "x.xn--p1ai",
         "http://user@www.example.co.uk:80/path", "//x.example.com", "HTTP://X.COM", "a.b.c.d.e.f.g.h.com"]
for d in doms:
    r = tldextract.extract(d)
    out["extract"].append([d, [r.subdomain, r.domain, r.suffix]])

json.dump(out, open(os.path.join(HERE, "cases.json"), "w", encoding="utf-8"), ensure_ascii=True)
print({k: len(v) for k, v in out.items()})
