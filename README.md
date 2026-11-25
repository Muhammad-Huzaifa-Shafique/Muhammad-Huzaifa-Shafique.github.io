# Portfolio site

The source of [muhammad-huzaifa-shafique.github.io](https://muhammad-huzaifa-shafique.github.io). It is a small static site with no build step: plain HTML pages, one stylesheet and two scripts (a shared one, and the JavaScript port of the CyberAI triage rules). The dark theme, the star-field background and the charts are all drawn in the browser.

## Pages

- [index.html](index.html): home page, with the four main projects first
- [casefile.html](casefile.html): Casefile, a local retrieval-augmented generation (RAG) system that cites its sources
- [cyberai.html](cyberai.html): CyberAI, an ML pipeline with drift monitoring and human review, a cited retrieval assistant, and a rule-based baseline that runs live in the browser
- [forecasting.html](forecasting.html): monthly sales forecasting with a neural network, compared against four baselines
- [dashboard.html](dashboard.html): Gapminder dashboard on life expectancy and income, 1952 to 2007
- [deep-learning.html](deep-learning.html): four neural-network assignments, from backpropagation in NumPy to Keras CNNs; scrub through training and step through the experiments. The code is in [Neural-Networks-Coursework](https://github.com/Muhammad-Huzaifa-Shafique/Neural-Networks-Coursework)
- [data-engineering.html](data-engineering.html): the vote extractor and the fixed-width extractor, with output checks
- [method.html](method.html): how I use AI assistants, with the real prompts and my checks

## Other files

- [site.css](site.css) and [site.js](site.js): shared styles, page effects and chart helpers
- [casefile-data.json](casefile-data.json), [gapminder-data.json](gapminder-data.json) and [nn-data.json](nn-data.json): data the explainers load
- [cyberai-triage.js](cyberai-triage.js) and [cyberai-suffixes.json](cyberai-suffixes.json): the browser version of the CyberAI triage rules, and the Public Suffix List snapshot it needs
- [tests/cyberai-parity](tests/cyberai-parity): scripts that compare that port with the real Python code (see its README)
- [llms.txt](llms.txt): a plain-text summary for AI tools
- [sitemap.xml](sitemap.xml) and [robots.txt](robots.txt)

## How it works

All of the content is plain HTML, so it reads the same with scripts off, in a text browser or in a search crawler. JavaScript adds the effects, the interactive charts and the live triage box on the CyberAI page. If the user's system asks for reduced motion, the background stays still and the reveal, typing and count-up effects are skipped. Fonts load from Google Fonts, with system fonts as the fallback.

Every number on a page comes from the project's own output, and each page lists what it does not show.

Made by [Muhammad Huzaifa Shafique](https://github.com/Muhammad-Huzaifa-Shafique).
