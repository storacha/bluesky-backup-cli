#!/usr/bin/env node
import { Command } from "commander";
import { authCommands } from "./cli/commands"

const program = new Command();
program
  .name("bsky-backups")
  .description("CLI tool for backing up Bluesky posts")
  .version("1.0.0");

authCommands(program);
program.parse(process.argv);
