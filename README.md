# Portfolio site

The source of [muhammad-huzaifa-shafique.github.io](https://muhammad-huzaifa-shafique.github.io). It is a small static site with no build step: plain HTML pages, one stylesheet and one script. The dark theme, the star-field background and the charts are all drawn in the browser.

## Pages

- [index.html](index.html): home page, with the four main projects first
- [casefile.html](casefile.html): Casefile, a local retrieval-augmented assistant that cites its sources
- [cyberai.html](cyberai.html): CyberAI, a threat-triage pipeline with a human-review queue and a cited assistant
- [forecasting.html](forecasting.html): monthly sales forecasting with a neural network, compared against four baselines
- [dashboard.html](dashboard.html): Gapminder dashboard on life expectancy and income, 1952 to 2007
- [deep-learning.html](deep-learning.html): four neural-network assignments, from backpropagation in NumPy to Keras CNNs; scrub through training and step through the experiments. The code is in [Neural-Networks-Coursework](https://github.com/Muhammad-Huzaifa-Shafique/Neural-Networks-Coursework)
- [data-engineering.html](data-engineering.html): the vote extractor and the fixed-width extractor, with output checks
- [method.html](method.html): how I use AI assistants, with the real prompts and my checks

## Other files

- [site.css](site.css) and [site.js](site.js): shared styles, page effects and chart helpers
- [casefile-data.json](casefile-data.json), [gapminder-data.json](gapminder-data.json) and [nn-data.json](nn-data.json): data the explainers load
- [llms.txt](llms.txt): a plain-text summary for AI tools
- [sitemap.xml](sitemap.xml) and [robots.txt](robots.txt)

## How it works

All of the content is plain HTML, so it reads the same with scripts off, in a text browser or in a search crawler. JavaScript only adds the effects and the interactive charts. If the user's system asks for reduced motion, the background stays still and the reveal, typing and count-up effects are skipped. Fonts load from Google Fonts, with system fonts as the fallback.

Every number on a page comes from the project's own output, and each page lists what it does not show.

Made by [Muhammad Huzaifa Shafique](https://github.com/Muhammad-Huzaifa-Shafique).
