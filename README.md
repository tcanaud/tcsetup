# tcsetup

Bootstrap a new project with the full TC toolchain in one command.

## What it installs

| Step | Tool | Command |
|------|------|---------|
| 1 | [BMAD Method](https://github.com/bmad-code-org/bmad-method) | `npx bmad-method install` |
| 2 | [Spec Kit](https://github.com/anthropics/specify) | `specify init --here --ai claude` |
| 3 | [Agreement System](https://github.com/tcanaud/agreement-system) | `npx agreement-system init --yes` |
| 4 | [Mermaid Workbench](https://github.com/tcanaud/mermaid-workbench) | `npx mermaid-workbench init` |

## Usage

```bash
npx tcsetup
```

### Skip specific steps

```bash
npx tcsetup --skip-bmad
npx tcsetup --skip-speckit
npx tcsetup --skip-agreements
npx tcsetup --skip-mermaid
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
