/**
 * Build-time renderer for the static HTML: the <head> metadata, the page shell (bar, world
 * layer, intro card) and the classic view, all from src/content.ts. Runs inside the Vite
 * config, never in the browser. The classic view is the SEO surface and what visitors get
 * with JavaScript off, without WebGL 2, or when they choose it.
 */
import {
  ask,
  contact,
  doctorate,
  failures,
  footer,
  labGroups,
  labsIntro,
  layers,
  lineages,
  path,
  person,
  plandesk,
  proof,
  site,
  toggles,
  turtledove,
  type Failure,
  type LabGroup,
} from '../content';

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const gh = (repo: string) => `https://github.com/pavan139/${repo}`;
const mailto = `mailto:${person.email}`;

// ---------------------------------------------------------------------------------------
// <head> metadata (the head itself is owned by PERF; this is only the content part)
// ---------------------------------------------------------------------------------------

export function renderMeta(): string {
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${site.url}#website`,
        url: site.url,
        name: person.name,
        inLanguage: 'en',
        publisher: { '@id': `${site.url}#person` },
      },
      {
        '@type': 'ProfilePage',
        '@id': `${site.url}#profile`,
        url: site.url,
        name: site.ogTitle,
        inLanguage: 'en',
        dateModified: site.updated,
        isPartOf: { '@id': `${site.url}#website` },
        mainEntity: { '@id': `${site.url}#person` },
      },
      {
        '@type': 'Person',
        '@id': `${site.url}#person`,
        name: person.name,
        alternateName: person.alternateName,
        jobTitle: person.jobTitle,
        worksFor: { '@type': 'Organization', name: person.employer, url: 'https://www.fidelity.com/' },
        description: `${person.role} who builds the reliability layer around large language models: retrieval, evaluation, guardrails and agent runtimes.`,
        url: site.url,
        image: `${site.url}${person.photo}`,
        email: `mailto:${person.email}`,
        alumniOf: { '@type': 'CollegeOrUniversity', name: 'Northeastern University', url: 'https://www.northeastern.edu/' },
        knowsAbout: person.knowsAbout,
        sameAs: [person.links.github, person.links.linkedin],
      },
    ],
  };
  return `<title>${esc(site.title)}</title>
  <meta name="description" content="${esc(site.description)}">
  <link rel="canonical" href="${site.url}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="author" content="${esc(person.name)}">
  <meta name="theme-color" content="${site.themeColor}">
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="${esc(person.name)}">
  <meta property="og:locale" content="en_US">
  <meta property="og:url" content="${site.url}">
  <meta property="og:title" content="${esc(site.ogTitle)}">
  <meta property="og:description" content="${esc(site.ogDescription)}">
  <meta property="og:image" content="${site.ogImage}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(site.ogImageAlt)}">
  <meta property="profile:first_name" content="Pavan">
  <meta property="profile:last_name" content="Mogili">
  <meta property="profile:username" content="pavan139">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(site.ogTitle)}">
  <meta name="twitter:description" content="${esc(site.ogDescription)}">
  <meta name="twitter:image" content="${site.ogImage}">
  <meta name="twitter:image:alt" content="${esc(site.ogImageAlt)}">
  <script type="application/ld+json">${JSON.stringify(ld)}</script>`;
}

// ---------------------------------------------------------------------------------------
// Shell: the bar, the world layer and the intro card
// ---------------------------------------------------------------------------------------

function bar(): string {
  return `<header class="bar">
  <a class="bar-name" href="#main" data-view-link="classic">${esc(person.name)}</a>
  <span class="bar-role">${esc(person.role)}</span>
  <div class="bar-tools">
    <button class="bar-button" type="button" data-view-toggle hidden aria-pressed="false">
      <span class="when-world">Classic view</span><span class="when-classic">Tabletop view</span>
    </button>
  </div>
</header>`;
}

function world(): string {
  // The canvas and the world's own overlays (labels, cards) are created at runtime.
  return `<div class="world-layer" id="world" data-world aria-hidden="true"></div>`;
}

function intro(): string {
  return `<section class="intro" id="intro" aria-label="Tabletop introduction" data-intro>
  <div class="intro-card">
    <h1 class="intro-name" id="intro-name">${esc(person.name)}</h1>
    <p class="intro-role">${esc(person.role)}. ${esc(person.focus)}</p>
    <p class="intro-thesis">${esc(person.thesis.join(' '))}</p>
    <p class="intro-what">This table is the system around a language model. The marble is one request. Follow it through retrieval, inference, tools and evaluation, one stop at a time.</p>
    <div class="intro-actions">
      <button class="btn btn-primary" type="button" data-enter disabled><span data-enter-label>Loading the table</span></button>
      <a class="btn" href="#main" data-view-link="classic">Classic view</a>
    </div>
    <progress class="intro-progress" max="100" value="0" aria-label="Loading the tabletop" data-progress></progress>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------------------
// Classic view
// ---------------------------------------------------------------------------------------

function classicHero(): string {
  const receipts = proof
    .map(
      (p) => `<li><span class="figure">${esc(p.figure)}</span> <span>${esc(p.text)} <a href="${p.href}">${esc(p.linkText)}</a></span></li>`,
    )
    .join('');
  return `<section class="c-hero" aria-labelledby="c-name">
    <h2 class="c-name" id="c-name">${esc(person.name)}</h2>
    <p class="c-role"><strong>${esc(person.role)}.</strong> ${esc(person.focus)} ${esc(person.languages)}</p>
    <p class="c-thesis">${esc(person.thesis.join(' '))}</p>
    <p class="c-lede">${esc(person.lede)}</p>
    <ul class="c-actions">
      <li><a class="btn btn-primary" href="${mailto}">${esc(contact.emailCta)}</a></li>
      <li><a class="btn" href="${person.links.linkedin}" rel="me">LinkedIn</a></li>
      <li><a class="btn" href="${person.links.github}" rel="me">GitHub</a></li>
    </ul>
    <p class="c-open">${esc(person.openTo)} ${esc(person.building)}</p>
    <ul class="c-proof" aria-label="Proof, with denominators">${receipts}</ul>
  </section>`;
}

function work(): string {
  const results = plandesk.results.map((r) => `<li><span class="figure">${esc(r.figure)}</span> ${esc(r.text)}</li>`).join('');
  const points = plandesk.points.map((s) => `<li>${esc(s)}</li>`).join('');
  const exchanges = plandesk.examples
    .map(
      (e) => `<div class="exchange${e.quote ? '' : ' is-refusal'}">
        <p class="ex-q"><span class="who">Question</span> ${esc(e.question)}</p>
        <p class="ex-a"><span class="who">Answer</span> ${esc(e.answer)}</p>
        ${e.quote ? `<blockquote class="ex-quote"><p><mark>${esc(e.quote)}</mark></p></blockquote>` : ''}
        <p class="ex-meta"><span class="verdict">${esc(e.verdict)}</span> <span>${esc(e.source)}</span></p>
      </div>`,
    )
    .join('');
  const findings = lineages.findings.map((f) => `<li>${esc(f)}</li>`).join('');
  const td = turtledove.points.map((p) => `<li>${esc(p)}</li>`).join('');
  return `<section class="c-section" id="work" aria-labelledby="work-title">
  <h2 class="c-title" id="work-title">Selected work</h2>
  <article class="c-work" aria-labelledby="plandesk-title">
    <h3 id="plandesk-title"><a href="${plandesk.href}">${esc(plandesk.name)}</a> <span class="kind">${esc(plandesk.kind)}</span></h3>
    <p>${esc(plandesk.summary)}</p>
    <ul class="c-results">${results}</ul>
    <p class="muted">${esc(plandesk.contrast)}</p>
    <ul class="c-points">${points}</ul>
    <figure class="c-figure">${exchanges}<figcaption>${esc(plandesk.examplesNote)} <a href="${plandesk.examplesSource}">evals/results/full__gpt-5.4-mini.json</a></figcaption></figure>
  </article>
  <article class="c-work" aria-labelledby="lineages-title">
    <h3 id="lineages-title"><a href="${lineages.href}">${esc(lineages.name)}</a> <span class="kind">${esc(lineages.kind)}</span></h3>
    <p>${esc(lineages.summary)}</p>
    <ul class="c-points">${findings}</ul>
    <p class="muted">${esc(lineages.panelCaption)}</p>
    <p class="muted">${esc(lineages.status)} <a href="${lineages.paper}">Read the paper (PDF)</a></p>
  </article>
  <article class="c-work" aria-labelledby="turtledove-title">
    <h3 id="turtledove-title"><a href="${turtledove.href}">${esc(turtledove.name)}</a> <span class="kind">${esc(turtledove.kind)}</span></h3>
    <p>${esc(turtledove.summary)}</p>
    <ul class="c-points">${td}</ul>
    <p class="muted">${esc(turtledove.status)} <a href="${turtledove.href}">${esc(turtledove.hrefLabel)}</a></p>
  </article>
</section>`;
}

function handles(f: Failure): string {
  return `<li><strong>${esc(f.name)}.</strong> ${esc(f.caught)} <a href="${f.repo}">${esc(f.repoLabel)}</a>${esc(f.receipt.slice(f.receipt.indexOf(':')))}</li>`;
}

function labGroup(g: LabGroup): string {
  const layer = layers.find((l) => l.id === g.layer);
  const catches = failures.filter((f) => f.layer === g.layer);
  const labs = g.labs
    .map(
      (l) => `<li><a class="lab" href="${gh(l.repo)}">${esc(l.repo)}</a>${l.lang ? ` <span class="muted">(${l.lang})</span>` : ''}. ${esc(l.what)}${
        l.result ? ` <span class="result">${esc(l.result)}</span>` : ''
      }</li>`,
    )
    .join('');
  return `<section class="c-layer" id="layer-${g.layer}" aria-labelledby="layer-${g.layer}-title">
    <h3 id="layer-${g.layer}-title">${esc(g.title)} <span class="kind">${esc(layer ? layer.job : g.note)}</span></h3>
    ${catches.length ? `<ul class="c-handles">${catches.map(handles).join('')}</ul>` : ''}
    <ul class="c-labs">${labs}</ul>
  </section>`;
}

function labsSection(): string {
  return `<section class="c-section" id="labs" aria-labelledby="labs-title">
  <h2 class="c-title" id="labs-title">${esc(labsIntro.title)}</h2>
  <p class="c-intro">${esc(labsIntro.text)}</p>
  ${labGroups.map(labGroup).join('')}
</section>`;
}

function askSection(): string {
  const examples = ask.examples.map((q) => `<li><button class="chip" type="button" data-ask="${esc(q)}">${esc(q)}</button></li>`).join('');
  return `<section class="c-section" id="ask" aria-labelledby="ask-title">
  <h2 class="c-title" id="ask-title">${esc(ask.title)}</h2>
  <p class="c-intro">${esc(ask.text)}</p>
  <form class="ask-form" role="search" data-ask-form action="#ask">
    <label class="visually-hidden" for="ask-input">${esc(ask.label)}</label>
    <input class="ask-input" id="ask-input" name="q" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(ask.placeholder)}" disabled>
    <button class="btn" type="submit" disabled>Search</button>
  </form>
  <ul class="ask-examples" aria-label="Example questions">${examples}</ul>
  <div class="ask-results" data-ask-results aria-live="polite"></div>
  <noscript><p class="muted">This search runs in your browser, so it needs JavaScript.</p></noscript>
</section>`;
}

function pathSection(): string {
  const steps = [...path, ...(toggles.showDoctorate ? [doctorate] : [])]
    .sort((a, b) => Number(a.start) - Number(b.start))
    .map((s) => `<li><span class="years">${esc(s.years)}</span> <span class="org">${esc(s.org)}</span>${s.what ? ` <span class="what">${esc(s.what)}</span>` : ''}</li>`)
    .join('');
  return `<section class="c-section" id="path" aria-labelledby="path-title">
  <h2 class="c-title" id="path-title">The path so far</h2>
  <ol class="c-path">${steps}<li><span class="years">Now</span> <span class="org">${esc(turtledove.name)}</span> <span class="what">${esc(person.building)}</span></li></ol>
</section>`;
}

function contactSection(): string {
  const photo = toggles.showPhoto
    ? `<picture class="c-photo"><source srcset="./${person.photo.replace(/\.jpg$/, '.webp')}" type="image/webp"><img src="./${person.photo}" width="320" height="320" alt="${esc(person.photoAlt)}" loading="lazy" decoding="async"></picture>`
    : '';
  return `<section class="c-section c-contact" id="contact" aria-labelledby="contact-title">
  ${photo}
  <div>
    <h2 class="c-title" id="contact-title">${esc(contact.title)}</h2>
    <p>${esc(contact.text)} ${esc(person.openTo)}</p>
    <p class="c-email"><a href="${mailto}">${esc(person.email)}</a></p>
    <ul class="c-actions">
      <li><a class="btn btn-primary" href="${mailto}">${esc(contact.emailCta)}</a></li>
      <li><a class="btn" href="${person.links.linkedin}" rel="me">${esc(contact.linkedinCta)}</a></li>
      <li><a class="btn" href="${person.links.github}" rel="me">${esc(contact.githubCta)}</a></li>
    </ul>
  </div>
</section>`;
}

function classic(): string {
  return `<main class="classic" id="main" tabindex="-1">
  ${classicHero()}
  <nav class="c-nav" aria-label="Sections"><ul><li><a href="#work">Work</a></li><li><a href="#labs">Labs</a></li><li><a href="#ask">Ask</a></li><li><a href="#path">Path</a></li><li><a href="#contact">Contact</a></li></ul></nav>
  ${work()}
  ${labsSection()}
  ${askSection()}
  ${pathSection()}
  ${contactSection()}
  <footer class="c-footer"><p>© 2026 ${esc(person.name)}. ${esc(footer.colophon)} Updated <time datetime="${site.updated}">${esc(site.updatedLabel)}</time>.</p></footer>
</main>`;
}

export function renderBody(): string {
  return `<a class="skip" href="#main" data-view-link="classic">Skip to the classic view</a>
${bar()}
${world()}
${intro()}
${classic()}
<div class="visually-hidden" data-live aria-live="polite"></div>`;
}

export function render404(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not found – ${esc(person.name)}</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/404.css">
</head>
<body>
<main>
  <p class="code">404</p>
  <h1>There is no page at this address.</h1>
  <p>The link may be out of date, or mistyped.</p>
  <p><a href="/">Go to ${esc(person.name)}’s home page</a></p>
</main>
</body>
</html>
`;
}
