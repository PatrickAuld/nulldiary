# Launch-day runbook

Working document. Check items as you do them. Each step links the exact
command, file, address, or URL you need.

The plan this mirrors is in `docs/superpowers/specs/2026-05-08-gtm-plan-design.md`,
section 3 (Launch week playbook).

## Day 0 — Monday evening

- [ ] Final read-through of the seed corpus in admin. Re-deny anything that
      has softened. URL: `https://admin.nulldiary.io/messages?status=approved`
- [ ] Pick the four featured messages for the essay. Save URLs.
- [ ] Schedule the essay to publish at ~7am ET Tuesday.
      Path: wherever your Substack/personal-blog draft lives.
- [ ] Open each cold email template, fill `{{recipient_name}}`,
      `{{quoted_message}}`, `{{essay_link}}`, save as a draft (do NOT send):
  - [ ] `ops/launch/templates/email-naive-weekly.md` → kristoffer@naiveweekly.com (verify)
  - [ ] `ops/launch/templates/email-web-curios.md` → web.curios@imperica.com (verify)
  - [ ] `ops/launch/templates/email-garbage-day.md` → tips@garbageday.email (verify)
  - [ ] `ops/launch/templates/email-today-in-tabs.md` → rusty@todayintabs.com (verify)
  - [ ] `ops/launch/templates/email-dirt.md` → tips@dirt.fyi (verify)
  - [ ] `ops/launch/templates/email-wildcard.md` → wildcard recipient
- [ ] Open aggregator templates and pre-fill what is fillable:
  - [ ] `ops/launch/templates/hn-show-post.md` (essay link)
  - [ ] `ops/launch/templates/metafilter-post.md` (quoted message + essay link)
  - [ ] `ops/launch/templates/reddit-internetisbeautiful.md` (essay link)
  - [ ] `ops/launch/templates/arena-blurb.md`
- [ ] Confirm MetaFilter account is past cooldown and can post.
      Visit: https://www.metafilter.com/post.cfm
- [ ] Confirm referrer logging is live (spot-check `ingestion_events` rows).
- [ ] Run `pnpm seed:smoke` against production to confirm ingestion is healthy.
      Command: `pnpm seed:smoke` (from repo root)
- [ ] Clear tomorrow's calendar.
- [ ] Set Google Alerts for `nulldiary.io` and `"nulldiary"` if not already.
      URL: https://www.google.com/alerts

## Day 1 — Tuesday

### ~7:00 ET — Essay live

- [ ] Confirm scheduled essay is published. Open the URL in incognito.
- [ ] One post from your personal account: one line + the link. No thread.

### ~8:00 ET — Curator emails (30-minute window)

Send all six in sequence. Do not edit on the fly; you wrote them yesterday.

- [ ] Send `email-naive-weekly.md`
- [ ] Send `email-web-curios.md`
- [ ] Send `email-garbage-day.md`
- [ ] Send `email-today-in-tabs.md`
- [ ] Send `email-dirt.md`
- [ ] Send `email-wildcard.md`

### ~9:00 ET — Aggregators

In this order, with ~15 minutes between each so signals don't tangle.

- [ ] **MetaFilter** — paste body from `metafilter-post.md`.
      URL: https://www.metafilter.com/post.cfm
- [ ] **Are.na** — add nulldiary.io to a public channel using `arena-blurb.md`.
      URL: https://www.are.na
- [ ] **r/InternetIsBeautiful** — submit using `reddit-internetisbeautiful.md`.
      URL: https://www.reddit.com/r/InternetIsBeautiful/submit
- [ ] **Hacker News** — submit using `hn-show-post.md`. Title exactly as in
      the template.
      URL: https://news.ycombinator.com/submit
- [ ] **Submit only once.** If HN does not catch the front page in 90 minutes,
      leave it. Do not resubmit. Do not ask anyone to upvote.

### All day — Watch and respond

- [ ] Keep HN comments tab open. Reply to substantive questions. Do not
      argue with stunt accusations.
- [ ] Keep MetaFilter thread tab open.
- [ ] Refresh referrer log every ~30 min (SQL: `select host, count(*) from ingestion_events ... group by 1 order by 2 desc limit 20;`).
- [ ] Approve interesting incoming submissions same-day so the feed is
      visibly alive. URL: `https://admin.nulldiary.io/messages?status=pending`
- [ ] Reply to any press inquiry within the hour, personally. No PR voice.

## Day 2 — Wednesday

- [ ] Watch for curator pickups. Wed/Thu/Fri are common publication days.
- [ ] If something is gaining traction: do nothing different. Do not pile on.
- [ ] If nothing is happening: do not panic-pivot. Continue moderating
      submissions.
- [ ] Reply to any new press inquiries same-day.

## Day 3 — Thursday

- [ ] Continue same-day moderation.
- [ ] Continue same-day press replies.
- [ ] Quick scan of Bluesky and Mastodon for `nulldiary.io` mentions.

## Day 4 — Friday

- [ ] Decide: do we send the second-tier follow-up wave?
  - Skip if Tuesday's batch is already moving.
  - Send only if the launch has been quiet (~4 newsletters not hit Tuesday).
- [ ] If sending: copy `email-wildcard.md` for each, fill, send within a
      30-minute window.
- [ ] Continue same-day moderation.

## Day 5 — Saturday/Sunday wrap

- [ ] Capture what you saw: write a short note (no template — half a page in
      a journal entry) on what the first 5 days felt like. This is the
      raw material for the 30-day retro at `ops/retro-template.md` (Layer 4.3).
- [ ] Decide whether a 2-3-week follow-on essay is warranted (per GTM plan
      §4). Only write it if there was real pickup.
- [ ] Move outreach tracker (`ops/launch/outreach.md`, Layer 2.4) into
      "ongoing follow-up" mode.

## Rollback / panic items

- [ ] If submission rate spikes >10× baseline with low approval rate: turn
      on the IP denylist abuse path. Path: `apps/admin` denylist UI.
- [ ] If ingestion endpoint 5xxs: check Vercel logs. The endpoint is at
      `apps/public/src/app/s/[...path]/route.ts`.
- [ ] If you forgot to schedule the essay: post it manually at ~7am ET. Send
      the curator emails 30 minutes later, not at the planned 8am ET — the
      essay needs to be reachable when they click through.
