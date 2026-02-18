import { execSync } from "node:child_process";
import { readFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));

const steps = [
  {
    name: "BMAD Method",
    flag: "--skip-bmad",
    cmd: "npx bmad-method install",
  },
  {
    name: "Spec Kit",
    flag: "--skip-speckit",
    cmd: "specify init --here --ai claude",
  },
  {
    name: "Agreement System",
    flag: "--skip-agreements",
    cmd: "npx agreement-system init --yes",
  },
  {
    name: "ADR System",
    flag: "--skip-adr",
    cmd: "npx adr-system init --yes",
  },
  {
    name: "Mermaid Workbench",
    flag: "--skip-mermaid",
    cmd: "npx mermaid-workbench init",
  },
  {
    name: "Feature Lifecycle Tracker",
    flag: "--skip-lifecycle",
    cmd: "npx feature-lifecycle init --yes",
  },
  {
    name: "Knowledge System",
    flag: "--skip-knowledge",
    cmd: "npx @tcanaud/knowledge-system init --yes",
  },
  {
    name: "Product Manager",
    flag: "--skip-product",
    cmd: "npx @tcanaud/product-manager init --yes",
  },
];

export function install(flags = []) {
  console.log(`\n  tcsetup v${version}\n`);

  let current = 0;
  const total = steps.filter((s) => !flags.includes(s.flag)).length;

  for (const step of steps) {
    if (flags.includes(step.flag)) {
      console.log(`  [skip] ${step.name} (${step.flag})\n`);
      continue;
    }

    current++;
    console.log(`  [${current}/${total}] ${step.name}`);
    console.log(`  > ${step.cmd}\n`);

    try {
      execSync(step.cmd, { stdio: "inherit" });
      console.log();
    } catch (err) {
      console.error(`\n  ⚠ ${step.name} failed (exit code ${err.status}).`);
      console.error(`  Continuing with remaining steps...\n`);
    }
  }

  // ── Install Claude Code commands ──────────────────────
  const commandsSource = join(__dirname, "..", "commands");
  const commandsDest = join(process.cwd(), ".claude", "commands");

  if (existsSync(commandsSource)) {
    const commandFiles = ["tcsetup.onboard.md", "feature.workflow.md"];
    mkdirSync(commandsDest, { recursive: true });
    for (const file of commandFiles) {
      const src = join(commandsSource, file);
      const dest = join(commandsDest, file);
      if (existsSync(src)) {
        copyFileSync(src, dest);
        console.log(`  [cmd] Installed .claude/commands/${file}`);
      }
    }
    console.log();
  }

  console.log("  Done! Project setup complete.\n");
}
