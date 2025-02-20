#!/usr/bin/env node
import chalk from "chalk";
import { BlueskyAuth } from "../auth/bsky";
import { Command } from "commander";

export const authCommands = (program: Command) => {
  program
    .name("bsky-backup")
    .description(chalk.cyan("✨ CLI tool for backing up Bluesky posts ✨"))

  program
    .command("login")
    .description("Authenticate with Bluesky")
    .option("--pds <url>", "Custom PDS URL", "https://bksy.social")
    .action(async (options) => {
      try {
        const auth = new BlueskyAuth(options.pds);
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
    ${chalk.cyan("$ bsky-backup login")}          → Authenticate with Bluesky
    ${chalk.cyan("$ bsky-backup logout")}         → Remove stored credentials
    ${chalk.cyan("$ bsky test create-account")}   → If you want to create an account on your PDS
    ${chalk.cyan("$ bsky test create-post")}      → Create a test post or multiple test posts on your PDS. You also have the option to replying to a post
    ${chalk.cyan("$ bsky test list-post")}        → List test posts on your PDS

    ${chalk.green("For more details, use:")}
    ${chalk.cyan("$ bsky-backup --help")}`,
  );

  if (!process.argv.slice(2).length) {
    console.log(chalk.red.bold("\nOops! You didn't provide a command.\n"));
    program.outputHelp();
    process.exit(1);
  }
};
