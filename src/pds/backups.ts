import { BlueskyAuth } from "../auth/bsky";
import { StorachaAuth } from "../auth/storacha";
import { PdsAccountManager } from "./account";

export class BackupManager {
  private blueskyAuth: BlueskyAuth;
  private storachaAuth: StorachaAuth;
  private pdsManager: PdsAccountManager;
}
