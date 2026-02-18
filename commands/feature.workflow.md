# /feature.workflow — Playbook Router

**Input**: `$ARGUMENTS` (feature name or ID, e.g., `user-auth` or `001-user-auth`)

## Execution

Follow these steps exactly:

### 1. Read config

Read `.features/config.yaml` and extract all path settings:
- `bmad_output_dir`, `speckit_specs_dir`, `agreements_dir`, `adr_dir`, `mermaid_dir`
- `default_owner`

Read `.features/index.yaml` to get the list of registered features.

### 2. Resolve feature identity

**If `$ARGUMENTS` is empty or missing:**
- Read `.features/index.yaml` and list all known features
- Ask the user: "Which feature do you want to work on? Enter a feature ID or a new name."
- Use the response as the feature identifier going forward

**If `$ARGUMENTS` matches an existing feature ID** (e.g., `001-adr-system`):
- Use it directly

**If `$ARGUMENTS` is a name without a number prefix** (e.g., `user-auth`):
- Check `.features/index.yaml` for a feature whose ID ends with that name
- If found, use that existing feature ID
- If NOT found, this is a **new feature** — auto-assign the next number:
  - Read all `###-*.yaml` files in `.features/`
  - Find the highest number prefix
  - Assign `{highest + 1, zero-padded to 3}-{name}` (e.g., `006-user-auth`)

Store the resolved feature ID as `FEATURE` for all subsequent steps.

### 3. Detect workflow path

**If this is an existing feature** (feature YAML already exists):
- Skip to step 5 (artifact scan) — the workflow path was already chosen

**If this is a new feature**, ask the user with `AskUserQuestion`:

```
Which workflow path for "{FEATURE}"?
```

Options:
1. **Full Method** — "Complex features or product bets. Includes product brief, PRD, architecture, epics, then spec, plan, tasks, agreement, implement."
2. **Quick Flow** — "Small features or fixes. Quick spec, then specify, tasks, implement."

Store the choice as `WORKFLOW_PATH` (`full` or `quick`).

### 4. Scaffold new feature

Only if this is a new feature:

**Create feature YAML:**
- Create `.features/{FEATURE}.yaml` from `.features/_templates/feature.tpl.yaml`
- Replace `{{feature_id}}` with `FEATURE`
- Replace `{{title}}` with human-readable form of the name (kebab-case to Title Case)
- Replace `{{owner}}` with `default_owner` from config
- Replace `{{date}}` and `{{timestamp}}` with today's date/time
- Set `lifecycle.stage` to `ideation`
- Add a custom field `workflow_path: "full"` or `workflow_path: "quick"`

**Create per-feature BMAD directory:**
- Create directory: `{bmad_output_dir}/planning-artifacts/{FEATURE}/`

**Create SpecKit directory:**
- Create directory: `{speckit_specs_dir}/{FEATURE}/`

**Update index:**
- Add the new feature to `.features/index.yaml`

### 5. Scan all artifacts

Scan the filesystem for every artifact in the dependency chain. For each, record `true`/`false` (or count for tasks):

| Key | Detection Path |
|-----|---------------|
| `bmad.brief` | `{bmad_output_dir}/planning-artifacts/{FEATURE}/` — any file matching `*brief*` |
| `bmad.prd` | `{bmad_output_dir}/planning-artifacts/{FEATURE}/` — any file matching `*prd*` |
| `bmad.architecture` | `{bmad_output_dir}/planning-artifacts/{FEATURE}/` — any file matching `*architecture*` |
| `bmad.epics` | `{bmad_output_dir}/planning-artifacts/{FEATURE}/` — any file matching `*epic*` or `*stories*` |
| `bmad.quick_spec` | `{bmad_output_dir}/planning-artifacts/{FEATURE}/` — any file matching `*quick*spec*` or `*quick-spec*` |
| `speckit.spec` | `{speckit_specs_dir}/{FEATURE}/spec.md` |
| `speckit.plan` | `{speckit_specs_dir}/{FEATURE}/plan.md` |
| `speckit.tasks` | `{speckit_specs_dir}/{FEATURE}/tasks.md` — also count `- [x]` (done) and `- [ ]` (pending) |
| `agreement.exists` | `{agreements_dir}/{FEATURE}/agreement.yaml` |
| `agreement.check` | `{agreements_dir}/{FEATURE}/check-report.md` — read verdict if present |
| `feature.yaml` | `.features/{FEATURE}.yaml` |
| `mermaid.index` | `{mermaid_dir}/{FEATURE}/_index.yaml` |

Read `workflow_path` from the feature YAML (defaults to `full` if missing).

### 6. Evaluate dependency chain and find next step

**Full Method dependency chain:**

```
 Step  Name           Requires                     Artifact Key        Command
 ───── ────────────── ──────────────────────────── ─────────────────── ─────────────────────────────────────────
 1     Brief          (none)                       bmad.brief          /bmad-bmm-create-product-brief
 2     PRD            brief                        bmad.prd            /bmad-bmm-create-prd
 3     Architecture   PRD (optional step)          bmad.architecture   /bmad-bmm-create-architecture
 4     Epics/Stories  PRD (optional step)          bmad.epics          /bmad-bmm-create-epics-and-stories
       ── GATE A: brief + PRD required ──
 5     Specify        GATE A                       speckit.spec        /speckit.specify {FEATURE}
 6     Plan           spec                         speckit.plan        /speckit.plan
 7     Tasks          spec                         speckit.tasks       /speckit.tasks
       ── GATE B: spec + tasks + agreement ──
 8     Agreement      spec + tasks                 agreement.exists    /agreement.create {FEATURE}
 9     Implement      GATE B                       (task progress)     /speckit.implement
       ── GATE C: tasks show meaningful progress ──
 10    Agree. Check   task progress >= 50%         agreement.check     /agreement.check {FEATURE}
 11    Feature Status (any time)                   feature.yaml        /feature.status {FEATURE}
```

**Quick Flow dependency chain:**

```
 Step  Name           Requires                     Artifact Key        Command
 ───── ────────────── ──────────────────────────── ─────────────────── ─────────────────────────────────────────
 1     Quick Spec     (none)                       bmad.quick_spec     /bmad-bmm-quick-spec
       ── GATE A: quick_spec required ──
 2     Specify        GATE A                       speckit.spec        /speckit.specify {FEATURE}
 3     Tasks          spec                         speckit.tasks       /speckit.tasks
       ── GATE B: spec + tasks required ──
 4     Implement      GATE B                       (task progress)     /speckit.implement
 5     Feature Status (any time)                   feature.yaml        /feature.status {FEATURE}
```

**Finding the next step:**
- Walk the chain top to bottom
- The first step whose artifact key is `false` (or whose gate is not satisfied) is the **next step**
- If ALL steps are complete, the feature is **done**

**Gate evaluation:**
- **GATE A (Full)**: `bmad.brief == true AND bmad.prd == true`
- **GATE A (Quick)**: `bmad.quick_spec == true`
- **GATE B (Full)**: `speckit.spec == true AND speckit.tasks == true AND agreement.exists == true`
- **GATE B (Quick)**: `speckit.spec == true AND speckit.tasks == true`
- **GATE C**: tasks completion >= 50% (tasks_done / tasks_total >= 0.5)

### 7. Display progress dashboard

Output the following Markdown report:

```markdown
## Workflow: {FEATURE} — {title}

**Path**: {Full Method | Quick Flow} | **Stage**: {current lifecycle stage}
**Owner**: {owner} | **Next Step**: Step {N} — {step name}

### Progress

{For each step in the chain, show a status indicator}
```

**For Full Method, display:**

```markdown
### Progress — Full Method

| # | Step | Status | Artifact |
|---|------|--------|----------|
| 1 | Brief | {done/pending/current} | {file path or —} |
| 2 | PRD | {done/pending/current} | {file path or —} |
| 3 | Architecture | {done/skip/pending} | {file path or —} |
| 4 | Epics/Stories | {done/skip/pending} | {file path or —} |
|   | **GATE A** | {pass/blocked} | Brief + PRD |
| 5 | Specify | {done/pending/blocked} | {file path or —} |
| 6 | Plan | {done/pending/blocked} | {file path or —} |
| 7 | Tasks | {done/pending/blocked} | {file path or —} |
|   | **GATE B** | {pass/blocked} | Spec + Tasks + Agreement |
| 8 | Agreement | {done/pending/blocked} | {file path or —} |
| 9 | Implement | {done/in-progress/blocked} | {done}/{total} tasks ({pct}%) |
|   | **GATE C** | {pass/blocked} | Tasks >= 50% |
| 10 | Agreement Check | {done/pending/blocked} | {PASS/FAIL/—} |
| 11 | Feature Status | {done/pending} | .features/{FEATURE}.yaml |
```

**For Quick Flow, display the equivalent shorter table.**

Use these status indicators:
- `done` — artifact exists
- `current` — this is the next step to do (highlight with **bold**)
- `pending` — not yet reachable (prerequisites not met)
- `blocked` — behind an unsatisfied gate
- `skip` — optional step, skipped
- `in-progress` — partially complete (for tasks with progress)

### 8. Propose next action

Based on the next step identified in step 6, output:

```markdown
### Next Action

{description of what to do next}

**Run:** `/command-name {arguments}`
```

**BMAD output path instruction:** When the next step is a BMAD command (steps 1-4 in Full, step 1 in Quick), add this note:

```markdown
> When the BMAD agent asks where to save, tell it:
> **Save to:** `{bmad_output_dir}/planning-artifacts/{FEATURE}/`
```

**Special cases:**

- If the next step is `/speckit.specify`, include `{FEATURE}` as the argument
- If the next step is `/agreement.create`, include `{FEATURE}` as the argument
- If the next step is `/agreement.check`, include `{FEATURE}` as the argument
- If the next step is `/feature.status`, include `{FEATURE}` as the argument
- If ALL steps are complete:
  ```markdown
  ### Status: Complete

  All workflow steps for **{FEATURE}** are done.

  **Suggested next actions:**
  - `/feature.status {FEATURE}` — refresh feature status
  - `/agreement.check {FEATURE}` — verify agreement compliance
  - `/feature.list` — see all features
  ```

### 9. Handle re-entry

This command is **re-entrant**. Every invocation:
1. Re-scans all artifacts (state may have changed since last run)
2. Recalculates the next step
3. Shows the updated dashboard

The user runs `/feature.workflow {FEATURE}` after completing each step to see what's next. No state is stored beyond what the filesystem already contains.

## Handoffs

- After any BMAD step completes → re-run `/feature.workflow {FEATURE}`
- After any SpecKit step completes → re-run `/feature.workflow {FEATURE}`
- To see detailed feature status → `/feature.status {FEATURE}`
- To see all features → `/feature.list`
- To check agreement health → `/agreement.check {FEATURE}`
