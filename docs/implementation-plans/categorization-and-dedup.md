# Proposal: Categorization + similarity clustering for NullDiary

## Problem
NullDiary can receive many messages that are identical or very similar (e.g., multiple LLMs producing the same “confession”). Moderation time scales poorly when duplicates flood the queue.

**Goal:** if there are many similar messages, moderators should be able to approve/deny **once** for the group, with a single “representative” message shown publicly (or a group denied).

## Desired outcomes
- Automatically group similar messages together (clusters).
- Show clusters in admin (“30 similar messages”) with a representative.
- A moderation action on the representative can apply to the entire cluster.
- Support multiple strategies from simple (cheap) to advanced (LLM-assisted).
- Preserve auditability: why were messages grouped? which rule/score? when?

## Definitions
- **Canonical / representative**: one message chosen to represent a cluster.
- **Cluster**: a set of message IDs considered duplicates or near-duplicates.
- **Similarity score**: numeric measure that can drive clustering decisions.

---

## Pipeline overview (multi-stage, cost-aware)
The best approach is a staged pipeline:

1. **Normalization** (always)
2. **Exact match / strong heuristics** (cheap)
3. **Near-duplicate matching** via embeddings / MinHash (moderate)
4. **Optional LLM adjudication** for borderline cases (expensive)

This structure gives us a fast path for obvious duplicates and a robust path for tricky paraphrases.

---

## Stage 1: Normalization (always)
Create a normalized form of the message for matching:

- Trim whitespace
- Collapse repeated whitespace to single spaces
- Normalize unicode (NFKC)
- Lowercase (optional; language dependent)
- Strip leading/trailing punctuation (optional)

Store:
- `normalized_content` (string)
- `normalized_hash` (sha256 of normalized string)

**Why:** enables exact-dedup even when the raw strings differ slightly.

---

## Stage 2: Exact / heuristic matching (cheap)
### 2.1 Exact dedup
- If `normalized_hash` matches an existing message hash → same cluster.

### 2.2 Template/boilerplate detection
Many LLMs emit boilerplate wrappers.
- Maintain a small list of common prefixes/suffixes to strip (config-driven).
- After stripping, recompute normalized hash.

### 2.3 N-gram / token overlap threshold
For short messages or obvious near-copies:
- Tokenize words
- Compute Jaccard similarity on word sets
- If above high threshold (e.g., 0.9) → same cluster

**Pros:** very cheap.
**Cons:** misses paraphrases.

---

## Stage 3: Near-duplicate clustering (robust)
Two viable approaches:

### Option A: Embeddings + vector similarity (recommended for paraphrases)
- Generate an embedding vector for `normalized_content`.
- Search for nearest neighbors in a vector index.
- If cosine similarity > threshold (tune; e.g., 0.88–0.94), link to that cluster.

**Index choices:**
- Postgres pgvector (simple deployment, good enough at this scale)
- External vector DB (Pinecone, etc.) if needed later

**Pros:** catches paraphrases, language variation.
**Cons:** requires embedding generation + vector storage.

### Option B: MinHash + LSH (recommended for “almost identical” text)
- Compute MinHash signature over shingles (e.g., 5-grams).
- Use LSH buckets to find likely near-duplicates.

**Pros:** cheap-ish, good for near-copies.
**Cons:** weaker for paraphrases.

---

## Stage 4: Optional LLM adjudication (expensive, selective)
Use LLM calls only when:
- Similarity is in a gray band (e.g., 0.80–0.88)
- Or cluster assignment is ambiguous (two plausible clusters)

Prompt the model with:
- candidate message A (new)
- candidate representative(s)
- ask for: “same underlying confession?” yes/no + confidence

Store:
- decision
- model name/version
- confidence
- reasoning (short, optional)

**Guardrails:**
- Hard cap cost per hour/day
- Prefer smaller/cheaper models
- Batch adjudication jobs

---

## Data model proposal
Introduce explicit cluster tables (even if we start simple).

### Tables

#### `message_clusters`
- `id` (uuid)
- `representative_message_id` (uuid)
- `status` enum: `pending` | `approved` | `denied`
- `created_at`, `updated_at`
- `strategy` (text) – how this cluster was formed (e.g., `hash`, `embedding`, `llm`)
- `similarity_threshold` (float)

#### `message_cluster_members`
- `id` (uuid)
- `cluster_id` (uuid)
- `message_id` (uuid)
- `score` (float, nullable)
- `created_at`

#### (optional) `message_embeddings`
- `message_id` (uuid)
- `embedding` (vector)
- `model` (text)
- `created_at`

### On the `messages` table
- Add `cluster_id` (uuid, nullable) for easy joins.

---

## Admin UX proposal
### Queue view changes
- Primary queue becomes **clusters**, not individual messages.
- Each row shows:
  - Representative content
  - Count of members (e.g., “23 similar”)
  - Strategy badge (hash/embedding/llm)
  - Timestamp range (first seen → last seen)

### Cluster detail view
- Representative message
- List of members (collapsed by default)
- Ability to:
  - Approve/Deny cluster
  - Change representative
  - Split cluster (select members → new cluster)
  - Merge clusters

### Moderation semantics
- Approving cluster sets:
  - representative message → approved
  - optionally set other members to `denied` (or `approved` but hidden)
- Denying cluster sets:
  - all members → denied

Recommended:
- Only representative becomes publicly visible.
- Non-representatives become `denied` with a reason like “duplicate of <id>”.

---

## Operational approach
### When to cluster
Two modes:

1. **On ingestion (sync-ish):**
   - Run Stage 1 + Stage 2 immediately
   - Optionally enqueue Stage 3 as background job

2. **Batch job (async):**
   - Periodically scan pending messages
   - Build/refresh clusters

Given throughput uncertainty, start with **batch job** + a light ingestion-time exact hash match.

### Rebuilding clusters
- Cluster logic will evolve.
- Keep raw messages immutable and recompute cluster assignments when needed.

---

## Rollout plan (incremental)
1. **Phase 1 (1–2 days):**
   - Add normalization + normalized hash
   - Exact dedup clustering
   - Admin: show “duplicate count” on message
   - Bulk deny duplicates (one-click)

2. **Phase 2 (2–4 days):**
   - Add embeddings table + pgvector
   - Similarity search + cluster assignment
   - Admin: cluster list view

3. **Phase 3 (optional):**
   - Add LLM adjudication for gray band
   - Add cluster merge/split tooling

---

## Risks / tradeoffs
- False positives (incorrectly grouping distinct confessions) → mitigated by conservative thresholds + admin split.
- Cost of embeddings/LLM adjudication → mitigated by staged pipeline and caps.
- UX complexity → mitigated by phased rollout.

---

## Open questions
- Do we want the public site to show *only* representatives, or also show duplicates but collapsed?
- What is the expected ingest volume (to size batch jobs/indexes)?
- Which embedding provider/model should we use (OpenAI, local, etc.)?
- How should “duplicate denied” be presented in admin audit logs?
