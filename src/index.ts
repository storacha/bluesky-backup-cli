#!/usr/bin/env node
import { Command } from "commander";
import { authCommands } from "./cli/commands";
import { pdsActions } from "./cli/pds-actions";
import { backupCommands } from "./cli/backup";

const program = new Command().version("0.0.1");
authCommands(program);
pdsActions(program);
backupCommands(program);
program.parse(process.argv);

process.on("uncaughtException", (error) => {
  if (error instanceof Error && error.name === "ExitPromptError") {
    console.log("👋 until next time!");
  } else {
    throw error;
  }
});
