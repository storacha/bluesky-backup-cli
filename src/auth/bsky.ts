import keytar from "keytar";
import { AtpAgent } from "@atproto/api";
import { readConfig, writeConfig } from "../utils/config";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";

const SERVICE_NAME = "bsky-backup-cli";

export class BlueskyAuth {
  private agent: AtpAgent;
  private serviceUrl: string;

  constructor(serviceUrl?: string) {
    const config = readConfig();
    this.serviceUrl = serviceUrl || config.pdsUrl || "https://bsky.social";
    this.agent = new AtpAgent({ service: this.serviceUrl });

    // we should verify the PDS conncetion at this point
    // if the --pds flag was used
    this.agent.com.atproto.server.describeServer().catch(() => {
      throw new Error(`Unable to connect to PDS at ${this.serviceUrl}`)
    })
  }

  async login() {
    const { identifier, password } = await inquirer.prompt([
      {
        type: "input",
        name: "identifier",
        message: `Enter your bluesky handle (e.g. user.${new URL(this.serviceUrl).hostname}):`,
        validate: (input: string) => {
          const host = new URL(this.serviceUrl).hostname;
          return input.endsWith(host) || input.includes(".")
            ? true
            : `Handle should be in format: user.${host}`;
        },
      },
      {
        type: "password",
        name: "password",
        message: "Enter your Bluesky app password:",
      },
    ]);

    const spinner = ora("Logging in...").start();
    try {
      const session = await this.agent.login({ identifier, password });

      await keytar.setPassword(
        SERVICE_NAME,
        session.data.did,
        session.data.refreshJwt,
      );

      const config = readConfig();
      writeConfig({
        ...config,
        accounts: [...new Set([...config.accounts, session.data.did])],
      });

      spinner.succeed(`Successfully logged in as ${session.data.handle}`);
      return session.data;
    } catch (error) {
      spinner.fail(`Authentication failed: ${(error as Error).message}`);
      console.log(chalk.yellow("  Troubleshooting:"));
      console.log(
        chalk.yellow("  1.") +
          " Ensure you're using an app password, not your main account password",
      );
      console.log(
        chalk.yellow("  2.") +
          " Verify your handle format (e.g., " +
          chalk.bgBlue(`user.${this.serviceUrl}`) +
          ")",
      );
      console.log(
        chalk.yellow("  3.") +
          " Check account status at: " +
          chalk.blue("https://bsky.app/settings"),
      );
      throw error;
    }
  }

  async logout() {
    const config = readConfig();
    const accounts = config.accounts || [];
    if (accounts.length === 0) {
      console.log("No active sessions found");
      return;
    }

    const { did } = await inquirer.prompt([
      {
        type: "list",
        name: "did",
        message: "Select account to logout:",
        choices: accounts,
      },
    ]);

    await keytar.deletePassword(SERVICE_NAME, did);
    writeConfig({
      ...config,
      accounts: config.accounts.filter((d: string) => d !== did),
    });
    console.log(`Logged out of ${did}`);
  }
}
