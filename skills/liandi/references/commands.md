# Command reference

Global flags may appear anywhere: `-j, --json`, `-t, --token`, `-b, --base-url`, `-d, --dry-run`, `-y, --yes`, `-v, --version`, `-h, --help`.

Aliases: `article|a`, `comment|c`, `user|u`, `notice|n`, `domain|dom`, `tag|tags`, `top|tops`.

## Articles

```sh
liandi article list [-s latest|hot|good|reply|perfect] [-p page] [--tag <tag> | --domain <domain>]
liandi article get <articleId> [-p commentPage]
liandi article source <articleId>
liandi article post --title <title> --tags <a,b> (-c <text> | -f <file>) [--content-type markdown|html] [--reward-content <text>] [--reward-point <integer>]
liandi article edit <articleId> --title <title> --tags <a,b> --type <articleType> (-c <text> | -f <file>) [--content-type markdown|html] [--reward-content <text>] [--reward-point <integer>]
```

`article list` covers the latest, hot, good, reply and perfect feeds. Tag feeds accept every sort; domain feeds only the default `latest` sort, matching the upstream API.

## Comments

```sh
liandi comment post <articleId> (-c <text> | -f <file>) [--content-type markdown|html] [-r <originalCommentId>]
liandi comment edit <commentId> (-c <text> | -f <file>) [--content-type markdown|html] [--visible true|false]
```

`--visible true` means only the author can see the comment, matching the upstream `commentVisible` field.

## Domains and tags

```sh
liandi domain list [-p page]
liandi domain get <domainURI>
liandi tag list [-p page]
liandi tag get <tagURI>
```

## Users

```sh
liandi user me
liandi user get <name>            # username
liandi user get <number> --number # user number
liandi user articles <name> [-p page]
liandi user comments <name> [-p page]
liandi user events <name> [-s 1..64]
liandi user watches <name> [-p page]   # articles watched
liandi user follows <name> [-p page]   # users followed
liandi user tags <name> [-p page]      # tags followed
liandi user stars <name> [-p page]     # articles favorited
liandi user followers <name> [-p page]
```

## Notifications

```sh
liandi notice unread
liandi notice <commented|comment2ed|reply|at|following|point|broadcast|wallet|sys-announce> [-p page]
liandi notice read <commented|comment2ed|reply|at|following>
```

`notice read` uses GET upstream but changes state, so the CLI treats it as a write. Broadcast, wallet and system-announcement lists may be marked read by the server when fetched.

## Rankings, time and login

```sh
liandi top newbies
liandi top followers
liandi time
liandi auth login -u <usernameOrEmail> --password-stdin [--captcha <captcha>]
liandi auth 2fa --session-token <loginToken> --code <sixDigits>
liandi auth logout
```

Login hashes the plain password locally with MD5 because the documented upstream API expects that. A login session token is not an API Token: normal commands use `Authorization: token <API Token>` from https://ld246.com/settings/account.

## Skill installation

```sh
liandi skill install --dry-run
liandi skill install --yes
```

Installs or replaces only `~/.agents/skills/liandi` from the installed package.

## Examples

```sh
# Hot articles as JSON for a script
liandi article list -s hot -p 1 -j

# Prepare a post from a Markdown file without sending it
liandi article post --title "标题" --tags "Markdown,CLI" -f ./post.md -d -j

# After the user approves that exact preview
liandi article post --title "标题" --tags "Markdown,CLI" -f ./post.md -y -j
```
