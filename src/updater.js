import { execSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));

const TOOLS = [
  {
    name: "ADR System",
    marker: ".adr",
    pkg: "adr-system",
    cmd: "npx adr-system update",
  },
  {
    name: "Agreement System",
    marker: ".agreements",
    pkg: "agreement-system",
    cmd: "npx agreement-system update",
  },
  {
    name: "Feature Lifecycle",
    marker: ".features",
    pkg: "feature-lifecycle",
    cmd: "npx feature-lifecycle update",
  },
  {
    name: "Mermaid Workbench",
    marker: ["_bmad/modules/mermaid-workbench", ".bmad/modules/mermaid-workbench"],
    pkg: "mermaid-workbench",
    cmd: "npx mermaid-workbench init",
  },
  {
    name: "Knowledge System",
    marker: ".knowledge",
    pkg: "@tcanaud/knowledge-system",
    cmd: "npx @tcanaud/knowledge-system update && npx @tcanaud/knowledge-system refresh",
  },
];

const COMMAND_FILES = ["tcsetup.onboard.md", "feature.workflow.md"];

function isInstalled(marker, projectRoot) {
  if (Array.isArray(marker)) {
    return marker.some((m) => existsSync(join(projectRoot, m)));
  }
  return existsSync(join(projectRoot, marker));
}

export function update(flags = []) {
  const projectRoot = process.cwd();

  console.log(`\n  tcsetup update v${version}\n`);

  // ── Detect installed tools ────────────────────────────
  console.log("  Detecting installed tools...\n");

  const detected = TOOLS.filter((tool) => isInstalled(tool.marker, projectRoot));

  if (detected.length === 0) {
    console.log("  No TC tools detected. Run `npx tcsetup` to onboard first.\n");
    return;
  }

  for (const tool of detected) {
    console.log(`    ✓ ${tool.name}`);
  }
  console.log();

  // ── Update npm packages ───────────────────────────────
  const pkgs = detected.map((t) => `${t.pkg}@latest`).join(" ");
  console.log(`  [1/3] Updating npm packages...`);
  console.log(`  > npm install ${pkgs}\n`);

  try {
    execSync(`npm install ${pkgs}`, { stdio: "inherit" });
    console.log();
  } catch (err) {
    console.error(`\n  ⚠ npm install failed (exit code ${err.status}).`);
    console.error(`  Continuing with sub-tool updates...\n`);
  }

  // ── Call sub-tool updates ─────────────────────────────
  console.log(`  [2/3] Running sub-tool updates...\n`);

  for (const tool of detected) {
    console.log(`  > ${tool.cmd}`);
    try {
      execSync(tool.cmd, { stdio: "inherit" });
      console.log();
    } catch (err) {
      console.error(`\n  ⚠ ${tool.name} update failed (exit code ${err.status}).`);
      console.error(`  Continuing with remaining tools...\n`);
    }
  }

  // ── Refresh tcsetup commands ──────────────────────────
  console.log(`  [3/3] Refreshing tcsetup commands...\n`);

  const commandsSource = join(__dirname, "..", "commands");
  const commandsDest = join(projectRoot, ".claude", "commands");

  mkdirSync(commandsDest, { recursive: true });

  for (const file of COMMAND_FILES) {
    const src = join(commandsSource, file);
    const dest = join(commandsDest, file);
    if (existsSync(src)) {
      copyFileSync(src, dest);
      console.log(`    update .claude/commands/${file}`);
    }
  }
  console.log();

  // ── Summary ───────────────────────────────────────────
  console.log(`  Done! Updated ${detected.length} tool${detected.length === 1 ? "" : "s"}:`);
  for (const tool of detected) {
    console.log(`    - ${tool.name}`);
  }
  console.log();
}
