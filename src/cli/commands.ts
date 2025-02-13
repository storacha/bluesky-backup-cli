#!/usr/bin/env node
import chalk from "chalk";
import { BlueskyAuth } from "../auth/bsky";
import { Command } from "commander";

export const authCommands = (program: Command) => {
  program
    .name("bsky-backups")
    .description(chalk.cyan("✨ CLI tool for backing up Bluesky posts ✨"))
    .version("1.0.0");

  program
    .command("login")
    .description("Authenticate with Bluesky")
    .action(async () => {
      try {
        const auth = new BlueskyAuth();
        const session = await auth.login();
        if (session) {
          console.log(
            `Successfully logged in as ${chalk.bgBlueBright(session.handle)}`,
          );
        } else {
          console.log(chalk.red("Login failed. No session returned."));
        }
      } catch (error) {
        console.log((error as Error).message);
      }
    });

  program
    .command("logout")
    .description("Remove stored credentials")
    .action(async () => {
      const auth = new BlueskyAuth();
      auth.logout();
    });

  program.addHelpText(
    "afterAll",
    `\n${chalk.yellow.bold("Examples:")}
    ${chalk.cyan("$ bsky-backups login")}      → Authenticate with Bluesky
    ${chalk.cyan("$ bsky-backups logout")}     → Remove stored credentials

    ${chalk.green("For more details, use:")}
    ${chalk.cyan("$ bsky-backups --help")}`,
  );

  if (!process.argv.slice(2).length) {
    console.log(chalk.red.bold("\nOops! You didn't provide a command.\n"));
    program.outputHelp();
    process.exit(1);
  }
};
