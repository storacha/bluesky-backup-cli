import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { PdsAccountManager } from "../pds/account";
import { Record } from "@atproto/api/dist/client/types/app/bsky/graph/starterpack";

export const pdsActions = (program: Command) => {
  const test = program
    .command("test")
    .description("Test utilities for the Bluesky-Storacha backup CLI");

  test
    .command("create-account")
    .description("Create a test account on a development PDS")
    .action(async () => {
      try {
        const answers = await inquirer.prompt([
          {
            type: "input",
            name: "pds",
            message: "Enter development PDS URL:",
            validate: (input) =>
              input.startsWith("https://") ||
              "PDS URL must start with https://",
          },
          {
            type: "input",
            name: "handle",
            message: "Enter test account handle:",
            validate: (input) =>
              input.includes(".") ||
              "Handle must include a domain (e.g., user.domain.com)",
          },
          {
            type: "input",
            name: "email",
            message: "Enter test email address:",
            validate: (input) =>
              input.includes("@") || "Please enter a valid email address",
          },
          {
            type: "password",
            name: "password",
            message: "Enter test account password:",
            validate: (input) =>
              input.length >= 8 || "Password must be at least 8 characters",
          },
          {
            type: "input",
            name: "inviteCode",
            message: "Enter PDS invite code (contact your PDS administrator):",
            validate: (input) => input.length > 0 || "Invite code is required",
          },
        ]);

        const spinner = ora("Creating test account...").start();
        const manager = new PdsAccountManager(answers.pds);
        const account = await manager.createAccountOnPds({
          email: answers.email,
          handle: answers.handle,
          password: answers.password,
          inviteCode: answers.inviteCode,
        });
        spinner.succeed(`Created test account: ${account.handle}`);

        console.log(chalk.green("\nTest account created successfully!"));
        await showTestMenu(answers.pds);
      } catch (error) {
        console.error(chalk.red(`\nError: ${(error as Error).message}`));

        if ((error as Error).message.includes("invite")) {
          console.log(chalk.yellow("\nAbout invite codes:"));
          console.log(
            "1. Invite codes are required by PDS instances to control account creation",
          );
          console.log(
            "2. Contact your PDS administrator to obtain a valid invite code",
          );
        }
        process.exit(1);
      }
    });

  test
    .command("create-post")
    .description("Create test posts on your development PDS")
    .action(async () => {
      try {
        const { pds } = await inquirer.prompt([
          {
            type: "input",
            name: "pds",
            message: "Enter development PDS URL:",
            validate: (input) =>
              input.startsWith("https://") ||
              "PDS URL must start with https://",
          },
        ]);

        const { postType } = await inquirer.prompt([
          {
            type: "list",
            name: "postType",
            message: "What type of test posts would you like to generate?",
            choices: [
              { name: "Single test post", value: "single" },
              { name: "Test reply to another post", value: "reply" },
            ],
          },
        ]);

        const manager = new PdsAccountManager(pds);

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
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
    });

  test
    .command("list-posts")
    .description("List test posts from your development account")
    .action(async () => {
      try {
        const { pds, limit } = await inquirer.prompt([
          {
            type: "input",
            name: "pds",
            message: "Enter development PDS URL:",
            validate: (input) =>
              input.startsWith("https://") ||
              "PDS URL must start with https://",
          },
          {
            type: "number",
            name: "limit",
            message: "How many posts to retrieve?",
            default: 10,
          },
        ]);

        const spinner = ora("Fetching test posts...").start();
        const manager = new PdsAccountManager(pds);
        const posts = await manager.getPostsFromPds(limit);
        spinner.succeed(`Retrieved ${posts.length} test posts`);

        console.log(chalk.green("\nTest Posts:"));
        posts.forEach((post: Partial<Record>, index) => {
          console.log(
            chalk.white(`\n${index + 1}. Created at: ${post.createdAt}`),
          );
          console.log(chalk.cyan(`   ${post.text}`));
          console.log(chalk.gray(`   URI: ${post.uri}`));
        });
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
