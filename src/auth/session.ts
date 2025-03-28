import chalk from "chalk";
import Agent, { CredentialSession } from "@atproto/api";
import { Account, Config, readConfig, writeConfig } from "../utils/config";
import keytar from "keytar";

const SERVICE_NAME = "bsky-backup-cli";

export class Session {
  private agent: Agent;
  private config: Config;

  constructor(pdsUrl?: string) {
    this.config = readConfig();
    const serviceUrl =
      pdsUrl || this.config.pdsUrl || "https://bsky.social";

    try {
      const session = new CredentialSession(new URL(serviceUrl));
      this.agent = new Agent(session);
      this.resumeSession();
    } catch (error) {
      console.error(`Invalid PDS URL: ${serviceUrl}`);
      throw new Error(
        `Cannot create session with invalid PDS URL: ${serviceUrl}`,
      );
    }
  }

  private resumeSession() {
    if (this.config.bluesky?.accessJwt && this.config.bluesky.did) {
      this.agent
        .resumeSession({
          did: this.config.bluesky.did,
          handle: String(this.config.bluesky.handle),
          accessJwt: String(this.config.bluesky.accessJwt),
          refreshJwt: String(this.config.bluesky.refreshJwt),
          active: Boolean(this.config.bluesky.active),
        })
        .catch((error) => {
          // console.log(`${chalk.yellow(`Error resuming session:`, error)}`);
        });
    }
  }

  async saveSession(session: {
    did: string;
    handle: string;
    accessJwt: string;
    refreshJwt: string;
  }) {
    await keytar.setPassword(SERVICE_NAME, session.did, session.refreshJwt);

    writeConfig({
      ...this.config,
      accounts: [
        ...this.config.accounts,
        {
          did: session.did,
          handle: session.handle,
          serviceUrl: this.agent.serviceUrl.toString()
        },
      ],
      pdsUrl: this.agent.serviceUrl.toString(),
      bluesky: { ...session },
    });
  }

  async clearSession(did: string) {
    await keytar.deletePassword(SERVICE_NAME, did);
    writeConfig({
      ...this.config,
      bluesky: undefined,
      accounts: this.config.accounts.filter((d: Account) => d.did !== did),
    });
    console.log(`Logged out of ${did}`);
  }

  getAgent() {
    return this.agent;
  }
}
