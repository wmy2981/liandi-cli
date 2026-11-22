# Command reference

Global flags may appear anywhere: `--format human|json`, `-j, --json` (shorthand for `--format json`), `-t, --token`, `-b, --base-url`, `-d, --dry-run`, `-y, --yes`, `--color auto|always|never`, `--no-color`, `-v, --version`, `-h, --help`. The default is human output (tables, blocks, field summaries); pass `--format json` when parsing. Colors only decorate status lines and hints, and never appear in JSON output.

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

## Rankings, time and skill installation

```sh
liandi top newbies
liandi top followers
liandi time
liandi skill install --dry-run
liandi skill install --yes
```

`skill install` installs or replaces only `~/.agents/skills/liandi` from the installed package.

There is no login command: account/password endpoints return a session credential that cannot replace the API Token. Normal commands use `Authorization: token <API Token>` from https://ld246.com/settings/account.

## Response shapes (verified live)

List endpoints return an object, not a bare array: `data.data = { pagination, articles | tags | domains | comments }`. Paged lists return 20 items per page. `article get` returns `data.data = { pagination, article }`, with comments in `article.articleComments` and the body in `article.articleContent`. `comment post` returns only `{ code: 0 }` without the new id, so re-read the article to find it. Comment content is returned as HTML even when posted as Markdown.

## Examples

```sh
# Read a feed the way a person would
liandi article list -s hot -p 1

# Hot articles as JSON for a script
liandi article list -s hot -p 1 --format json

# Prepare a post from a Markdown file without sending it
liandi article post --title "标题" --tags "Markdown,CLI" -f ./post.md -d -j

# After the user approves that exact preview
liandi article post --title "标题" --tags "Markdown,CLI" -f ./post.md -y -j
```

## Human output

Every read command has a human renderer: article feeds are three-line blocks (title / author · time · comments · views / permalink), users, tags and domains are aligned tables, and `user me`, `article get`, `article source`, `tag get` and `domain get` are field summaries with the body or description underneath. Tables respect the terminal width and count CJK characters as two cells. When a payload does not match the expected shape, the renderer falls back to the raw `data` as JSON, so nothing is lost — but scripts should still use `--format json` for a stable contract.
