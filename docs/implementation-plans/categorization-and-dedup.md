# Working plan: Categorization + similarity clustering (pgvector) for NullDiary

> This is a living document. We will update it as we implement features across many PRs.

## Problem

NullDiary can receive many messages that are identical or very similar (e.g., multiple LLMs generating the same confession). Moderation time scales poorly when duplicates flood the queue.

## Product goals

- Automatically group similar messages together.
- Moderation happens on **clusters** with a single **representative** (canonical) message.
- The public site shows **only** representatives that are **approved and curated/edited by a moderator**.
- A single moderation action (approve/deny) should apply to all members of the cluster.

## Non-goals (for now)

- No “LLM adjudication” stage (we are **ignoring Stage 4**).
- No complex merge/split UI at first (we can add later if needed).

## Definitions

- **Representative / canonical**: the one message shown publicly for a cluster.
- **Cluster**: a set of message IDs considered duplicates or near-duplicates.
- **Similarity score**: numeric measure that drives clustering decisions.

---

## Chosen strategy

We are going with:

- **Stage 1**: normalization + hashing
- **Stage 2**: exact match / cheap heuristics
- **Stage 3 (Option A)**: **embeddings + Postgres + pgvector** similarity search
- **Stage 3 is synchronous** in the ingestion pipeline

Rationale: simplest architecture (one DB) and the best coverage for paraphrases.

---

## Data model (proposed)

We want clustering to be explicit and auditable.

### `message_clusters`

- `id` (uuid)
- `representative_message_id` (uuid)
- `status` enum: `pending` | `approved` | `denied`
- `created_at`, `updated_at`
- `strategy` text: `hash` | `embedding`
- `threshold` float

### `message_cluster_members`

- `id` (uuid)
- `cluster_id` (uuid)
- `message_id` (uuid)
- `score` float (nullable)
- `created_at`

### `message_embeddings`

- `message_id` (uuid)
- `embedding` (vector)
- `model` (text)
- `created_at`

### On `messages`

We will need fields to support:

- clustering
- “public only shows curated representatives”

Proposed fields:

- `cluster_id` (uuid, nullable)
- `is_representative` (boolean) OR infer representative via `message_clusters.representative_message_id`
- `public_content` (text, nullable) — the moderator-curated/edited content that is safe for public display
  - public render uses `public_content` only
  - if `public_content` is null, the message should not show publicly even if approved

> Note: today we already have `edited_content`. We can either rename semantics or introduce `public_content` to make the intent unambiguous.

---

## Ingestion-time pipeline (synchronous)

### Inputs

- Raw message text

### Output

- A newly inserted message row (pending)
- A cluster assignment (existing cluster or a new one)
- An embedding row (for non-trivial messages)

### Step-by-step

1. **Normalize** message text (trim, collapse whitespace, unicode NFKC, etc.).
2. Compute `normalized_hash`.
3. **Exact dedup**:
   - Look up an existing message with same `normalized_hash`.
   - If found, attach to that message’s cluster (or create cluster if missing).
4. **Embedding (pgvector)**:
   - If no exact match, generate an embedding for normalized text.
   - Query for nearest neighbors in `message_embeddings` using pgvector.
   - If top match similarity >= threshold → attach to that cluster.
   - Else create a new cluster with this message as representative.
5. Persist:
   - insert `messages` (pending)
   - insert `message_embeddings`
   - insert/update cluster + membership

### Keeping it cheap + minimal

- Use one embeddings provider/model (e.g. OpenAI small embedding model) and store the model name.
- Do embeddings only when message length > a minimum threshold.
- Add a conservative similarity threshold to reduce false positives.
- Prefer _one_ DB roundtrip pattern:
  - insert message
  - compute embedding
  - nearest-neighbor query
  - cluster assignment

---

## How to run synchronous embeddings on Vercel (minimal plan)

We want a solution that works with serverless constraints but stays simple.

### Preferred approach: synchronous inside the ingestion route (no queue)

- Implement embedding generation + pgvector search **inside** the ingestion handler.
- If embedding provider call fails or times out:
  - still insert the message as `pending`
  - mark it as “unclustered”
  - a later backfill job can compute embedding

This is minimal infra: only Supabase Postgres + an embedding API.

### Simple reliability backstop: Vercel Cron (optional)

Add a Vercel Cron job (daily/hourly) that:

- finds recent pending messages missing embedding / cluster
- computes embeddings
- assigns clusters

This is still minimal (no external queue), and it protects us from transient embedding API issues.

### Avoid for now

- Dedicated queue systems (Upstash/QStash, custom workers) unless we need them.

---

## Moderation + public rendering rules

### Core rule

**Public only shows curated representatives**.

That means:

- A cluster must have a representative.
- Representative must be **approved**.
- Representative must have **curated/edited content** (e.g. `public_content` or existing `edited_content`).
- All non-representative members should never be shown publicly.

### Admin workflow (initial)

- Admin queue shows clusters.
- Admin can edit the representative’s public content.
- Approve/deny cluster:
  - Approve:
    - set representative `approved`
    - set other members `denied` as duplicates (or keep pending but hidden; decide in implementation)
  - Deny:
    - deny all members

---

## Milestones / tasks (working checklist)

### M1 — DB + pgvector foundations

- [ ] Enable pgvector extension in Supabase
- [ ] Add migrations for:
  - [ ] `message_clusters`
  - [ ] `message_cluster_members`
  - [ ] `message_embeddings` (vector column + index)
  - [ ] `messages.normalized_hash` + `messages.normalized_content` (optional)
  - [ ] `messages.cluster_id`
  - [ ] `messages.public_content` (or clarify `edited_content` semantics)
- [ ] Add indexes:
  - [ ] normalized hash lookup
  - [ ] vector index (ivfflat/hnsw) depending on Supabase support

### M2 — Synchronous ingestion clustering (Option A)

- [ ] Implement normalization + hash
- [ ] Implement embedding generation
- [ ] Implement pgvector nearest-neighbor query
- [ ] Assign cluster + representative
- [ ] Store embedding + model
- [ ] Add safeguards:
  - [ ] timeouts
  - [ ] fail-open (insert message even if embedding fails)

### M3 — Admin: cluster moderation MVP

- [ ] Admin list: clusters view (representative + count + strategy)
- [ ] Cluster detail: representative + member list
- [ ] Approve/deny cluster applies to members
- [ ] Representative editing UI (public content)

### M4 — Public site: only curated representatives

- [ ] Update public queries to select only:
  - approved representatives
  - with `public_content` (or `edited_content`) not null
- [ ] Update message detail route to resolve representatives only
- [ ] Ensure cacheability:
  - ISR revalidate
  - `unstable_cache` around representative queries

### M5 — Backfill + ops (optional but recommended)

- [ ] Vercel Cron: backfill embeddings/clusters for messages missing them
- [ ] Basic observability: log rate + failures for embedding calls

---

## Risks / tradeoffs

- **False positives** (grouping distinct confessions) → mitigate with conservative thresholds + admin override later.
- **Serverless latency/cost** from synchronous embeddings → mitigate with small model + min-length threshold + cron backfill.
- **Public quality bar** (only curated representatives) means fewer items show up until moderation catches up — acceptable.
