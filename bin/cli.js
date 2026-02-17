#!/usr/bin/env node

import { execSync } from "node:child_process";
import { argv } from "node:process";

const flags = argv.slice(2);

const HELP = `
tcsetup — Bootstrap a project with the full TC toolchain.

Usage:
  npx tcsetup              Run all setup steps
  npx tcsetup help         Show this help message

Options:
  --skip-bmad              Skip BMAD Method install
  --skip-speckit           Skip Spec Kit init
  --skip-agreements        Skip Agreement System init
  --skip-adr              Skip ADR System init
  --skip-mermaid           Skip Mermaid Workbench init
  --skip-lifecycle         Skip Feature Lifecycle Tracker init
`;

if (flags.includes("help") || flags.includes("--help") || flags.includes("-h")) {
  console.log(HELP);
  process.exit(0);
}

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
];

console.log("\n  tcsetup v1.0.0\n");

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

console.log("  Done! Project setup complete.\n");
