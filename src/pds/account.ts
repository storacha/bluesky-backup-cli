import { AtpAgent } from "@atproto/api";
import { Config, readConfig } from "../utils/config";
import chalk from "chalk";
import { Session } from "../auth/session";
import { decodeCarToJson } from "../utils/decode";

export type AccountCreationPayload = {
  email: string;
  handle: string;
  password: string;
  inviteCode: string;
};

export type AccountAction = "account" | "post" | "posts" | "post-cid";

export type PdsPostRecord = {
  text: string;
  createdAt: string;
};

const errorMessage = (action: AccountAction, error: Error) => {
  switch (action) {
    case "account":
      return `create account ${error.message}`;
    case "post":
      return `create post ${error.message}`;
    case "posts":
      return `get posts ${error.message}`;
    case "post-cid":
      return `get post CID ${error.message}`;

    default:
      return error.message;
  }
};

export class PdsAccountManager {
  private session: Session;
  private config: Config;
  private agent: AtpAgent;
  private collection: string = "app.bsky.feed.post";

  constructor(pdsUrl?: string) {
    this.config = readConfig();
    this.session = new Session(pdsUrl);
    this.agent = this.session.getAgent();

    const configPdsUrl = this.config.pdsUrl;
    if (configPdsUrl && !configPdsUrl.includes("bsky.social")) {
      this.collection = `${new URL(configPdsUrl).hostname}.feed.post`;
    }
  }

  async validatePdsConnection() {
    try {
      const result = await this.agent.com.atproto.server.describeServer();
      return result.data;
    } catch (error) {
      throw new Error(`Failed to connect to PDS: ${(error as Error).message}`);
    }
  }

  async createAccountOnPds(payload: AccountCreationPayload) {
    const { email, handle, password, inviteCode } = payload;

    try {
      await this.validatePdsConnection();
      const request = await this.agent.com.atproto.server.createAccount({
        handle,
        email,
        password,
        inviteCode,
      });

      await this.agent.login({ identifier: handle, password });
      return request.data;
    } catch (error) {
      const err = error as Error;
      if (err.message.includes("email")) {
        const pdsHost = new URL(this.agent.serviceUrl).hostname;
        console.log(
          `${chalk.yellow(`\nEmail error: Try using an email address with the domain ${pdsHost} (e.g., username@${pdsHost})`)}`,
        );
      } else if (err.message.includes("invite")) {
        console.log(
          `${chalk.yellow(`\nInvite code error: The provided code "${inviteCode}" appears to be invalid. Please verify the code or request a new one.`)}`,
        );
      } else {
        console.log(
          `${chalk.red(`Failed to ${errorMessage("account", err)}`)}`,
        );
      }
    }
  }

  async createPostOnPds(text: string, replyTo?: string) {
    try {
      const record: any = {
        text,
        createdAt: new Date().toISOString(),
      };

      if (replyTo) {
        record.reply = {
          root: { uri: replyTo, cid: await this.getPostCid(replyTo) },
          parent: { uri: replyTo, cid: await this.getPostCid(replyTo) },
        };
      }

      const request = await this.agent.com.atproto.repo.createRecord({
        repo: this.agent.session?.did || "",
        collection: this.collection,
        record,
      });
      return request.data;
    } catch (error) {
      throw new Error(`Failed to ${errorMessage("post", error as Error)}`);
    }
  }

  async getPostsFromPds(did: string) {
    try {
      const request = await this.agent.com.atproto.sync.getRepo({ did });
      const data = request.data
      if (!data) throw new Error("Couldn't retrieve CAR data")
      return await decodeCarToJson(data)
    } catch (error) {
      throw new Error(`Failed to ${errorMessage("posts", error as Error)}`);
    }
  }

  async getPostsInCarFormat(did: string) {
    try {
      const request = await this.agent.com.atproto.sync.getRepo({ did });
      return request.data;
    } catch (error) {
      console.error(`Failed to fetch CAR data: ${(error as Error).message}`);
    }
  }

  async getPostCid(uri: string): Promise<string> {
    try {
      const uriParts = uri.replace('at://', '').split('/');

      if (uriParts.length < 3) {
        throw new Error(`Invalid URI format: ${uri}`);
      }

      const repo = uriParts[0];
      const collection = uriParts[1];
      const rkey = uriParts[2];
      const request = await this.agent.com.atproto.repo.getRecord({
        repo,
        collection,
        rkey
      });

      if (!request.data || !request.data.cid) {
        throw new Error(`Record exists but CID not found for: ${uri}`);
      }

      return request.data.cid as string;
    } catch (error) {
      const errorMsg = (error as Error).message;
      if (errorMsg.includes("Could not locate record")) {
        throw new Error(`Post not found: ${uri}. Make sure the post exists and you have permission to view it.`);
      }
      throw new Error(`Failed to get ${errorMessage("post-cid", error as Error)}`);
    }
  }
}
