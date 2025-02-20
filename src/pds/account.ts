import { AtpAgent } from "@atproto/api";
import { readConfig } from "../utils/config";

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
  private agent: AtpAgent;
  private pdsUrl: string;

  constructor(pdsUrl?: string) {
    const config = readConfig();
    this.pdsUrl = pdsUrl || config.pdsUrl || "https://bsky.social";
    this.agent = new AtpAgent({ service: this.pdsUrl });
  }

  async createAccountOnPds(payload: AccountCreationPayload) {
    const { email, handle, password, inviteCode } = payload;

    try {
      const request = await this.agent.com.atproto.server.createAccount({
        handle,
        email,
        password,
        inviteCode
      });
      return request.data;
    } catch (error) {
      throw new Error(`Failed to ${errorMessage("account", error as Error)}`);
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
        collection: "app.bsky.feed.post",
        record,
      });
      return request.data;
    } catch (error) {
      throw new Error(`Failed to ${errorMessage("post", error as Error)}`);
    }
  }

  async getPostsFromPds(limit?: number) {
    try {
      const request = await this.agent.com.atproto.repo.listRecords({
        limit: limit || 50,
        repo: this.agent.session?.did || "",
        collection: "app.bsky.feed.post",
      });
      return request.data.records;
    } catch (error) {
      throw new Error(`Failed to ${errorMessage("posts", error as Error)}`);
    }
  }

  async getPostCid(uri: string): Promise<string> {
    try {
      const [repo, rkey] = uri.split("/").slice(-2);
      const request = await this.agent.com.atproto.repo.getRecord({
        repo,
        rkey,
        collection: "app.bsky.feed.post",
      });

      // now we can return the content identifier when it is founf
      return request.data.cid as string;
    } catch (error) {
      throw new Error(
        `Failed to get ${errorMessage("post-cid", error as Error)}`,
      );
    }
  }
}
