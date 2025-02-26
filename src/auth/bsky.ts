import { Config, readConfig, writeConfig } from "../utils/config";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { Session } from "./session";

export class BlueskyAuth {
  private session: Session;
  private config: Config;
  private serviceUrl?: string;

  constructor(serviceUrl?: string) {
    this.serviceUrl = serviceUrl;
    this.config = readConfig();

    let validServiceUrl = serviceUrl;
    if (!validServiceUrl || validServiceUrl === "undefined")
      validServiceUrl =
        this.config.pdsUrl || "https://atproto.storacha.network";

    this.serviceUrl = validServiceUrl;
    this.session = new Session(this.serviceUrl);
  }

  async validatePdsConnection(): Promise<void> {
    const agent = this.session.getAgent();

    try {
      await agent.com.atproto.server.describeServer();
    } catch (error) {
      console.log(
        chalk.red(
          `\nUnable to connect to PDS at ${agent.serviceUrl.toString()}`,
        ),
      );

      const newPds = await this.promptForPds();
      await this.updatePds(newPds);
    }
  }

  private async promptForPds(): Promise<string> {
    const { pds } = await inquirer.prompt({
      type: "input",
      name: "pds",
      message: "Enter PDS URL (must start with https://):",
      validate: (input) =>
        input.startsWith("https://") || "URL must start with https://",
    });

    return pds;
  }

  private async updatePds(newUrl: string): Promise<void> {
    this.session = new Session(newUrl);
    writeConfig({ ...this.config, pdsUrl: newUrl });

    try {
      await this.session.getAgent().com.atproto.server.describeServer();
    } catch (error) {
      console.log(chalk.red(`Still can't connect to ${newUrl}`));
      return this.updatePds(await this.promptForPds());
    }
  }

  async getPdsUrl(): Promise<string> {
    if (this.config.pdsUrl) return this.config.pdsUrl;

    const { pds } = await inquirer.prompt([
      {
        type: "input",
        name: "pds",
        message: "Enter PDS URL",
        validate: (input) =>
          input.startsWith("https://") || "PDS URL must start with https://",
      },
    ]);

    writeConfig({
      ...this.config,
      pdsUrl: pds,
    });

    return pds;
  }

  async login() {
    await this.validatePdsConnection();
    const agent = this.session.getAgent();
    const pdsUrl = new URL(agent.serviceUrl);

    const { identifier, password } = await inquirer.prompt([
      {
        type: "input",
        name: "identifier",
        message: `Enter your bluesky handle (e.g. user.${new URL(pdsUrl).hostname}):`,
        validate: (input: string) => {
          const host = new URL(pdsUrl).hostname;
          return input.endsWith(host) || input.includes(".")
            ? true
            : `Handle should be in format: user.${host}`;
        },
      },
      {
        type: "password",
        name: "password",
        message: "Enter your Bluesky app password:",
        mask: true,
      },
    ]);

    const spinner = ora("Logging in...").start();
    try {
      const session = await agent.login({ identifier, password });
      await this.session.saveSession(session.data);
      spinner.succeed(`Successfully logged in as ${session.data.handle}`);
      return true;
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
          chalk.bgBlue(`user.${new URL(pdsUrl).hostname}`) +
          ")",
      );
      console.log(
        chalk.yellow("  3.") +
          " Check account status at: " +
          chalk.blue("https://bsky.app/settings"),
      );
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
        choices: accounts.map((account) => `${account.handle} (${account.did})`),
      },
    ]);
    await this.session.clearSession(did);
  }
}
