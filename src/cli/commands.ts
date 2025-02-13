#!/usr/bin/env node
import { BlueskyAuth } from "../auth/bsky";
import { Command } from "commander";

export const authCommands = (program: Command) => {
  program
    .command("login")
    .description("Authenticate with Bluesky")
    .action(async () => {
      try {
        const auth = new BlueskyAuth();
        const session = await auth.login();
        if (session) {
          console.log(`Successfully logged in as ${session?.handle}`);
        }
      } catch (error) {
        console.error(`${(error as Error).message}`);
        process.exit(1);
      }
    });

  program
    .command("logout")
    .description("Remove stored credentials")
    .action(async () => {
      const auth = new BlueskyAuth();
      auth.logout();
    });
};
