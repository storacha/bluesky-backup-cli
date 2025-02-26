#!/usr/bin/env node
import chalk from "chalk";
import { BlueskyAuth } from "../auth/bsky";
import { Command } from "commander";
import { readConfig } from "../utils/config";

export const authCommands = (program: Command) => {
  program
    .name("bb")
    .description(chalk.cyan("✨ CLI tool for backing up Bluesky posts ✨"));
  const config = readConfig();

  program
    .command("login")
    .description("Authenticate with Bluesky")
    .option("--pds <url>", "Custom PDS URL", config.pdsUrl)
    .action(async (options) => {
      try {
        const auth = new BlueskyAuth(options.pds);
        await auth.login();
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
    ${chalk.cyan("$ bb login")}                          → Authenticate with Bluesky
    ${chalk.cyan("$ bb logout")}                         → Remove stored credentials
    ${chalk.cyan("$ bb admin create-account")}           → If you want to create an account on your PDS
    ${chalk.cyan("$ bb test create-post")}               → Create a test post or multiple test posts on your PDS. You also have the option to replying to a post
    ${chalk.cyan("$ bb test list-post")}                 → List test posts on your PDS

    ${chalk.green("For more details, use:")}
    ${chalk.cyan("$ bb --help")}`,
  );

  if (!process.argv.slice(2).length) {
    console.log(chalk.red.bold("\nOops! You didn't provide a command.\n"));
    program.outputHelp();
    process.exit(1);
  }
};
