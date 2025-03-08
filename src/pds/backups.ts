import chalk from "chalk";
import { BlueskyAuth } from "../auth/bsky";
import { StorachaAuth } from "../auth/storacha";
import { readConfig } from "../utils/config";
import { PdsAccountManager } from "./account";
import inquirer from "inquirer";
import ora from "ora";
import { Record } from "@atproto/api/dist/client/types/com/atproto/repo/listRecords";
import path from "node:path";
import fs from "node:fs";
import { homedir } from "node:os";
import * as Client from "@web3-storage/w3up-client"

export class BackupManager {
  private blueskyAuth: BlueskyAuth;
  private storachaAuth: StorachaAuth;
  private pdsManager: PdsAccountManager;

  constructor() {
    this.blueskyAuth = new BlueskyAuth();
    this.pdsManager = new PdsAccountManager();
    this.storachaAuth = new StorachaAuth();
  }
  // we should check if there's any session in the config
  async validateLogin() {
    const config = readConfig();
    if (!config.accounts || !config.bluesky || config.accounts.length === 0) {
      console.log(chalk.yellow("You need to login to Bluesky first"));
      await this.blueskyAuth.login();
      return false;
    }
    return true;
  }

  async backupPosts(): Promise<void> {
    if (!(await this.validateLogin())) return;

    const { limit } = await inquirer.prompt([
      {
        type: "number",
        name: "limit",
        message: "How many posts do you want to backup?",
        default: 50,
      },
    ]);

    const spinner = ora("Retrieving your posts...").start();
    try {
      const posts = await this.pdsManager.getPostsFromPds(limit);
      spinner.succeed(
        `Retrieved ${posts.length} post${posts.length > 1 ? "s" : ""} from Bluesky`,
      );

      const backupPath = await this.savePostsToFile(posts);

      const { uploadToStoracha } = await inquirer.prompt([
        {
          type: "confirm",
          name: "uploadToStoracha",
          default: true,
          message: "Do you want to upload your backup to storacha?",
        },
      ]);

      if (uploadToStoracha) {
        await this.uploadToStoracha(backupPath);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async uploadToStoracha(filePath: string): Promise<void> {
    const spinner = ora("Establishing connection with Storacha...").start();
    spinner.color = "red";

    try {
      const client = await Client.create();
      const account = await this.storachaAuth.login();
      if (!client) {
        spinner.fail("Failed to establish connection.");
        return;
      }
      spinner.succeed("Connection established");

      const space = await this.storachaAuth.selectSpace(client, account);
      spinner.start("Setting up storage space...");
      if (!space) {
        spinner.fail("Failed to select or create a storage space");
        return;
      }
      spinner.succeed("Storage space ready");

      spinner.start(`Uploading backup from ${filePath}...`);

      const fileName = path.basename(filePath);
      const fileContent = fs.readFileSync(filePath);

      // create a blob from the file so we can make it compatible with what
      // w3up-client accepts. a `File` too is accpetable though
      const blob = new Blob([fileContent], { type: "application/json" });
      const fileObject = { name: fileName, blob };

      // we should obtain a content identtfier here
      const cid = await client.uploadFile({
        ...fileObject,
        stream: () => blob.stream(),
      });

      spinner.succeed("Backup uploaded successfully!");
      console.log(chalk.green(`\nBackup details:`));
      console.log(chalk.white(`  IPFS CID: ${cid}`));
      console.log(chalk.white(`  Gateway URL: https://w3s.link/ipfs/${cid}`));
      console.log(
        chalk.cyan("\nYou can access your file using the Gateway URL"),
      );
    } catch (error) {
      spinner.fail(`Upload failed: ${(error as Error).message}`);
      console.log(chalk.yellow("\nYour backup is still saved locally."));
    }
  }

  private async savePostsToFile(posts: Record[]): Promise<string> {
    const spinner = ora("Saving posts to local file...").start();

    try {
      const backupDir = path.join(homedir(), "bsky-backup");
      if (!fs.existsSync(backupDir))
        fs.mkdirSync(backupDir, { recursive: true });

      const dateCreated = new Date()
        .toISOString()
        .replace(/:/g, "-")
        .split(".")[0];
      const backupPath = path.join(
        backupDir,
        `bluesky-posts-${dateCreated}.json`,
      );

      const fileContent = {
        backupDate: new Date().toISOString(),
        postCount: posts.length,
        posts: posts.map((post) => ({
          uri: post.uri,
          cid: post.cid,
          // these values, `text` and `createdAt` exists.
          // the Record type from atproto/repo/listRecords doesn't just provide a type for them.
          // instead a verbose `value: {}` is used.
          // @ts-ignore
          text: post.value.text,
          // @ts-ignore
          createdAt: post.value.createdAt,
        })),
      };

      if (posts.length > 0) {
        fs.writeFileSync(backupPath, JSON.stringify(fileContent, null, 2));
        spinner.succeed(
          `Saved ${posts.length} post${posts.length > 1 ? "s" : ""} to ${backupPath}`,
        );
      } else {
        spinner.succeed(`Skipping local backup. No posts found`);
        process.exit(1);
      }
      return backupPath;
    } catch (error) {
      spinner.fail(`Failed to save posts: ${(error as Error).message}`);
      throw error;
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KiB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  async uploadExistingBackup(): Promise<void> {
    const backupDir = path.join(homedir(), "bsky-backup");

    if (!fs.existsSync(backupDir)) {
      console.log(chalk.yellow("No backup directory found"));
      return;
    }

    const files = fs
      .readdirSync(backupDir)
      .filter((file) => file.endsWith("json"))
      .sort()
      .reverse();

    if (files.length === 0) {
      console.log(chalk.yellow("No backup files found."));
      return;
    }

    const { selectedFile } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedFile",
        message: "Select a backup file to upload:",
        choices: files.map((file) => ({
          name: `${file} (${this.formatFileSize(fs.statSync(path.join(backupDir, file)).size)})`,
          value: file,
        })),
      },
    ]);

    const filePath = path.join(backupDir, selectedFile);
    await this.uploadToStoracha(filePath);
  }
}
