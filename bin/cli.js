#!/usr/bin/env node

import { argv, exit } from "node:process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { install } from "../src/installer.js";
import { update } from "../src/updater.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));

const command = argv[2];
const flags = argv.slice(3);

const HELP = `
tcsetup v${version} — Bootstrap and update the TC toolchain.

Usage:
  npx tcsetup              Run all setup steps (same as init)
  npx tcsetup init         Install the full TC toolchain
  npx tcsetup update       Update all installed TC tools to latest
  npx tcsetup help         Show this help message

Options (init):
  --skip-bmad              Skip BMAD Method install
  --skip-speckit           Skip Spec Kit init
  --skip-agreements        Skip Agreement System init
  --skip-adr              Skip ADR System init
  --skip-mermaid           Skip Mermaid Workbench init
  --skip-lifecycle         Skip Feature Lifecycle Tracker init
  --skip-knowledge         Skip Knowledge System init
  --skip-product           Skip Product Manager init
  --skip-qa                Skip QA System init
  --skip-playbook          Skip Playbook Supervisor init
`;

switch (command) {
  case "init":
    install(flags);
    break;
  case "update":
    update(flags);
    break;
  case "help":
  case "--help":
  case "-h":
    console.log(HELP);
    break;
  case undefined:
    install([]);
    break;
  default:
    // Flags without subcommand (e.g., npx tcsetup --skip-bmad) → treat as init
    if (command.startsWith("-")) {
      install(argv.slice(2));
    } else {
      console.error(`  Unknown command: ${command}\n`);
      console.log(HELP);
      exit(1);
    }
}
