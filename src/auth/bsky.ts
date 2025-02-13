import keytar from "keytar";
import { AtpAgent, AtpSessionData } from "@atproto/api";
import { readConfig, writeConfig } from "../utils/config";
import inquirer from "inquirer";

const SERVICE_NAME = "bsky-backups-cli";

export class BlueskyAuth {
  private agent = new AtpAgent({ service: "https://bsky.social" });

  async login() {
    const { identifier, password } = await inquirer.prompt([
      {
        type: "input",
        name: "identifier",
        message: "Enter your bluesky handle (e.g. kaf-lamed.bsky.social):",
      },
      {
        type: "password",
        name: "password",
        message: "Enter your Bluesky app password:",
      },
    ]);

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

      return session.data;
    } catch (error) {
      console.error(`Authentication failed: ${(error as Error).message}`);
      console.log(`
        Troubleshooting:
        1. Ensure you're using an app password, not your main account password
        2. Verify your handle format (kaf-lamed.bsky.social)
        3. Check account status at https://bsky.app/settings`);
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
