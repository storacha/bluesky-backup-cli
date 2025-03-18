# bsky-backups-cli

A CLI tool that you can use to backup your Bluesky posts/data on Storacha

## Usage

Install the CLI globally with the command below

```shell
npm i -g bsky-backup
```

To use the CLI you need to authenticate with your Bluesky handle (username) and  your password. If you try logging in and it isn't successful, you can use a app password.

It is different from your account password. You can generate one by visting your [settings](https://bsky.app/settings/app-passwords)

Login with the command below and you'll be prompted for your handle and password.

```shell
bb login
```

Once You're logged in, the next thing you may consider doing is logging into your Storacha account with the command below

```shell
bb storacha
```

Even if you forget to do this, do not worry, when you try to backup your data directly with this command `bb backup posts`, the CLI would automatically prompt you to login to Storacha.

In the event that your backups to Storacha aren't successful, you can always access your data, either in `.car` or `.json` format and try to backup them up again. But, this time around, you'll use the command below and select the file(s) you'd love to backup.

```shell
bb backup upload
```

## PDS admin actions

If you have your PDS, and you want to use the CLI, you'll first need to login with the auth command. It is quite similar with the initial one, where teh main difference is the extra `--pds` flag.

```shell
bb login --pds https://your-pds.com
```

You'll need to use the command below to create posts on your PDS and follow the next prompts
```shell
bb admin create-pots
```
