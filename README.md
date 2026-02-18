# tcsetup

Bootstrap and update a project with the full TC toolchain in one command.

## What it installs

| Step | Tool | Command |
|------|------|---------|
| 1 | [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) | `npx bmad-method install` |
| 2 | [Spec Kit](https://github.com/github/spec-kit) | `specify init --here --ai claude` |
| 3 | [Agreement System](https://github.com/tcanaud/agreement-system) | `npx agreement-system init --yes` |
| 4 | [ADR System](https://github.com/tcanaud/adr-system) | `npx adr-system init --yes` |
| 5 | [Mermaid Workbench](https://github.com/tcanaud/mermaid-workbench) | `npx mermaid-workbench init` |
| 6 | [Feature Lifecycle](https://github.com/tcanaud/feature-lifecycle) | `npx feature-lifecycle init --yes` |

## Usage

### Init (onboard a new project)

```bash
npx tcsetup
# or explicitly:
npx tcsetup init
```

### Update (refresh an existing project)

```bash
npx tcsetup update
```

Detects which tools are installed (by marker directories), updates their npm packages to latest, runs each tool's update command to refresh commands/templates, and refreshes tcsetup's own Claude Code command files. User data is never touched.

### Help

```bash
npx tcsetup help
```

### Skip specific steps (init only)

```bash
npx tcsetup --skip-bmad
npx tcsetup --skip-speckit
npx tcsetup --skip-agreements
npx tcsetup --skip-adr
npx tcsetup --skip-mermaid
npx tcsetup --skip-lifecycle
```

Multiple flags can be combined:

```bash
npx tcsetup --skip-speckit --skip-mermaid
```

## Prerequisites

- Node.js >= 18
- `specify` CLI installed globally (for Spec Kit step)

## License

MIT
