#!/usr/bin/env node
import { Command } from "commander";
import { authCommands } from "./cli/commands"

const program = new Command();
authCommands(program);
program.parse(process.argv);
