# pavanmogili.com

Pavan Reddy Mogili's personal site: a tabletop architect's model of the system around a
language model. One marble, a request, rolls through it stop by stop. A complete classic HTML
view is always one click away. It is static and client-side only: no server, no trackers, no third-party requests.

- **Tabletop view.** three.js (WebGL 2), no physics engine and no WebAssembly. The marble
  follows a lane through five parts of an LLM system: Retrieval, Inference, Agents and tools,
  Evaluation and Product. Next, the arrow keys, the wheel or a drag move it; its speed is
  capped and the camera keeps one heading. At each of the 23 stops a mechanism shows the
  idea, and a panel of ordinary HTML text (16px or larger) explains it, names what Pavan
  built for it, and gives the real number with its caveat.
- **Classic view.** Plain, fast, accessible HTML with everything a recruiter needs. It is the
  SEO surface and what visitors get with JavaScript off, without WebGL 2, or with reduced
  motion. It also includes a search over the project READMEs that answers only with verbatim
  quotes.

See `ARCHITECTURE.md` for how the code fits together.

## Run it

Requires Node 22 and npm 10.

```bash
npm ci
npm run dev          # http://127.0.0.1:5174 (add ?view=world or ?view=classic)
npm run build        # writes dist/ and checks the byte and content budgets
npm run serve        # serves dist/ with the production headers from public/_headers
npm run check        # build + html-validate + headless browser tests (the gate)
```

Useful query flags: `?view=world` or `?view=classic` forces a view, `?perf` shows the
performance HUD, `?test` exposes `window.__world` for scripts, and `#at=<exhibit>` opens the
tabletop at an exhibit (for example `#at=plandesk`).

## Edit the content

Every word, number and link lives in **`src/content.ts`**. The build renders it into the
static HTML for the classic view, and the tabletop's cards read the same records.

- Change text there, then run `npm run build`. The content lint fails the build if a number
  loses its caveat or a forbidden claim slips in.
- The doctoral program is behind a one-line toggle: `toggles.showDoctorate` (off).
- The portrait is behind `toggles.showPhoto` (on), using the public GitHub avatar.
- "Ask my work" searches `sources/readmes/*.md`. Refresh those with
  `gh api repos/pavan139/<repo>/readme --jq .content | base64 -d > sources/readmes/<repo>.md`,
  then rebuild. Claims that did not reproduce are excluded in `scripts/build-corpus.mjs`.

## Deploy to Cloudflare Pages

The domain's DNS is already on Cloudflare (nameservers `bart`/`fish.ns.cloudflare.com`).

1. Put this folder in a Git repository: GitHub, private is fine.
2. In Cloudflare, go to **Workers & Pages → Create → Pages → Connect to Git** and pick the
   repository.
3. Build settings:
   - Framework preset: **None**
   - Build command: **`npm run build`**
   - Build output directory: **`dist`**
   - Environment variable: **`NODE_VERSION = 22`**
4. Deploy. Pages serves `dist/_headers`, which sets:
   - the Content Security Policy;
   - long cache lifetimes for hashed assets.
   `dist/404.html` is the not-found page.
5. **Custom domain.** In the project's **Custom domains** tab, add `pavanmogili.com` and then
   `www.pavanmogili.com`.
   - Delete the broken `www` record first; it currently points at a host that no longer
     exists (error 1016). Cloudflare then creates the records it needs.
   - **Keep the existing iCloud Mail MX records and the TXT records** (`apple-domain`, SPF).
     Email for the domain depends on them. Do not delete or proxy them.
6. Add a Redirect Rule from `www.pavanmogili.com/*` to `https://pavanmogili.com/$1` (301),
   and turn on **Always Use HTTPS**.
7. Check that the apex loads, `www` redirects, and `http` upgrades to `https`.
8. After launch:
   - In Search Console, add a Domain property, submit `https://pavanmogili.com/sitemap.xml`
     and request indexing of `/`.
   - Refresh LinkedIn's cached preview with its Post Inspector.

If the site is ever served without the headers (for example a plain static host), it still
works; the headers only add security policy and caching.
