# CyberAI parity tests

The CyberAI page on this site has a live box that runs the offline rules of the triage tool in the browser. The browser version is `cyberai-triage.js` in the root of this repository. These scripts check that it gives the same answers as the real Python tool, [`CyberAI.py`](https://github.com/Muhammad-Huzaifa-Shafique/CyberAI).

## What is compared

For each input, the real `CyberAI.py` and the JavaScript port both produce a verdict, a score and the list of reasons, and the two are compared exactly. The same is done for the three library behaviours the rules depend on.

| Compared | Cases in my last run | Differences |
|---|---|---|
| Links: verdict, score, reasons, domain, heuristics | 3,023 | 0 |
| Emails and email addresses: verdict, score, reasons, sender, alerts, links | 4,655 | 0 |
| PDF text: links found | 504 | 0 |
| String similarity (`difflib` ratio) | 7,900 | 0 |
| URL parsing (`urllib.parse`: host and netloc) | 6,000 | 0 |
| Domain splitting (`tldextract`) | 6,518 | 0 |
| **Total** | **28,600** | **0** |

The cases are a mix of hand-written edge cases (odd schemes, user info, bracketed IPv6 hosts, Unicode and punycode names, capital letters, Reply-To variants, very long strings) and seeded random ones. A share of the emails is built to reach 5 points, because the Malware threshold is rarely reached by chance.

## Files

| File | What it does |
|---|---|
| `ref.py` | Imports the real `CyberAI.py` unchanged and switches the internet off, so its answers can be used as the reference. |
| `gen_cases.py` | Builds the cases and records what the real code answers for each. Writes `cases.json` (about 5 MB, not committed; make it fresh each time). |
| `run_parity.js` | Runs the port on every case and compares. Exits with 1 if anything differs. |
| `check_mutations.js` | Breaks the port in 15 places, one at a time, and checks that `run_parity.js` notices each one. |
| `make_suffixes.py` | Builds `cyberai-suffixes.json` (the ICANN part of the Public Suffix List) from a copy of `public_suffix_list.dat`. |
| `tldextract_standin.py` | A stand-in for the `tldextract` package, used only when the package is not installed (see the limits below). |

## How to run it

You need Python 3.12 or newer (the port follows the way `urllib.parse` behaves from 3.12) and Node.js.

```
# 1. Put the real tool next to this repository, or point CYBERAI_PY at it
git clone https://github.com/Muhammad-Huzaifa-Shafique/CyberAI.git ../CyberAI

# 2. Build the cases (from this folder). If tldextract is not installed, also set PSL_FILE
#    to a copy of public_suffix_list.dat and install idna.
python gen_cases.py

# 3. Compare, then check that the comparison can fail
node run_parity.js
node check_mutations.js
```

To use a copy of `CyberAI.py` somewhere else, set `CYBERAI_PY=/path/to/CyberAI.py`. `python ref.py` runs four example inputs and prints whether the real `tldextract` or the stand-in was used.

## What is replaced in the reference run

- Every function in `CyberAI.py` that reaches the internet (VirusTotal, DNS, RDAP, blocklists, SPF and DMARC) returns nothing. The comparison covers the offline rules only, so the live box does too.
- `classify_threat` is re-compiled from its own source with the score added to its return values, because the original returns only the verdict and the reasons.
- Packages that are not installed (`PyPDF2`, `dnspython`, `tldextract`) get stand-ins. PDF files are therefore not read: the PDF comparison feeds pasted text to the link extractor.

## Limits

- I could not install `tldextract` in the environment where I ran these tests, so my reference run used `tldextract_standin.py`. I wrote it from the documented algorithm (ICANN rules only, wildcard and exception rules, punycode-decoded labels) and the Public Suffix List snapshot of 28 December 2025, and checked it against 13 known examples. The domain-splitting row above shows that the port agrees with that stand-in. `ref.py` uses the real package when it is installed, but I have not run that path, so a difference there is possible.
- The cases are samples, not a proof. The random cases use a fixed seed, so a run is repeatable.
- Matching the Python tool means copying its quirks. For example, the look-alike check for email addresses is case-sensitive, and the keyword rule matches pieces of a domain name. The port keeps these behaviours on purpose, and the CyberAI page lists them.
