import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { PdsAccountManager } from "../pds/account";
import { BlueskyAuth } from "../auth/bsky";
import { readConfig } from "../utils/config";

export const pdsActions = (program: Command) => {
  const bluesky = new BlueskyAuth();
  const manager = new PdsAccountManager();

  const test = program
    .command("admin")
    .description("Carry out admin-related actions on your PDS");

  test
    .command("create-account")
    .description("Create a test account on a development PDS")
    .action(async () => {
      try {
        const pds = await bluesky.getPdsUrl();
        const spinner = ora("Validating PDS connection...").start();
        await manager.validatePdsConnection();
        spinner.succeed("PDS connection validated");

        const pdsHost = new URL(pds).hostname;

        const answers = await inquirer.prompt([
          {
            type: "input",
            name: "handle",
            message: "Enter test account handle:",
            default: `test.${pdsHost}`,
            validate: (input) => {
              if (!input.endsWith(pdsHost)) {
                return `Handle must end with ${pdsHost}`;
              }
              return true;
            },
          },
          {
            type: "input",
            name: "email",
            message: "Enter test email address:",
            default: `test@${pdsHost}`,
            validate: (input) => {
              if (!input.includes("@"))
                return "Please enter a valid email address";
              const emailDomain = input.split("@")[1];
              if (emailDomain !== pdsHost) {
                return `Warning: This PDS might require an email with domain ${pdsHost}. Continue?`;
              }
              return true;
            },
          },
          {
            type: "password",
            name: "password",
            message: "Enter test account password:",
            mask: true,
            validate: (input) =>
              input.length >= 8 || "Password must be at least 8 characters",
          },
          {
            type: "input",
            name: "inviteCode",
            message: "Enter PDS invite code:",
            validate: (input) => input.length > 0 || "Invite code is required",
          },
        ]);

        spinner.start("Creating test account...");
        const account = await manager.createAccountOnPds({
          email: answers.email,
          handle: answers.handle,
          password: answers.password,
          inviteCode: answers.inviteCode,
        });
        if (account) {
          spinner.succeed(`Created test account: ${account}`);
          console.log(chalk.green("\nTest account created successfully!"));
          await showTestMenu(pds);
        } else {
          spinner.info(`Unable to create account`);
          process.exit(1);
        }
      } catch (error) {
        const errorMessage = (error as Error).message;
        console.error(chalk.red(`\nError: ${errorMessage}`));

        if ((error as Error).message.includes("invite")) {
          console.log(chalk.yellow("\nAbout invite codes:"));
          console.log(
            "1. Invite codes are required by PDS instances to control account creation",
          );
          console.log(
            "3. Contact your PDS administrator for a new invite code",
          );
        }
      }
    });

  test
    .command("create-post")
    .description("Create test posts on your development PDS")
    .action(async () => {
      try {
        await bluesky.getPdsUrl();

        const { postType } = await inquirer.prompt([
          {
            type: "list",
            name: "postType",
            message: "What type of test posts would you like to generate?",
            choices: [
              { name: "Single test post", value: "single" },
              { name: "Reply to another post", value: "reply" },
            ],
          },
        ]);

        if (postType === "single") {
          const { text } = await inquirer.prompt([
            {
              type: "input",
              name: "text",
              message: "Enter test post content:",
              validate: (input) =>
                input.length > 0 || "Post content cannot be empty",
            },
          ]);

          const spinner = ora("Creating test post...").start();
          const post = await manager.createPostOnPds(text);
          spinner.succeed("Test post created successfully!");
          console.log(chalk.green("\nPost details:"));
          console.log(chalk.white(`  URI: ${post.uri}`));
          console.log(chalk.white(`  Text: ${text}`));
        } else if (postType === "reply") {
          const { uri, text } = await inquirer.prompt([
            {
              type: "input",
              name: "uri",
              message: "Enter the URI of the post to reply to:",
              validate: (input) =>
                input.startsWith("at://") || "URI must start with at://",
            },
            {
              type: "input",
              name: "text",
              message: "Enter test reply content:",
              validate: (input) => input.length > 0 || "Reply cannot be empty",
            },
          ]);

          const spinner = ora("Creating test reply...").start();
          const post = await manager.createPostOnPds(text, uri);
          spinner.succeed("Test reply created successfully!");
          console.log(chalk.green("\nReply details:"));
          console.log(chalk.white(`  URI: ${post.uri}`));
          console.log(chalk.white(`  Text: ${text}`));
        }
      } catch (error) {
        console.error(chalk.red(`\nError: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  test
    .command("list-posts")
    .description("List test posts from your development account")
    .action(async () => {
      try {
        const pds = await bluesky.getPdsUrl();
        const config = readConfig();
        const did: string = config.bluesky?.did || ""

        const spinner = ora("Fetching test posts...").start();
        const manager = new PdsAccountManager(pds);
        const posts = await manager.getPostsFromPds(did);
        spinner.succeed(`Data retrieved successfully!`);

        console.log(chalk.green("Available Data:"));
        console.log(posts)
      } catch (error) {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
    });
};

async function showTestMenu(pds: string) {
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do with your test account?",
      choices: [
        { name: "Generate test posts", value: "generate" },
        { name: "List test posts", value: "list" },
        { name: "Login to test account", value: "login" },
        { name: "Exit", value: "exit" },
      ],
    },
  ]);

  console.log(chalk.cyan("\nUse the following command:"));
  switch (action) {
    case "generate":
      console.log(chalk.white(`  bsky-backup test generate-posts`));
      break;
    case "list":
      console.log(chalk.white(`  bsky-backup test list-posts`));
      break;
    case "login":
      console.log(chalk.white(`  bsky-backup login --pds ${pds}`));
      break;
  }
}
