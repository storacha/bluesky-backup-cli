#!/usr/bin/env node
import { Command } from "commander";
import { authCommands } from "./cli/commands";
import { pdsActions } from "./cli/pds-actions";

const program = new Command().version("0.0.1");
authCommands(program);
pdsActions(program);
program.parse(process.argv);
