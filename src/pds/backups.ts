import chalk from "chalk";
import { BlueskyAuth } from "../auth/bsky";
import { StorachaAuth } from "../auth/storacha";
import { Config, readConfig, writeConfig } from "../utils/config";
import { PdsAccountManager } from "./account";
import inquirer from "inquirer";
import ora, { Ora } from "ora";
import { Record } from "@atproto/api/dist/client/types/com/atproto/repo/listRecords";
import path from "node:path";
import fs from "node:fs";
import { homedir } from "node:os";
import * as Client from "@web3-storage/w3up-client";

export class BackupManager {
  private blueskyAuth: BlueskyAuth;
  private storachaAuth: StorachaAuth;
  private pdsManager: PdsAccountManager;
  private config: Config;

  constructor() {
    this.blueskyAuth = new BlueskyAuth();
    this.pdsManager = new PdsAccountManager();
    this.storachaAuth = new StorachaAuth();
    this.config = readConfig();
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

    try {
      const { dataType } = await inquirer.prompt([
        {
          type: "list",
          name: "dataType",
          choices: [
            { name: "CAR", value: "car" },
            { name: "JSON", value: "json" },
          ],
          default: "car",
          message: "How do you want this data stored?",
        },
      ]);

      writeConfig({
        ...this.config,
        dataType,
      });

      let backupPath: string = "";
      let spinner: Ora | null = null;

      if (dataType === "json") {
        spinner = ora("Retrieving your posts...").start();

        try {
          const config = readConfig();
          const did: string = config.bluesky?.did || ""
          const posts = await this.pdsManager.getPostsFromPds(did);
          spinner.succeed(
            `Retrieved ${posts.length} post${posts.length > 1 ? "s" : ""} from Bluesky`,
          );
          backupPath = await this.savePostsToFile(posts);
        } catch (error) {
          spinner?.fail("Failed to retrieve posts");
          console.error("Error", error);
          throw error;
        }
      } else {
        spinner = ora("Retrieving repository data...").start();
        try {
          const config = readConfig();
          const did = config.bluesky?.did;
          if (!did) throw new Error("No DID found in config");

          const data = await this.pdsManager.getPostsInCarFormat(did);
          spinner.succeed(
            `Retrieved ${this.formatFileSize(Number(data?.length))} CAR data`,
          );
          backupPath = await this.saveCarToFile(
            data as Uint8Array<ArrayBufferLike>,
          );
        } catch (error) {
          spinner?.fail("Failed to retrieve CAR data");
          throw error;
        }
      }

      const { uploadToStoracha } = await inquirer.prompt([
        {
          type: "confirm",
          name: "uploadToStoracha",
          default: true,
          message: "Do you want to upload your backup to storacha?",
        },
      ]);

      if (uploadToStoracha) {
        await this.uploadToStoracha(backupPath, dataType);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async uploadToStoracha(
    filePath: string,
    dataType: "json" | "car",
  ): Promise<void> {
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
      const blob = new Blob([fileContent], {
        type:
          dataType === "json" ? "application/json" : "application/vnd.ipld.car",
      });
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

  private async savePostsToFile(posts: any[]): Promise<string> {
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
        posts: posts
      };

      if (posts.length > 0) {
        fs.writeFileSync(backupPath, JSON.stringify(fileContent, null, 2));
        spinner.succeed(
          `Saved data to ${backupPath}`,
        );
      } else {
        spinner.succeed(`Skipping local backup. No posts found`);
        process.exit(1);
      }
      return backupPath;
    } catch (error) {
      spinner.fail(`Failed to save data: ${(error as Error).message}`);
      throw error;
    }
  }

  private async saveCarToFile(data: Uint8Array): Promise<string> {
    const spinner = ora("Saving CAR file...").start();

    try {
      const backupDir = path.join(homedir(), "bsky-backup");
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(backupDir, `bluesky-posts-${timestamp}.car`);

      fs.writeFileSync(backupPath, Buffer.from(data));
      spinner.succeed(`Backup saved to: ${chalk.cyan(backupPath)}`);
      return backupPath;
    } catch (error) {
      spinner.fail("Failed to save file");
      throw error;
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KiB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  async uploadExistingBackup(dataType: "json" | "car"): Promise<void> {
    const backupDir = path.join(homedir(), "bsky-backup");

    if (!fs.existsSync(backupDir)) {
      console.log(chalk.yellow("No backup directory found"));
      return;
    }

    const files = fs
      .readdirSync(backupDir)
      .filter((file) => file.endsWith("json") || file.endsWith("car"))
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
    await this.uploadToStoracha(filePath, dataType);
  }
}
