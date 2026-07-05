# GTM audit — `{STORE_NAME}`

**Status:** `Draft` | `Blocked on client` | `Resolved`  
**Store:** `{store-domain}` (e.g. `example.com`)  
**Theme repo:** `{repo-name}`  
**Last audited:** `YYYY-MM-DD` by `{auditor}`

> **Policy:** Do not disable, merge, defer, or consent-gate GTM containers in theme code until `{STORE_NAME}` / marketing confirms. Theme perf work (CSS, JS, images, preloads) is safe and unrelated.

---

## 1. How to audit (run once per store)

### Theme git

```bash
rg -i "GTM-|googletagmanager|dataLayer" --glob '*.{liquid,js,json}'
```

Check: `snippets/_head-script.liquid`, `layout/theme.liquid`, `snippets/lucrative-datalayer.liquid`, app embed references.

### View-source (initial HTML)

- Search for `GTM-`, `googletagmanager.com/gtm.js`
- Note: Customer Events / app pixels often inject **after** first paint — view-source alone is incomplete

### Chrome DevTools → Network

Filter: `gtm.js`, `googletagmanager`

- Count how many distinct container IDs load
- Note trigger: sync in `<head>`, `window.load`, interaction, consent callback
- Check for **double bootstrap** (same `GTM-XXXX` from theme **and** Shopify admin)

### Shopify Admin

- **Settings → Customer events → Custom pixels** — list all pixels, note naming (`aenoah_…`, etc.)
- **Settings → Apps and sales channels** — Consentmo, Clarity embed, Klaviyo, etc.
- **Online Store → Themes → … → Edit code** — only if theme inject differs from git

### Document

Copy this file to the theme repo as `docs/gtm-audit-{store-slug}.md` and fill §2–§5.

---

## 2. Container inventory

| Container ID | Source | Load trigger | Tags / purpose (known) | In theme git? | Notes |
|--------------|--------|--------------|------------------------|---------------|-------|
| `GTM-_______` | Theme `_head-script.liquid` | `window.load` | | Yes / No | |
| `GTM-_______` | Customer Events custom pixel | Runtime | Ads, GA4, Meta, … | No | |
| `GTM-_______` | App embed / other | | | | |
| `GTM-_______` | **Not found** | — | Mentioned in client docs only | — | |

### dataLayer-only (does not load GTM)

| Snippet / script | Role |
|------------------|------|
| `snippets/lucrative-datalayer.liquid` | Pushes `ecommerce.*` events to `dataLayer` |
| | |

### Elevar / other suites

| Product | Used on this store? | Notes |
|---------|---------------------|-------|
| Elevar | Yes / No | II uses Elevar; many stores do not |
| | | |

---

## 3. Duplicate / conflict watchlist

| Issue | Observed? | Evidence |
|-------|-----------|----------|
| Same GTM ID loaded twice (theme + CE) | Yes / No / Unknown | |
| Clarity: app embed **and** GTM tag | Yes / No | |
| Meta Pixel: app **and** GTM | Yes / No | |
| Consentmo + GTM race before consent | Yes / No | |
| Container ID in client docs but not on storefront | Yes / No | e.g. legacy / wrong workspace |

---

## 4. Questions for `{STORE_NAME}` / marketing

1. **Container ownership** — Who maintains each `GTM-*` workspace? Which is source of truth for Ads / GA4 / Meta?
2. **Theme vs Customer Events** — If the same ID appears in both, why? Can one be removed?
3. **Tag overlap** — Which tags exist only in container A vs B?
4. **Consent** — Who publishes GTM? Who runs Consentmo Integration Scanner?
5. **Deduping** — If Clarity / pixels fire twice, which integration should stay?
6. **IDs not on storefront** — Any container IDs in internal docs that should be ignored or migrated?

---

## 5. Safe theme perf work (no GTM impact)

These do **not** require marketing approval:

- LCP preloads, critical CSS, JS bundle split
- Image `cols` sizing, woff2 fonts
- Resource blocker for Typekit / Google Fonts / duplicate font CDNs
- Defer non-marketing widgets (Trusted Shops, find-your-car, related-products)
- `performance-guide.mdc` architecture

---

## 6. After client responds

- [ ] Update §2 inventory with confirmed ownership
- [ ] Set status to `Resolved` or keep `Blocked` with reason
- [ ] Optional (marketing-led): consolidate containers, consent-gate heavy tags, remove theme duplicate bootstrap
- [ ] Re-run Network audit after any GTM change
- [ ] Link resolved doc in `performance-guide.mdc` §12 per-store annex

---

## 7. Example (Voldt — reference only)

| Container | Source | Notes |
|-----------|--------|-------|
| `GTM-WKTHL9SP` | Customer Events (`aenoah_…`) | Main marketing stack |
| `GTM-TJQ9XSG6` | Theme `window.load` + possibly CE | Possible double load |
| `GTM-TT4R3ZC8` | Not found on storefront | |

Full store doc: `voldt/docs/gtm-audit-voldt.md`

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| YYYY-MM-DD | | Initial audit |
