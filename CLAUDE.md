# FootIQ — Agent Notes

## Design Context

Before touching UI, read [`PRODUCT.md`](PRODUCT.md) (strategy) and [`DESIGN.md`](DESIGN.md) (visual system). Short version:

- **Register:** product (app UI). **Platform:** web. **Users:** serious fans / tactics nerds.
- **Positioning:** an AI football OS, not a scores site. Every screen infers, compares, explains or predicts — and says how confident it is.
- **The honesty rule (non-negotiable):** emerald `#10b981` = measured fact, amber `#fbbf24` = model inference. Every AI output renders inside `IQInsight` / `IQTag` with `AIMeta` (confidence, date, sources). Never dress a guess as a fact.
- **North Star:** "The Floodlit Instrument" — deep indigo night, chalk type, Linear-grade speed. Flat surfaces (tonal ladder, hairlines, **no shadows**), mono tabular numbers, motion conveys state only.
- **Anti-references:** betting sites · generic AI SaaS · legacy scores sites · fantasy hype content.
- **A11y bar:** WCAG 2.1 AA. Keyboard-complete, reduced-motion honored, charts colorblind-validated on both themes.

Verify UI work with `npm run verify` (route-wide screenshot + console-error + overflow sweep; needs `npm run dev` running).
