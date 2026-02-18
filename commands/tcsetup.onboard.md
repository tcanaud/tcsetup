# tcsetup.onboard — Onboard an existing project onto the TC stack

You are the **Onboarding Orchestrator**. Your mission is to analyze an existing codebase and bootstrap the TC toolchain artifacts so they reflect the project's current state.

## Pre-checks

Before anything, verify prerequisites:
1. Check that `.agreements/`, `.adr/`, `.features/`, `.bmad_output/mermaid/` directories exist
2. Check that template files exist: `.agreements/_templates/agreement.tpl.yaml`, `.adr/_templates/template.md`, `.features/_templates/feature.tpl.yaml`
3. Check that `_bmad/modules/mermaid-workbench/config.yaml` exists
4. If any is missing, tell the user to run `npx tcsetup` first and STOP.
5. Add `.onboarding-context.json` to `.gitignore` if not already present (prevent accidental commits if interrupted)

## Process

4 phases: Discovery → User Validation → Parallel Scanning → Verify.

---

### Phase 0 — Discovery (you, the orchestrator)

Before launching agents, build a **discovery context** so agents don't waste tokens re-exploring the same files.

1. Run `Glob` on `**/*.{js,ts,jsx,tsx,json,yaml,yml,md}` (exclude `node_modules`, `_bmad`, `.bmad_output`, `package-lock.json`, `retro-*`)
2. Read every `package.json` found (root + packages)
3. Read CI/CD workflows (`.github/workflows/*.yml`)
4. Read config files (tsconfig, docker*, .env.example, etc.)
5. Read 2-3 representative source files (entry points, a typical module)
6. Run `git log --oneline -20` for recent history
7. Read `_bmad/modules/mermaid-workbench/config.yaml` (mermaid output spec)

Write the results to `.onboarding-context.json` with this structure:

```json
{
  "project_name": "...",
  "file_tree": ["list of all discovered files"],
  "packages": {
    "root": { "name": "...", "dependencies": {}, "scripts": {} },
    "packages/foo": { "name": "...", "dependencies": {}, "scripts": {} }
  },
  "config_files": {
    "path": "summary of what each config does"
  },
  "entry_points": ["list of bin/cli.js, index.js, main.ts, etc."],
  "ci_workflows": {
    "path": "summary of what each workflow does"
  },
  "recent_git_history": ["last 20 commit messages"],
  "key_patterns_observed": [
    "brief notes on patterns you noticed while reading source files"
  ],
  "feature_id_mapping": {
    "001-short-name": "Human-readable title",
    "002-short-name": "..."
  },
  "candidate_conventions": [
    "brief description of each convention/pattern detected"
  ],
  "candidate_decisions": [
    "brief description of each architecture decision detected"
  ]
}
```

**CRITICAL — Feature ID Mapping**: Identify the major features (3-8 max) and assign IDs (`XXX-short-name`). ALL agents will use this shared vocabulary.

This file is **ephemeral** — it will be deleted at the end.

---

### Phase 0.5 — User Validation

After writing `.onboarding-context.json`, use `AskUserQuestion` to validate with the user.

**CRITICAL**: The question text itself MUST contain the full structured lists — NOT in a separate message before the question. The user sees ONLY the AskUserQuestion content, so everything must be inside it.

Format the question like this (adapt content to actual data):

```
Here is what I discovered in the codebase. Please review before I launch the scanning agents.

**Features identified:**
- 001-foo — Foo Module (packages/foo)
- 002-bar — Bar Service (packages/bar)
- 003-baz — Baz CLI (packages/baz)

**Conventions detected:**
- ESM-only modules with zero runtime dependencies
- Uniform CLI entry point structure (bin/cli.js)
- File-based state with YAML on disk

**Architecture decisions detected:**
- npm workspaces monorepo with git submodules
- Preact + Vite for viewer component
- Trusted npm publishing via GitHub Actions OIDC

Does this look correct? Any features to add/remove, conventions to adjust, or decisions I missed?
```

Options: "Looks good, proceed" / "Needs adjustments" (if the user picks adjustments, ask what to change, update `.onboarding-context.json`, and re-present).

Do NOT proceed to Phase 1 until the user has validated.

---

### Phase 1 — Parallel Scanning (3 agents)

Launch ALL 3 agents simultaneously in a single message using the Task tool with `subagent_type: "general-purpose"`.

**IMPORTANT**: Each agent prompt MUST start with: `First, read .onboarding-context.json to understand the project structure. Use this as your starting point — only do additional file reads if you need deeper detail. Use the feature_id_mapping from the context file as the canonical feature IDs throughout your work.`

#### Agent 1: Architecture Analyst → Agreements + ADRs

This agent produces BOTH conventions AND ADRs in a single pass, guaranteeing coherence between them.

```
prompt: |
  You are the **Architecture Analyst**. Your mission is to analyze this codebase and produce two types of artifacts:
  1. **Convention Agreements** — document existing patterns/conventions
  2. **Architecture Decision Records** — document key architecture decisions

  You produce BOTH in one pass because conventions and decisions often mirror each other (e.g., a "zero-deps" convention exists because of a "zero-deps" architecture decision). Producing them together guarantees coherence.

  **First, read `.onboarding-context.json` to understand the project structure. Use this as your starting point — only do additional file reads if you need deeper detail. Use the `feature_id_mapping` from the context file as the canonical feature IDs throughout your work. Also read `candidate_conventions` and `candidate_decisions` as starting points.**

  ---

  ## Part A: Convention Agreements

  ### What to scan

  1. **File/folder structure** — naming conventions, organization patterns
  2. **Code patterns** — error handling, logging, imports/exports style, module pattern
  3. **Stack & frameworks** — languages, frameworks, key dependencies
  4. **API/CLI conventions** — patterns, argument parsing, output format
  5. **Config patterns** — env vars, config files
  6. **Testing patterns** — test framework, file naming

  ### Deduplication

  Before writing, review all candidates and merge overlapping conventions. Two conventions describing aspects of the same decision = ONE convention. Example: "ESM-only" + "use node: protocol" → merge.

  ### Output format

  For each convention, create an Agreement YAML file following `.agreements/_templates/agreement.tpl.yaml`:

  - Feature ID: `conv-XXX-short-name`
  - Status: `active`
  - Create in `.agreements/conv-XXX-short-name/agreement.yaml`
  - Use `──` (em-dash unicode) for section separators
  - `references.adr`: link to the ADR you create in Part B that corresponds to this convention (if one exists)

  ### Feature coverage

  Add at the end of each YAML:
  ```yaml
  # ── Feature Coverage ─────────────────────────────────
  applies_to_features: ["001-xxx", "003-yyy"]
  ```

  **Semantics of "applies to"**: A convention applies to a feature if that feature is **constrained by** the convention — i.e., violating the convention in that feature's code would be considered a bug or regression. It does NOT mean the feature "produces" or "consumes" the convention's artifact.

  Example: "zero runtime deps" applies to a package even if it has no imports at all — the constraint is that it MUST NOT add deps.

  Rules:
  - `["*"]` ONLY when ZERO exceptions across ALL features
  - Otherwise list specific feature IDs
  - When in doubt, include the feature — the verifier can remove false positives but can't easily add missing ones

  ### Count: 5-10 conventions max.

  ---

  ## Part B: Architecture Decision Records

  ### What to look for

  1. Language/runtime choice
  2. Framework choices
  3. Project structure (monorepo, module organization)
  4. Build/deploy (CI/CD, bundler)
  5. Key dependencies (non-obvious library choices)
  6. API design choices

  ### Output format

  Use `.adr/_templates/template.md` for each decision:

  - Filename: `.adr/global/YYYYMMDD-short-title.md` (today's date)
  - Status: `accepted`
  - Honest trade-offs in Positive/Negative Consequences

  ### Referential integrity for `relations`

  - ONLY reference ADR files that YOU create in this session or that already exist on disk
  - NEVER reference a non-existent ADR filename
  - Conceptual relationships to decisions not written as ADRs go in the "Links" section as prose

  ### Feature references — CRITICAL

  For each ADR, populate `references.features` with impacted feature IDs:
  - Specific impact → list that feature
  - Global impact → list ALL feature IDs explicitly
  - `references.features: []` is ALWAYS wrong

  ### Update ADR index

  After creating all ADRs, update `.adr/global/index.md`:
  ```markdown
  # Global ADRs

  | Date | Decision | Status |
  |------|----------|--------|
  | YYYY-MM-DD | [Title](filename.md) | accepted |
  ```

  Include all ADRs in `.adr/global/` (yours + pre-existing).

  ### Count: 3-7 ADRs max.

  ---

  ## Part C: Cross-reference Convention ↔ ADR

  For each convention that has a corresponding ADR (e.g., conv-zero-deps ↔ ADR zero-deps):
  - Add the ADR path in the convention's `references.adr` field
  - Add the convention ID in the ADR's "Links" section

  This is the key advantage of producing both in one pass.

  ---

  ## Final output

  Update `.agreements/index.yaml` to register all conventions.

  Output a summary:
  - List of conventions: feature_id, title, applies_to_features, linked ADR (if any)
  - List of ADRs: filename, title, references.features
```

#### Agent 2: Architecture Mapper → Mermaid diagrams

```
prompt: |
  You are the **Architecture Mapper**. Your mission is to create Mermaid diagrams that visually document the existing architecture of this codebase.

  **First, read `.onboarding-context.json` to understand the project structure. Use this as your starting point — only do additional file reads if you need deeper detail. Use the `feature_id_mapping` from the context file as the canonical feature IDs throughout your work.**

  **ALSO read `_bmad/modules/mermaid-workbench/config.yaml` for output format specifications.**

  ## Output format — CRITICAL

  The mermaid-workbench module has a STRICT output format. You MUST follow it exactly.

  ### File structure

  Diagrams are organized by feature in subdirectories:
  ```
  .bmad_output/mermaid/<feature-id>/
  ├── _index.yaml          ← manifest (REQUIRED)
  ├── L0-<id>.mmd          ← .mmd extension (NOT .md)
  ├── L1-<id>.mmd
  └── L2-<id>.mmd
  ```

  For diagrams that are global (not feature-specific), use a `global/` subdirectory:
  ```
  .bmad_output/mermaid/global/
  ├── _index.yaml
  ├── L0-<id>.mmd
  └── L1-<id>.mmd
  ```

  ### .mmd file format

  Each `.mmd` file has YAML frontmatter then PURE Mermaid syntax (no markdown):

  ```
  ---
  id: kebab-case-id
  title: Human-readable Title
  type: flowchart|architecture|state|sequence
  layer: L0|L1|L2
  parent: <diagram-id>#<node-id>    # REQUIRED for L1/L2, OMIT for L0
  children: []
  feature: <feature-id>             # or "global"
  ---

  flowchart TD
    A[Node] --> B[Node]
    ...
  ```

  Rules:
  - `id` must be unique within the feature directory
  - `parent` is REQUIRED for L1 and L2 diagrams (format: `<diagram-id>#<node-id>` where node-id is a node from the parent diagram)
  - `parent` is FORBIDDEN for L0 diagrams
  - `type` must be one of: flowchart, architecture, state, sequence
  - Content after frontmatter is PURE Mermaid — no markdown headers, no ```mermaid fences
  - `children` starts empty (updated when child diagrams are added)

  ### _index.yaml manifest

  Each feature directory MUST have a `_index.yaml`:

  ```yaml
  feature: <feature-id>
  created: YYYY-MM-DD
  updated: YYYY-MM-DD
  diagrams:
    L0:
      - id: <id>
        file: L0-<id>.mmd
        type: architecture
        title: <title>
    L1:
      - id: <id>
        file: L1-<id>.mmd
        type: flowchart
        title: <title>
        drills_from: <parent-id>#<node-id>
    L2: []
  ```

  - `drills_from` is only for L1/L2 entries, matching the diagram's `parent` field

  ## Diagrams to create

  1. **L0 — System Context** (global): How this project fits in a larger ecosystem
  2. **L1 — Component Overview** (global): Major components/modules and relationships
  3. **L2 — Key Flows** (feature-specific, 1-2 max): Important data/control flows

  For L1 diagrams, `parent` must reference an L0 diagram node: `<L0-diagram-id>#<node-id>`
  For L2 diagrams, `parent` must reference an L1 diagram node: `<L1-diagram-id>#<node-id>`

  ## Diagram ownership

  - L0 and L1 showing the whole system → `feature: "global"`, stored in `.bmad_output/mermaid/global/`
  - L2 zooming into a specific feature → `feature: "<feature-id>"`, stored in `.bmad_output/mermaid/<feature-id>/`

  ## Template conventions

  Use the conventions from `_bmad/modules/mermaid-workbench/templates/architecture.md`:
  - Rectangle `[Label]` for services
  - Cylinder `[(Label)]` for data stores
  - Trapezoid `[/Label/]` for external systems
  - Stadium `([Label])` for API endpoints
  - Subgraphs for system boundaries

  ## Mermaid syntax validation

  After writing each diagram:
  - All node IDs referenced in links must be defined
  - All node IDs unique within the diagram
  - Subgraph names are quoted
  - Direction declarations are valid

  ## Count: 2-4 diagrams max. L1 is most important.

  When done, output a summary listing each diagram: filename, layer, feature, and description.
```

#### Agent 3: Feature Inventory → Features

```
prompt: |
  You are the **Feature Inventory Agent**. Your mission is to identify existing features in this codebase and register them in the Feature Lifecycle tracker.

  **First, read `.onboarding-context.json` to understand the project structure. Use this as your starting point — only do additional file reads if you need deeper detail.**

  ## CRITICAL — Use the canonical feature IDs

  Use the `feature_id_mapping` from `.onboarding-context.json` as-is. Do NOT invent new IDs or rename them.

  ## What counts as a feature

  - A user-facing capability (API endpoint group, CLI command, UI page/component)
  - A distinct functional module with clear boundaries
  - NOT internal utilities, configs, or infrastructure code

  ## Output format

  Use `.features/_templates/feature.tpl.yaml`. For each feature:

  - Use the feature ID from `feature_id_mapping` exactly
  - Create at `.features/XXX-short-name.yaml`
  - Status: `active`, Stage: `release`
  - Use `──` (em-dash unicode) for section separators
  - Update `.features/index.yaml` (preserve valid existing entries; remove orphans)

  ## Retroactive onboarding

  These features existed BEFORE the toolchain. Add to each:

  ```yaml
  lifecycle:
    stage: "release"
    stage_since: "<today's date>"
    progress: 1.0
    manual_override: null
    retroactive: true
  ```

  For artifacts, only set `true` if the artifact actually exists on disk:
  - `agreement.*`: set `exists: false`, `status: ""`, `check: "NOT_APPLICABLE"`
  - `adr.*`: set `count: 0, ids: []` (verifier will populate)
  - `mermaid.*`: set `count: 0` (verifier will populate)

  For health:
  ```yaml
  health:
    overall: "HEALTHY"
    agreement: "NOT_APPLICABLE"
    spec_completeness: 0.0
    task_progress: 1.0
    adr_coverage: 0
    diagram_coverage: 0
    warnings: []
  ```

  Add convention linking field:
  ```yaml
  # ── Conventions ───────────────────────────────────────
  conventions: []  # populated by verifier
  ```

  When done, output a summary listing each feature_id and title.
```

---

### Phase 2 — Verify & Cross-reference

After ALL 3 agents complete, run a verification agent using the Task tool with `subagent_type: "general-purpose"`.

The verifier's job is lighter now — the Architecture Analyst already cross-referenced conventions ↔ ADRs. The verifier checks, fills gaps, and links diagrams/ADRs to features.

```
prompt: |
  You are the **Onboarding Verifier**. The 3 scanning agents have populated the TC stack artifacts. Verify consistency, fill cross-reference gaps, and fix issues.

  ## Step 1 — Read ALL artifacts

  Read:
  - All `.agreements/conv-*/agreement.yaml` files
  - `.agreements/index.yaml`
  - All `.adr/global/*.md` files (skip template.md)
  - All `.bmad_output/mermaid/**/*.mmd` and `**/_index.yaml` files
  - All `.features/*.yaml` files
  - `.features/index.yaml`

  Build an in-memory map before making changes.

  ## Step 2 — Referential integrity (#1 PRIORITY)

  ### ADR → ADR relations
  For every ADR, check `relations.supersedes/amends/constrained_by/related`:
  - Verify each referenced file exists on disk
  - If NOT: REMOVE and add `<!-- Removed: ref to non-existent {filename} -->` in Links

  ### ADR → Features
  For every ADR, check `references.features`:
  - If empty `[]`: analyze content and populate with impacted feature IDs
  - Global decisions → list ALL feature IDs

  ### Agreement → ADR
  Verify that `references.adr` in each convention points to existing ADR files.
  If a convention has no ADR reference but a matching ADR exists (by topic), add it.

  ## Step 3 — Cross-reference conventions ↔ features

  Read `applies_to_features` from each convention.
  Populate `conventions` in each feature YAML:
  - `"*"` → all features
  - Specific IDs → those features only

  ## Step 4 — Cross-reference diagrams ↔ features

  Read `_index.yaml` manifests in `.bmad_output/mermaid/`.
  For each feature that has its own mermaid directory:
  - Update `artifacts.mermaid.count` in the feature YAML
  - Update `health.diagram_coverage`
  Global diagrams (`global/` directory) are NOT attributed to specific features.

  ## Step 5 — Cross-reference ADRs ↔ features

  Read `references.features` from each ADR.
  Update each feature's `artifacts.adr.count` and `artifacts.adr.ids`.

  ## Step 6 — Index consistency

  - `.agreements/index.yaml`: must match actual `conv-*` directories on disk
  - `.features/index.yaml`: must match actual feature YAML files on disk
  - `.adr/global/index.md`: must list ALL ADR files as markdown table
  - Each `.bmad_output/mermaid/<dir>/_index.yaml`: must match actual `.mmd` files in that directory
  - Remove orphans, add missing entries

  ## Step 7 — Mermaid format compliance

  For each `.mmd` file, verify:
  - File extension is `.mmd` (not `.md`)
  - Frontmatter has required fields: `id`, `title`, `type`, `layer`, `feature`
  - L1/L2 have `parent` field, L0 does not
  - Content after frontmatter is pure Mermaid (no markdown fences, no `# headers`)
  - Type is one of: flowchart, architecture, state, sequence
  - Layer is one of: L0, L1, L2

  Fix any violations.

  ## Step 8 — Template compliance & quality

  - No `{{...}}` placeholder tokens
  - No empty required fields
  - Valid ISO dates
  - Valid status values
  - `──` (em-dash) separators consistently

  ## Step 9 — Machine validation

  ```bash
  node -e "
    const fs = require('fs');
    const path = require('path');
    const dir = '.features';
    const files = fs.readdirSync(dir).filter(f => f.match(/^\d{3}-.*\.yaml$/));
    let ok = 0, fail = 0;
    for (const f of files) {
      try {
        const c = fs.readFileSync(path.join(dir, f), 'utf8');
        if (!c.includes('feature_id:')) { console.error('MISSING feature_id: ' + f); fail++; }
        else if (!c.includes('status:')) { console.error('MISSING status: ' + f); fail++; }
        else if (!c.includes('lifecycle:')) { console.error('MISSING lifecycle: ' + f); fail++; }
        else ok++;
      } catch(e) { console.error('ERROR: ' + f + ' ' + e.message); fail++; }
    }
    console.log(ok + '/' + (ok+fail) + ' features valid');
    process.exit(fail > 0 ? 1 : 0);
  "
  ```

  Fix any failures.

  ## Step 10 — Cleanup

  - Delete `.onboarding-context.json`

  ## Step 11 — Write report

  Write the report to `.onboarding-report.md` AND print it:

  ```markdown
  # Onboarding Report

  ## Agreements (conventions)
  - [conv-001-xxx] Title (linked ADR: yes|no) — OK|FIXED

  ## ADRs
  - [20260218-xxx] Title (features: [list]) — OK|FIXED

  ## Diagrams
  - [L0-xxx.mmd] Title (dir: global|feature-id) — OK|FIXED

  ## Features
  - [001-xxx] Title (retroactive, conventions: N, ADRs: N, diagrams: N) — OK|FIXED

  ## Cross-references
  - Conventions → Features: X conventions linked to Y features
  - ADRs → Features: X ADRs referencing Y features (Z filled by verifier)
  - Agreements ↔ ADRs: X linked pairs
  - Diagrams: X in global/, Y in feature dirs

  ## Machine validation
  - Feature YAML: PASS|FAIL
  - Mermaid format: PASS|FAIL

  ## Issues remaining
  - (any unresolved)

  ## Summary
  Status: PASS|NEEDS_ATTENTION
  Artifacts: X conventions, Y ADRs, Z diagrams, W features
  ```
```

---

## Execution rules

1. **Pre-checks**: Verify prerequisites + add `.onboarding-context.json` to `.gitignore`. STOP if missing.
2. **Phase 0**: Build discovery context including feature IDs, candidate conventions, and candidate decisions.
3. **Phase 0.5**: Present features + conventions + decisions to user with `AskUserQuestion`. Wait for validation.
4. **Phase 1**: Launch ALL 3 agents in a single message (parallel).
5. **Phase 2**: After ALL 3 agents return, run verifier. Present report to user.
6. Do NOT commit. Let the user review first.
