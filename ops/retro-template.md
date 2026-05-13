# Nulldiary monthly retrospective

A 20-minute write that catches drift. Fill in every section. If a section is "nothing to report," say so explicitly — the absence is itself a signal.

Companion docs:

- `docs/superpowers/specs/2026-05-08-gtm-plan-design.md` — tier definitions, post-launch posture
- `docs/superpowers/specs/2026-05-08-gtm-tooling-design.md` — tooling rationale

## Header

- **Retro date:** YYYY-MM-DD
- **Launch date:** YYYY-MM-DD
- **Days since launch:** N
- **Author:** Patrick Auld

## Tier outcome

The GTM plan defined three tiers in advance. Mark which one was actually reached, and how it differs from what was predicted at launch (if anything was predicted).

Tier reached this period:

- [ ] **Tier 1 — Real cultural pickup.** ≥2 of {Naive Weekly, Web Curios, Garbage Day, Today in Tabs, Dirt, MetaFilter front page, HN top 10} covered it within 14 days, OR a piece in The Verge / 404 Media / Wired Ideas / Atlantic / New Yorker–adjacent. Sustained submission flow.
- [ ] **Tier 2 — Solid niche pickup.** 1 curator newsletter feature, OR HN page-2 with a real comment thread, OR sustained organic submissions (>10/day) for at least a week.
- [ ] **Tier 3 — Cold-start failure to launch.** No curator hit; HN sank; submissions <2/day after week 1.
- [ ] **Other / not yet classifiable.** Describe.

Predicted vs. actual:

- Predicted at launch: …
- Actual: …
- Delta and why: …

## What worked

Bullet list of things that produced disproportionate value. Be specific — "the seeded llama batch" is more useful than "seeding."

- …
- …

## What didn't

Bullet list of things that consumed time without payoff, broke during the period, or actively misfired.

- …
- …

## Corpus quality assessment

- **Submission volume this period:** N total messages received.
- **Real vs. seeded ratio:** R real / S seeded (R/(R+S) = X%).
- **Approval rate:** A approved / N received = Y%. Flag if <5% (likely garbage flood) or >60% (likely too lenient).
- **Trend vs. last period:** up / flat / down by X%.
- **Surprising / notable submissions** (call out by short_id, with a one-line reason worth remembering — best-of-period candidates):
  - `xxxxxx` — …
  - `xxxxxx` — …
- **Pattern observations** — anything new in the corpus this month? New voice, new theme, new failure mode?

## Cost summary

Round to dollars; we're tracking order-of-magnitude, not pennies.

| Bucket                     | Cost this period | Notes |
| -------------------------- | ---------------- | ----- |
| Seeding API spend          | $                |       |
| Hosting (Vercel)           | $                |       |
| Database (Supabase)        | $                |       |
| Email / cron (Resend, etc) | $                |       |
| Domain renewal             | $                |       |
| Other                      | $                |       |
| **Total**                  | $                |       |

Cost per approved message: $X / N approved = $Y. Track over time to spot the "I'm spending $0.40 per approved message" failure mode.

## Decision

Pick exactly one. Each option has a one-line implication.

- [ ] **Continue at current cadence.** Implication: same operator load next 30 days. Same posture, same budget, same daily/weekly check-ins. Pick this if the corpus is healthy and the project is paying the operating cost it deserves.
- [ ] **Shift to slow-burn (Approach B from GTM plan).** Implication: drop daily check-ins to weekly; reduce seeding cadence; accept lower submission volume in exchange for ~zero ongoing operator load. The site keeps running as a quiet permanent object. Pick this after Tier 3, or after Tier 2 once the launch-week energy is gone.
- [ ] **Archive.** Implication: stop accepting submissions, freeze the public site as-is, retire the admin moderation cadence. The artifact becomes static. Pick this only after deliberate consideration — once archived, restarting requires a re-launch.

Reasoning for the chosen option (1-3 sentences, written for future-you):

…

## Action items for next 30 days

Concrete commitments, not aspirations. If an item depends on someone else, name them. If an item has a deadline, write it.

- [ ] …
- [ ] …
- [ ] …

Next retro scheduled for: YYYY-MM-DD
