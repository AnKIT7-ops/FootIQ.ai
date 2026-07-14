---
name: FootIQ
description: Floodlit-night football intelligence — emerald states the fact, amber admits the guess.
colors:
  pitch-emerald: "#10b981"
  pitch-emerald-ink: "#5eead4"
  pitch-emerald-deep: "#059669"
  signal-amber: "#fbbf24"
  signal-amber-ink: "#fcd34d"
  live-emerald: "#34d399"
  bad-rose: "#fb7185"
  night-bg: "#0a0e16"
  night-bg-deep: "#060910"
  surface: "#10151e"
  surface-2: "#161d29"
  surface-3: "#1d2533"
  ink: "#eef2f8"
  ink-2: "#9aa7ba"
  ink-3: "#7c8ca5"
  pitch-turf: "#0d1a17"
  chart-1: "#10b981"
  chart-2: "#38bdf8"
  chart-3: "#fbbf24"
  chart-4: "#a78bfa"
  chart-5: "#fb7185"
typography:
  display:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 118"
  headline:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Instrument Sans Variable, Instrument Sans, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Instrument Sans Variable, Instrument Sans, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.14em"
  data:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: "tabular-nums"
rounded:
  sm: "6px"
  md: "12px"
  lg: "16px"
  card: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.pitch-emerald}"
    textColor: "#04110c"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.pitch-emerald}"
    textColor: "#04110c"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px"
  card-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
    height: "48px"
  tab-active:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  tab-inactive:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  badge-fact:
    backgroundColor: "rgba(16, 185, 129, 0.12)"
    textColor: "{colors.pitch-emerald-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  badge-iq:
    backgroundColor: "rgba(251, 191, 36, 0.1)"
    textColor: "{colors.signal-amber-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  iq-insight:
    backgroundColor: "rgba(251, 191, 36, 0.1)"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  sidebar-nav-active:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: FootIQ

## 1. Overview

**Creative North Star: "The Floodlit Instrument"**

A precision tool used under stadium lights. The surfaces are deep indigo night (`#0a0e16`), the type is chalk-white, and the only colors that carry meaning are the two that state the product's integrity: emerald for what was measured, amber for what was inferred. Nothing else is allowed to be loud. The atmosphere is broadcast-night; the behavior is Linear — keyboard-first, dense, chrome that gets out of the way. The football is the drama, so the interface refuses to compete with it.

Density is a feature. The audience is fluent — tactics nerds who already watch the match and can spot a lazy number — so a screen full of tabular figures is not clutter, it is the point. What must never happen is decoration: a glow that means nothing, a gradient that flatters nothing, a card that exists because there was space. Every element either reports a fact, admits an inference, or gets out of the way.

This system explicitly rejects the four families named in PRODUCT.md: **betting sites** (casino urgency, odds shouting, green-on-green), **generic AI SaaS** (purple gradients, glowing orbs, "AI-powered" hero copy, identical card grids), **legacy scores sites** (ad-choked tables, banner clutter, dated chrome), and **fantasy hype content** (clickbait framing, inflated numbers, thumbnail energy). If a screen could be mistaken for any of them, it is wrong regardless of how well it renders.

**Key Characteristics:**
- Dark by default (`#0a0e16`); light theme is a full peer, not an afterthought (`.light` on `<html>`).
- Two semantic accents and no third. Emerald = fact. Amber = inference.
- Flat surfaces, tonal layering, hairline borders. Shadows only on things that genuinely float.
- Mono for every number; tabular figures so columns never dance.
- Motion is state, never showmanship. 150–250 ms, spring on touch.

## 2. Colors

Floodlit night: a cold indigo stage lit by two disciplined signals, one green, one gold.

### Primary
- **Pitch Emerald** (`#10b981`): the color of measured fact. Live scores, real stats, primary buttons, the active-nav rail, verified-source dots. It is the grass and it is the truth. Its lighter partner **Pitch Emerald Ink** (`#5eead4`) carries emerald text on dark surfaces where the raw hue would fail contrast; **Live Emerald** (`#34d399`) is reserved for the pulsing live-match dot.

### Secondary
- **Signal Amber** (`#fbbf24`): the color of model inference — the AI raising its hand. Every `IQInsight`, `IQTag`, confidence score, prediction, and generated article wears it. **Signal Amber Ink** (`#fcd34d`) carries amber text. Amber is never used for a measured value, and emerald is never used for a guess. This is the product's honesty rule expressed as pigment.

### Tertiary
- **Chart palette** (`#10b981`, `#38bdf8`, `#fbbf24`, `#a78bfa`, `#fb7185`): five categorical series, validated for colorblind separation and contrast on both the dark (`#11161f`) and light (`#f7f6f3`) surfaces, each with a `-deep` fill step for marks. Used only inside data visualization. Sky, violet and rose exist nowhere else in the UI.
- **Bad Rose** (`#fb7185`): losses, errors, negative deltas. Never decorative.

### Neutral
- **Night** (`#0a0e16`) and **Night Deep** (`#060910`): the page and the void behind it.
- **Surface / Surface-2 / Surface-3** (`#10151e` / `#161d29` / `#1d2533`): the three-step tonal ladder that does all the work shadows would otherwise do — cards, panels, toolbars, selected states.
- **Ink / Ink-2 / Ink-3** (`#eef2f8` / `#9aa7ba` / `#7c8ca5`): body, secondary, and tertiary text. Ink-3 is for mono labels and disabled states only; it never carries prose. It is tuned to exactly 4.51:1 against `surface-3`, the darkest surface it ever lands on — it is as quiet as WCAG AA permits and not one step quieter.
- **Pitch Turf** (`#0d1a17`) with a translucent mint line color: the pitch, heatmap and shot-map canvases.
- **Line / Line-strong** (white at 8% / 16%): hairlines. All of them. Every card border in the product is one of these two.

Light theme mirrors every role with darkened accents (`#059669` emerald, `#d97706` amber) on a warm-neutral stage (`#f2f3ef`) — the semantics are identical, only the luminance flips.

### Named Rules

**The Two-Signal Rule.** Emerald and amber are the only colors permitted to carry meaning. If a new color is needed to make a screen work, the screen is wrong. Anything not fact and not inference is a neutral.

**The Honesty Rule.** Amber may never dress a measured number, and emerald may never dress a model output. A single violation costs more trust than a hundred polished screens buy.

## 3. Typography

**Display Font:** Archivo Variable (with Archivo, system-ui) — set at width axis `118`, uppercase, `-0.01em`
**Body Font:** Instrument Sans Variable (with Instrument Sans, system-ui)
**Label/Data Font:** IBM Plex Mono (with ui-monospace)

**Character:** Archivo expanded and uppercase is the broadcast lower-third — a scoreboard voice used only for headings. Instrument Sans is the analyst talking: plain, legible, unhurried. IBM Plex Mono is the instrument readout, and it holds every number in the product so figures stay in their columns.

### The scale

Every size below 18px is one of six steps, defined once in `global.css` under `@theme` and used as a Tailwind utility. There are no arbitrary sizes; a literal `text-[13.5px]` in a diff is a defect, not a decision.

| Step | Size | Line height | Job |
|---|---|---|---|
| `text-micro` | 10px | 1.3 | Mono badge text, dense table labels, tag chips |
| `text-label` | 11px | 1.35 | The `.eyebrow` utility — metadata, timestamps, kickers |
| `text-caption` | 12px | 1.4 | Secondary data, captions, chart axis labels |
| `text-ui` | 13px | 1.45 | Controls, nav, buttons, list rows — the workhorse |
| `text-body` | 14px | 1.5 | Secondary prose, dense body copy |
| `text-prose` | 15px | 1.6 | Body default; matches `<body>` |
| `text-figure` | 28px | 1.05 | The one exception: the headline tabular stat on `StatTile` |

Headings at 18px and up use Tailwind's named steps (`text-lg` / `xl` / `2xl` / `3xl`). Explicit `leading-*` classes still override the paired line height.

### Hierarchy
- **Display** (700, `text-2xl`, `wdth 118`, uppercase, -0.01em): page titles and section headers via `.display`. Fixed rem, never fluid — this is product UI and a heading that shrinks in a sidebar looks broken, not responsive.
- **Headline** (700, `text-xl`): card and panel titles.
- **Title** (600, `text-prose`): row headings, player names, list leads.
- **Body** (400, `text-prose`): all prose. Article and long-form text caps at 65–75ch (`Prose`).
- **Label** (mono, 500, `text-label`, `0.14em`, uppercase): the `.eyebrow` utility — metadata, section kickers, timestamps, badge text.
- **Data** (mono, 500, `text-ui`, tabular-nums): every score, stat, percentage, xG value, market fee.

### Named Rules

**The Ramp Rule.** Six steps below 18px, and nothing else. If a design seems to need 13.5px, it needs 13px or 14px — the half-pixel is you avoiding a decision. Reach for an arbitrary value and you are re-opening the 345-literal-size drift this system was built to close.

**The Mono-Numbers Rule.** Every number a user might compare — score, rating, xG, confidence, price — is set in IBM Plex Mono with `tabular-nums`. Proportional digits in a data column are a bug.

**The Eyebrow Budget Rule.** `.eyebrow` is metadata, not scaffolding. It labels a datum (`LIVE · 67'`, `CONFIDENCE`, `UPDATED 2H AGO`). Stamping a tracked-uppercase kicker above every section is the AI-landing-page tell and is forbidden here.

**The Display-Stays-Out Rule.** Archivo never appears in a button, a label, an input, a table cell, or a chart. It is for headings. Product UI is set in Instrument Sans and Plex Mono.

## 4. Elevation

This system is flat **in the page**. There are no box-shadows on cards, panels, tabs, crests, or the sidebar. Depth is built from a three-step tonal ladder — `surface` (#10151e) for resting cards, `surface-2` (#161d29) for the layer above (toolbars, tab tracks, hover fills), `surface-3` (#1d2533) for the top layer (selected tabs, active nav, chips) — plus 1px hairlines at 8% and 16% white. A thing that is "higher" is lighter and more sharply outlined, never darker underneath.

The exception is anything that genuinely **floats above** the page and can overlap arbitrary content: the command palette, the chat dock, the notification popover, the mobile nav bar, the onboarding panel, and chart tooltips. Those cast `shadow-2xl` (`xl` for tooltips), because a floating layer with no shadow reads as a rendering bug, not as restraint. The test is literal, not aesthetic: does it sit *on* the page, or *over* it?

The `--glow-accent` / `--glow-iq` tokens exist for one job only: making a live emerald pulse or an AI block read as *lit* on a night surface. They are lighting, not elevation, and they are used sparingly.

**Audit test:** if a surface reads as raised when the page is greyscaled and blurred, something is casting a shadow it should not.

### Named Rules

**The Float-Or-Flat Rule.** If an element sits *on* the page, it gets tone and hairline and no shadow. If it floats *over* the page and can overlap anything (palette, dock, popover, mobile nav, tooltip), it casts `shadow-2xl`. There is no third category, and "it looks nicer with a shadow" is not one.

**The Stacking Ladder.** `z-10` in-card overlays · `z-20` chart tooltips and board tokens · `z-30` sticky chrome · `z-40` docked panels · `z-50` modals and the command palette · `z-skip` the skip link, which must clear all of it. Named steps only; an arbitrary `z-[9999]` means the ladder was never read.

**The Glass Rule.** The `glass` utility (blur + saturate) is permitted on exactly two things: the sticky top bar and the command palette, where content genuinely scrolls beneath. Decorative glass cards are forbidden — that is generic AI SaaS, an explicit anti-reference.

## 5. Components

Tactile and confident. Controls answer immediately — a spring on press, a lift on hover, a color that lands on the first frame — but they never perform. You should feel you can grab them; you should never wait for them.

### Buttons
- **Shape:** fully rounded pill (999px). Uniform across the product.
- **Primary:** Pitch Emerald fill with near-black text (`#04110c`) for AA contrast, 600 weight, 13px, `10px 20px` padding. Used for the single most important action on a screen.
- **Hover / Focus / Active:** `scale(1.03)` on hover, `scale(0.95)` on press, transform-only so nothing reflows. Focus is the global 2px emerald `:focus-visible` ring at 2px offset. Disabled drops to 60% opacity with `not-allowed`.
- **Ghost / Icon:** transparent, Ink-2 text, hover fills to `surface-2`. Icon buttons are square-ish with `rounded-md` and a 16px Lucide glyph. Never two primaries on one screen.

### Chips / Badges
- **Style:** pill, mono uppercase 11px, tinted fill at ~10–12% of the semantic hue with the matching `-ink` text color. Variants: `accent`/`live`/`good` (emerald), `iq`/`warn` (amber), `bad` (rose at 10%), `neutral` (surface-3), `outline` (hairline only).
- **State:** the `live` variant carries a 6px emerald dot running `pulse-live` (2.2s, box-shadow ring, reduced-motion safe).

### Cards / Containers
- **Corner Style:** 20px (`1.25rem`) — the largest radius in the system, and what makes a card a card.
- **Background:** `surface`. **Border:** 1px `line`. **Shadow:** none, per the No-Shadow Rule.
- **Hover (interactive only):** lifts 3px on a spring (stiffness 420, damping 28), border brightens to `line-strong`, press dips to `scale(0.985)`. Clickable cards get `role="button"`, `tabIndex`, and Enter/Space activation — never a click-only div.
- **Internal Padding:** 16px, 20px on desktop for content-heavy cards.
- **Never nest cards.** A card inside a card means the hierarchy is wrong; use a tonal step or a hairline divider.

### Inputs / Fields
- **Style:** `surface` fill, 1px `line` border, 16px radius (12px for compact inline fields, e.g. the chat dock), 48px tall for search, Ink placeholder at Ink-3.
- **Focus:** border shifts to Pitch Emerald (`focus:border-accent`); the AI chat input shifts to Signal Amber instead, because what you are talking to is a model. `outline: none` on the field is paired with the border shift — never removed without a replacement.
- **Error:** rose border and a mono error line beneath. **Disabled:** 60% opacity.

### Navigation
- **Sidebar:** 13.5px medium, Ink-3 at rest, Ink when active. The active item gets a `surface-3` fill that slides between items via a shared `layoutId` spring (stiffness 480, damping 38), an emerald-tinted icon, and a 2px emerald rail at its left edge. Hover fills `surface-2`.
- **Tabs:** pill segmented control on a `surface-2` track; the active pill is a `surface-3` fill that animates between tabs (`layoutId`, stiffness 500). Full roving-tabindex arrow-key navigation, `role="tablist"`.
- **Mobile:** the sidebar collapses to a bottom nav bar; the top bar keeps search, notifications, provenance chip and theme toggle.

### IQInsight (signature component)
The amber block is the product's conscience made visible. A `rounded-2xl` panel with a 25%-amber border, 10%-amber fill, one blurred amber orb bleeding from the top-right corner (the *only* sanctioned decorative blur in the system), a mono `SPARKLES · FOOTIQ INSIGHT` label in Signal Amber Ink, and the inference itself in Ink. Substantial blocks carry a 👍/👎 `FeedbackWidget` behind a hairline. Every AI-derived statement in the product renders inside one of these, or wears an `IQTag` — no exceptions, no unlabeled model output anywhere.

## 6. Do's and Don'ts

### Do:
- **Do** wear amber on every model output, always with confidence, generation date and source links (`AIMeta`). The user must never have to guess what was measured and what was inferred.
- **Do** pick every size below 18px from the six-step ramp (`text-micro` / `label` / `caption` / `ui` / `body` / `prose`). An arbitrary `text-[Npx]` is a defect.
- **Do** set every comparable number in IBM Plex Mono with `tabular-nums`.
- **Do** build depth from the tonal ladder (`#10151e` → `#161d29` → `#1d2533`) and 1px hairlines.
- **Do** keep transitions at 150–250ms and springs on press. Motion states a change; it never announces one.
- **Do** ship every interactive component with default, hover, focus-visible, active, disabled — and skeletons, not centered spinners, for loading.
- **Do** honor `prefers-reduced-motion` (globally clamped to 0.01ms) and keep the command palette, skip link and focus ring working on keyboard alone.
- **Do** validate contrast on both themes: body text ≥4.5:1, large text ≥3:1. Ink-3 (`#5f6b7e`) is for mono labels, never prose.

### Don't:
- **Don't** build anything that could pass for a **betting site** — no odds-shouting, no casino urgency, no green-on-green. Predictions are stated with confidence intervals, never sold as tips.
- **Don't** reach for **generic AI SaaS** furniture: purple gradients, glowing orbs, "AI-powered" hero copy, decorative glassmorphism, identical icon-heading-text card grids.
- **Don't** drift toward **legacy scores sites** (ESPN, Livescore): ad-shaped slots, banner clutter, dense grey chrome.
- **Don't** adopt **fantasy hype** language or graphics — no clickbait arrows, no inflated numbers, no thumbnail energy.
- **Don't** use `background-clip: text` with a gradient. Emphasis is weight and size; color is meaning.
- **Don't** use a colored `border-left`/`border-right` above 1px as an accent stripe on cards, alerts or list items. (The 2px emerald rail on the active sidebar item is an active-state indicator, not a decorative stripe — do not generalize it.)
- **Don't** add a box-shadow to anything that sits *on* the page. Only genuinely floating layers cast (see the Float-Or-Flat Rule).
- **Don't** put Archivo in a button, input, label, table cell or chart.
- **Don't** stamp a tracked-uppercase eyebrow above every section. It labels data; it is not page scaffolding.
- **Don't** nest a card inside a card.
- **Don't** reach for a modal first. Exhaust inline and progressive alternatives — this product is a workspace, not a wizard.
