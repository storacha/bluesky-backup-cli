import { Command } from "commander";
import { BackupManager } from "../pds/backups";
import chalk from "chalk";
import { StorachaAuth } from "../auth/storacha";
import * as Client from "@web3-storage/w3up-client"
import { readConfig } from "../utils/config";

export const backupCommands = (program: Command) => {
  const backup = program
    .command("backup")
    .description("Backup and restore your Bluesky posts");

  backup
    .command("posts")
    .description("Backup your Bluesky posts")
    .action(async () => {
      try {
        const manager = new BackupManager();
        await manager.backupPosts();
      } catch (error) {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  backup
    .command("upload")
    .description("Upload an existing backup to Storacha")
    .action(async () => {
      try {
        const config = readConfig()
        const manager = new BackupManager();
        await manager.uploadExistingBackup(config.dataType || "car");
      } catch (error) {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  program
    .command("storacha")
    .description("Validate Storacha integration")
    .action(async () => {
      try {
        const storacha = new StorachaAuth();

        const client = await Client.create();
        const account = await storacha.login();
        await storacha.selectSpace(client, account);
        console.log(chalk.green("\nStoracha connection is working!"));
      } catch (error) {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  program.addHelpText(
      "afterAll",
      `\n${chalk.yellow.bold("Additional Examples:")}
      ${chalk.cyan("$ bb backup posts")}         → Backup your Bluesky posts
      ${chalk.cyan("$ bb backup upload")}        → Upload an existing backup to Storacha
      ${chalk.cyan("$ bb storacha")}             → Test your Storacha connection`,
    );
};
