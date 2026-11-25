"""Runs the real CyberAI.py with the internet switched off, so its answers can be compared with the JavaScript port.

CyberAI.py is imported unchanged. Find it through the CYBERAI_PY environment variable, or clone the CyberAI
repository next to this one. Three things are replaced:
  * packages that are not installed (PyPDF2, dnspython, tldextract) get stand-ins,
  * every function that reaches the internet (VirusTotal, DNS, RDAP, blocklists, SPF and DMARC) returns nothing,
  * classify_threat is re-compiled from its own source with the score added to its return values, because the
    original returns only the verdict and the reasons.
Everything else (the URL heuristics, the look-alike check, the email rules, the verdict thresholds) is the real code.
"""
import importlib.util
import inspect
import os
import sys
import types

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
SRC = os.environ.get("CYBERAI_PY") or os.path.join(HERE, "..", "..", "..", "CyberAI", "CyberAI.py")
if not os.path.isfile(SRC):
    sys.exit("CyberAI.py not found at %s. Set CYBERAI_PY to its path." % SRC)


def _missing(name):
    try:
        __import__(name)
        return False
    except ImportError:
        return True


def _stub(name, **attrs):
    m = types.ModuleType(name)
    for k, v in attrs.items():
        setattr(m, k, v)
    sys.modules[name] = m
    return m


def _no_pdf(*a, **k):
    raise RuntimeError("PDF files are not read in this test")


STANDIN = _missing("tldextract")
if STANDIN:
    import tldextract_standin as tldextract
    sys.modules["tldextract"] = tldextract
else:
    import tldextract
if _missing("PyPDF2"):
    _stub("PyPDF2", PdfReader=_no_pdf)
if _missing("dns"):
    _dns = _stub("dns")
    _dns.resolver = _stub("dns.resolver", Resolver=object)
    _dns.reversename = _stub("dns.reversename")

os.chdir(HERE)  # no trusted_domains.json here, so CyberAI uses its built-in list
spec = importlib.util.spec_from_file_location("CyberAI", SRC)
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)

# --- internet off ----------------------------------------------------------------------------------
C.VT_API_KEY = ""
C.vt_url_scan = lambda url: (None, "VIRUSTOTAL_API_KEY not set")
C.get_dns_info = lambda d: {"A": [], "MX": [], "NS": [], "TXT": [], "SOA": None, "PTR": []}
C.get_rdap = lambda d: {"error": "offline"}
C.dnsbl_for_domain = lambda d: []
C.dnsbl_from_raw_email = lambda t: []
C.check_spf_dmarc = lambda d: []

# --- classify_threat with the score returned too ---------------------------------------------------
_src = inspect.getsource(C.classify_threat)
for lab in ("Malware", "Suspicious", "Clean"):
    _src = _src.replace('return "%s", reasons' % lab, 'return "%s", reasons, score' % lab)
_ns = dict(C.__dict__)
exec(_src, _ns)
classify_with_score = _ns["classify_threat"]

DEFAULT_TRUSTED = ["pittstate.edu", "paypal.com", "google.com", "microsoft.com", "apple.com"]


def set_trusted(lst):
    C.TRUSTED_DOMAINS = list(lst)


set_trusted(DEFAULT_TRUSTED)


def _pack(res):
    verdict, reasons, score = classify_with_score(res)
    reasons = [r for r in reasons if not r.startswith("VirusTotal error")]
    return {"verdict": verdict, "score": score, "reasons": reasons}


def run(kind, text, trusted=None):
    set_trusted(trusted if trusted is not None else DEFAULT_TRUSTED)
    text = text.strip()   # the tool's command line and web page both strip the input first
    try:
        if kind == "url":
            res = C.analyze_website(text)
            out = _pack(res)
            out["domain"] = res["domain"]
            out["heuristics"] = res["heuristics"]
        elif kind == "email":
            res = C.analyze_email(text)
            out = _pack(res)
            out["sender"] = res["sender"]
            out["alerts"] = res["alerts"]
            out["urls"] = res["extracted_urls"]
        elif kind == "pdf":
            res = C.analyze_pdf(text)
            out = _pack(res)
            out["urls"] = res["extracted_urls"]
        else:
            raise ValueError(kind)
        return out
    except Exception as e:  # the real tool would stop here
        return {"error": type(e).__name__}


if __name__ == "__main__":
    print("tldextract:", "stand-in" if STANDIN else "real package")
    for k, t in [("url", "http://secure-login-paypal.example.com/verify"), ("email", "support@paypa1.com"),
                 ("email", "From: PayPal <service@paypa1.com>\nReply-To: <x@evil.test>\n\nUrgent: verify your account"),
                 ("pdf", "see https://a.example/x and https://a.example/x and http://b.example")]:
        print(k, run(k, t))
