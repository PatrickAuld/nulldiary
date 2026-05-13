# Pre-launch checklist

Distinct from `runbook.md` (which is hour-by-hour, launch day forward). This
list works backwards from launch day. Tick items as you go. Any item that has
slipped two windows in a row should be a hard stop on the launch date.

References:

- GTM plan: [`docs/superpowers/specs/2026-05-08-gtm-plan-design.md`](../../docs/superpowers/specs/2026-05-08-gtm-plan-design.md)
- Tooling spec: [`docs/superpowers/specs/2026-05-08-gtm-tooling-design.md`](../../docs/superpowers/specs/2026-05-08-gtm-tooling-design.md)
- Launch-day runbook: [`runbook.md`](runbook.md)
- Outreach tracker: [`outreach.md`](outreach.md)

## T-3 weeks

- [ ] Skill v2.0 finalized and committed at [`packages/skill/SKILL.md`](../../packages/skill/SKILL.md).
- [ ] First seed batch generated against staging:
      `pnpm --filter @nulldiary/seed seed:smoke`, then a real batch via
      [`pnpm seed`](../../packages/seed/README.md).
- [ ] Regression report reviewed at `ops/seeds/logs/<batch>.md`. No model
      below the 80% `tool_call_ok` threshold without an explanation.
- [ ] Essay first draft. (Personal blog / Substack draft, not in-repo.)
- [ ] Confirm Vercel project on a plan that supports cron.
      If not, enable the GHA fallback in
      [`.github/workflows/daily-digest.yml`](../../.github/workflows/daily-digest.yml).
- [ ] `RESEND_API_KEY`, `DIGEST_TO_EMAIL`, `CRON_SECRET` set in Vercel for
      the admin app. See [`.env.example`](../../.env.example).
- [ ] Manually trigger `/api/cron/digest` once and confirm the email arrives.

## T-2 weeks

- [ ] Seed corpus reviewed via [`/admin/seed-review`](https://admin.nulldiary.io/seed-review)
      until 60-100 messages approved.
- [ ] Essay second draft.
- [ ] Per-message OG cards spot-checked: 5 random `/m/<id>` URLs in
      Twitter's card validator (https://cards-dev.twitter.com/validator)
      AND in https://opengraph.xyz/.
- [ ] MetaFilter account confirmed eligible (past cooldown, can post).
- [ ] Daily digest has been arriving every morning for at least three days.
      Anomaly flags review: nothing should be firing in steady state.
- [ ] Pre-fill outreach rows in [`outreach.md`](outreach.md) with the
      curators you've decided on (verify each address in the curator list
      independently — addresses in the cold-email templates are placeholders
      to confirm).

## T-1 week

- [ ] Curator list re-verified — every email address checked against the
      newsletter's current contact page or most recent issue.
- [ ] Cold email templates filled with real `{{recipient_name}}` and
      `{{essay_link}}` placeholders, saved as Gmail drafts (do NOT send).
      Templates: [`ops/launch/templates/`](templates/).
- [ ] Aggregator templates pre-filled where possible (HN, MetaFilter,
      r/InternetIsBeautiful, Are.na).
- [ ] [`runbook.md`](runbook.md) walked through end-to-end as a dry run.
      Time each section. If Day 1 morning takes >2h on paper, trim.
- [ ] Launch date locked. Notify nobody (anti-anti-climax: don't tell
      anyone, see GTM plan §4).
- [ ] Referrer logging confirmed working in production (spot-check
      `ingestion_events` rows have `headers.referer`).
- [ ] Google Alerts set for `nulldiary.io` and `"nulldiary"`.
- [ ] Calendar cleared for launch day.

## T-1 day

- [ ] Essay scheduled to publish at the launch slot.
- [ ] Final templates pass — re-read each cold email, last typo / tone
      check.
- [ ] Final seed-corpus pass: re-deny anything that has softened. Use
      [`/admin/messages?status=approved`](https://admin.nulldiary.io/messages?status=approved).
- [ ] Run `pnpm --filter @nulldiary/seed seed:smoke` against production to
      confirm ingestion is healthy.
- [ ] Outreach tracker [`outreach.md`](outreach.md) ready: every row has
      `Recipient`, `Channel`, and `Follow-up by` date set.
- [ ] Daily digest rendered correctly this morning (eyeball it).
- [ ] Inbox cleared so morning press replies aren't lost in a backlog.
- [ ] Phone notifications muted except mail.
