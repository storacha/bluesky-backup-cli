import * as Client from "@web3-storage/w3up-client";
import { Config, readConfig, writeConfig } from "../utils/config";
import inquirer from "inquirer";
import ora from "ora";
import chalk from "chalk";
import { OwnedSpace, Space } from "@web3-storage/w3up-client/dist/src/space";
import * as Account from "@web3-storage/w3up-client/account";
import * as Result from "@web3-storage/w3up-client/result";

export class StorachaAuth {
  private config: Config;

  constructor() {
    this.config = readConfig();
  }

  async login(): Promise<Account.Account> {
    let email = this.config.storacha?.email;
    if (!email || !email.includes('@')) {
      const response = await inquirer.prompt([
        {
          type: "input",
          name: "email",
          message: "Enter your Storacha email:",
          validate: (input) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(input)) {
              return "Please enter a valid email address";
            }
            return true;
          },
        },
      ]);
      email = response.email;
    }

    const spinner = ora(`🐔 Please Check the email we sent to ${chalk.red(email)} to authorize Storacha`).start()
    spinner.color = "red";

    try {
      const client = await Client.create();
      const loginResult = await Account.login(client, email as `${string}@${string}`);
      if (!loginResult.ok) {
        throw new Error('Login failed');
      }

      writeConfig({
        ...this.config,
        storacha: {
          ...this.config.storacha,
          email: email as `${string}@${string}`,
        },
      });

      spinner.succeed(`Successfully logged in to Storacha with ${email}`);
      return loginResult.ok as Account.Account;
    } catch (error) {
      spinner.fail(`Login failed: ${(error as Error).message}`);
      console.log(chalk.yellow(" Troubleshooting:"));
      console.log(chalk.yellow(" 1.") + " Check your internet connection");
      console.log(chalk.yellow(" 2.") + " Verify your email is registered with Storacha");
      console.log(chalk.yellow(" 3.") + " Make sure you clicked the verification link");
      throw error;
    }
  }

  async createStorachaSpace(
    client: Client.Client,
    account: Account.Account,
  ): Promise<OwnedSpace | undefined> {
    const { spaceName } = await inquirer.prompt([
      {
        type: "input",
        name: "spaceName",
        message: "Enter a name for your Storacha space",
        validate: (input) => input.trim().length > 0 || "Space name cannot be blank",
      },
    ]);

    const spinner = ora(`Creating "${spaceName}"...`).start();
    spinner.color = "red";

    try {
      const space = await client.createSpace(spaceName, { account });
      await client.setCurrentSpace(space.did());
      spinner.succeed(`Successfully created "${spaceName}"`);
      return space;
    } catch (error) {
      spinner.fail(`Failed to create space: ${(error as Error).message}`);
      return undefined;
    }
  }

  async listSpaces(client: Client.Client): Promise<OwnedSpace[] | Space[]> {
    const spinner = ora("Retrieving your spaces...").start();
    spinner.color = "red";

    try {
      const spaces = client.spaces();
      spinner.succeed(
        `Found ${spaces.length} space${spaces.length > 1 ? "s" : ""}`,
      );
      return spaces;
    } catch (error) {
      spinner.fail(`Failed to get spaces: ${(error as Error).message}`);
      return [];
    }
  }

  async selectSpace(
    client: Client.Client,
    account: Account.Account,
  ): Promise<OwnedSpace | undefined> {
    const spaces = await this.listSpaces(client);

    if (spaces.length === 0) {
      console.log(chalk.yellow("No spaces found. Let's create one"));
      return this.createStorachaSpace(client, account);
    }

    const { spaceOption } = await inquirer.prompt([
      {
        type: "list",
        name: "spaceOption",
        message: "Select a space or create a new one:",
        choices: [
          ...spaces.map((space) => ({
            name: space.name || `${space.did().slice(0, 16)}...`,
            value: space.did(),
          })),
          {
            name: "Create a new space",
            value: "new",
          },
        ],
      },
    ]);

    if (spaceOption === "new") {
      return this.createStorachaSpace(client, account);
    }

    const selectedSpace = spaces.find((space) => space.did() === spaceOption);
    if (selectedSpace) {
      await client.setCurrentSpace(selectedSpace.did());
      console.log(
        chalk.green(
          `Selected space: ${selectedSpace.name || selectedSpace.did()}`,
        ),
      );
    }

    return selectedSpace as OwnedSpace;
  }
}
