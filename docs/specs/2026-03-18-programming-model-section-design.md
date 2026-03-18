# Programming Model Section -- Design Spec

## Overview

A new "Programming Model" sidebar section positioned between Concepts and Tutorials. Three pages, ordered by reader journey (not by internal concept hierarchy). This is the most important section for new developers learning to write Groundhog contracts.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API depth | Layered: `strict_inc` leads, `set_add` under the hood | Most devs need the practical API. The `set_add` model is the "aha" for those who want to reason about conflicts. |
| Page order | Execution -> Storage Types -> NNInt Deep Dive | Internal reference says start with NNInt. For new developers unfamiliar with the system, execution context must come first so NNInt's significance is clear. The concept guides already prime readers on NNInt as "the one thing to learn," so by the time they reach Programming Model they need the execution context, then the details. Deliberately inverts the internal reading order. |
| Relationship to How It Works | Coexist | Programming Model = rules for writing correct contracts. How It Works = how the engine enforces those rules. Different audiences. Some overlap with `how-it-works/execution-model.md` is expected. New pages should cross-link to How It Works for engine internals. Deduplication is a future refactor once the Programming Model section is solid and we can see what's redundant. |
| Code examples | Real SDK snippets, focused | Developers will have these pages open while writing contracts. Real syntax reduces context-switching. Keep snippets minimal to reduce maintenance surface. |
| Exclusive write flag | Mentioned in Storage Types page | Practical feature devs will search for. Also gauges interest from early readers. Source: `reference/storage-types.md` (`set_exclusive` methods) and SDK source, since `docs/programming-model/` does not cover this feature. |
| try_invoke (early reservation) | Deferred | Advanced feature, not needed for the core model. |
| inc vs strict_inc | Both documented, strict_inc is the recommended default | SDK examples all use strict_inc. inc is an optimization footnote. |

## Source of Truth

All content derived from `docs/programming-model/` (nnint.md, storage-types.md, execution.md) and verified against `~/code/gh/sdk/sdk_rs`. Reference section pages are known to be stale and should not be used as source material.

## Sidebar Placement

```
Concepts          (existing)
Programming Model (new)
  - Execution Model
  - Storage Types
  - NNInt Deep Dive
Tutorials         (existing)
```

## Page Frontmatter

| Page | File | Title | Description |
|------|------|-------|-------------|
| 1 | `src/content/docs/programming-model/execution.md` | Execution Model | How your contract runs: snapshot isolation, deltas, block lifecycle, and gas. |
| 2 | `src/content/docs/programming-model/storage-types.md` | Storage Types | The four storage types, their conflict semantics, and how to choose between them. |
| 3 | `src/content/docs/programming-model/nnint.md` | NNInt In Depth | The set_add primitive underneath NNInt and why concurrent transactions merge. |

Use "NNInt" consistently across all new pages (not "NonnegativeInt"). The existing `how-it-works/execution-model.md` uses "NonnegativeInt" in places; that can be aligned in a future cleanup.

## Page 1: Execution Model

**File**: `src/content/docs/programming-model/execution.md`
**Purpose**: Answer "how does my code run?"

### Sections

**Opening** (no heading, 2-3 sentences)
Your contract reads from a frozen snapshot and produces deltas. It never sees other transactions' writes. At block close, deltas are checked for compatibility: compatible ones merge, incompatible ones are excluded and returned to the mempool.

**Snapshot Isolation** (~4 sentences + diagram)
- All transactions in a block read the same committed state from the previous block.
- No dirty reads, no write-write visibility within a block.
- Postgres REPEATABLE READ analogy (one sentence callback to concept guides).

**Deltas, Not State** (~3 sentences + code snippet)
- Contract produces "how state should change," not "what state should be."
- Snippet: `self.balance.strict_inc(5)` with annotation: "this says 'add 5', not 'set to 105'."
- This is what makes parallel execution possible.

**Block Lifecycle** (ASCII diagram)
```
Frozen Snapshot
    +---> Tx A produces deltas
    +---> Tx B produces deltas  (all read same snapshot, all concurrent)
    +---> Tx C produces deltas
    v
Reservation Phase
    +---> Compatible deltas merge
    +---> Incompatible transactions excluded
    v
New Committed State
    +---> Excluded transactions returned to mempool
```

**Exclusion** (~4 sentences)
- Conflicting transactions execute fully, then get excluded at reservation.
- Excluded transactions are returned to the mempool.
- No retry logic needed.
- Forward pointer: "How conflicts are determined depends on the storage type."

**Gas** (~5 sentences + snippet)
- Gas limits exist and must be specified (prevents infinite loops, caps call depth).
- Gas costs zero tokens. Metering, not billing.
- Snippet: `client.with_gas_limit(100_000).transfer(&to, amount);`
- "Don't optimize for gas cost. Optimize for correct conflict semantics."
- Gas price estimation framing: no price volatility on Groundhog.

**Throughput** (~3 sentences)
- BPS: free HOG balance = share of network throughput.
- Under capacity: everything lands. Under congestion: proportional allocation.
- "Schedule your coins, don't burn them."

**Storage Costs** (~3 sentences)
- Writing data to the ledger locks HOG proportional to bytes stored. Deleting data returns the HOG. Refundable deposit, not a burn.
- Every HOG locked for storage is one less HOG contributing to your throughput share.
- Your contract does not calculate deposits. The runtime handles it at commit.

## Page 2: Storage Types

**File**: `src/content/docs/programming-model/storage-types.md`
**Purpose**: Answer "what can I write to?"

### Sections

**Opening** (1 sentence)
Groundhog has four storage types. The type you choose determines whether concurrent writes merge, conflict, or ignore each other.

**NNInt** (~3 sentences + snippet)
- Non-negative integer. The workhorse. Concurrent increments merge automatically.
- Snippet: `#[sdk::storage]` struct with NNInt field, two concurrent `strict_inc` calls merging.
- Non-negative invariant enforced at protocol level.
- Forward pointer to NNInt Deep Dive.

**Map<K, V>** (~3 sentences + snippet)
- Key-value store. Different keys fully independent.
- Same-key behavior follows value type's rules.
- Snippet: `Map<ContractAddress, NNInt>` with independent keys and same-key examples.
- One sentence on nesting for composite keys.

**Bytestring** (~3 sentences + snippet)
- Raw bytes. Concurrent writes to same key always conflict.
- Snippet: two `set` calls conflicting.
- "Use for config, ownership, metadata. Not for hot paths."

**RetrocausalQueue** (~3 sentences + snippet)
- FIFO queue. Inserts commute. Consumes are sequential.
- Snippet: two concurrent inserts, one consume.
- "Use when producers are concurrent but consumers process in order."

**Choosing a Type** (table)

| Write pattern | Type | Why |
|---|---|---|
| `balance = balance + delta` | NNInt | Deltas merge |
| key-value with unique keys | Map | Independent keys |
| `owner = new_value` | Bytestring | Accept conflict |
| Append to work queue | RetrocausalQueue | Inserts merge |

**Exclusive Write Flag** (callout box, 2-3 sentences)
- Mutex-like semantics: only one transaction touches this location per block.
- Blunt instrument. Prefer NNInt deltas when possible.

## Page 3: NNInt Deep Dive

**File**: `src/content/docs/programming-model/nnint.md`
**Purpose**: The "aha" page. Explain why concurrent transactions merge safely.

### Sections

**Opening** (2 sentences)
You've been using `strict_inc` to write to NNInt. Here's what's happening underneath, and why concurrent transactions can merge safely.

**The set_add Primitive** (~4 sentences)
- Every NNInt location maintains two pending values: set (absolute base) and add (accumulated delta).
- Low-level operation: `set_add(set_value, add_value)`. Final value = set + add.
- Your contract never calls set_add directly. SDK methods map onto it.
- This two-component model is what makes commutativity rules simple and mechanical.

**The One Rule** (~2 sentences + table)
- Two concurrent set_add calls commute if and only if their set values are equal.
- They don't have to be any particular value. They just have to match.

| Tx A | Tx B | Result |
|---|---|---|
| `set_add(S, x)` | `set_add(S, y)` | Merge: adds combine |
| `set_add(A, x)` | `set_add(B, y)`, A != B | Conflict: one excluded |

"Same base + different deltas = merge. Different bases = conflict."

**The None Optimization** (~5 sentences + table)
- `set_add(None, delta)`: let the DB fill in the base from the snapshot.
- Skips a client-side DB read. Same result as reading the snapshot yourself.
- None resolves to the snapshot value, so commutativity depends on what the other transaction does:

| Tx A | Tx B | Commutes? | Why |
|---|---|---|---|
| `set_add(None, x)` | `set_add(None, y)` | Yes | Both resolve to snapshot |
| `set_add(None, x)` | `set_add(S, y)` where S = snapshot | Yes | Same effective base |
| `set_add(None, x)` | `set_add(S, y)` where S != snapshot | No | Different resolved bases |

**How the API Maps to set_add** (table + 1-2 sentences per method)

| Method | Calls | Reads? | Commutes? |
|---|---|---|---|
| `strict_inc(delta)` | `set_add(snapshot, acc + delta)` | Yes | Always |
| `inc(delta)` | `set_add(None, acc + delta)` | No | Always |
| `set(value)` | `set_add(value, 0)` | No | Only if values match |

- **strict_inc**: reads snapshot, checks non-negative invariant immediately, aborts on underflow. The common case. Use this.
- **inc**: skips the read. Underflow caught at commit. Optimization for high-throughput paths.
- **set**: absolute write. Replaces base, clears delta. Reserve for init or admin.

"strict_inc and inc are interchangeable from a commutativity standpoint. Mix freely."

**Why This Matters** (~3 sentences)
- Transaction ordering doesn't matter because concurrent writes resolve to the same base. Deltas are addition. Addition commutes.
- Callback to execution model: this is what "compatible" means at reservation.
- "Pick the right storage type, use strict_inc on hot paths, and the runtime handles concurrency for you."

## Sidebar Configuration Change

In `astro.config.mjs`, add after Concepts and before Tutorials:

```js
{
  label: 'Programming Model',
  items: [
    'programming-model/execution',
    'programming-model/storage-types',
    'programming-model/nnint',
  ],
},
```

## Follow-up Work (Not in Scope)

- Code snippet currency strategy (public example repo, generated reference docs)
- Reference section refresh against current SDK
- try_invoke / early reservation documentation (advanced section)
- Exclusive write flag full reference documentation
- Landing page update (Builder path steps may need to reference Programming Model)
