import { Command, CommanderError } from 'commander';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { baseUrl, resolveToken } from './config.js';
import { definitions, readableNoticeType } from './catalog.js';
import { LiandiError } from './errors.js';
import { defaultIO, errorEnvelope, execute, type GlobalOptions, type IO } from './runtime.js';
import { formatOutput, redact } from './output.js';
import { installSkill, skillPaths } from './skill.js';

interface ProgramOptions { env?: NodeJS.ProcessEnv; io?: IO; version?: string }

/** Last resolved command, used to label errors thrown after option parsing. */
let lastCommand = 'liandi';
type Values = Record<string, string | boolean | undefined>;

function packageVersion(): string {
  return (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;
}

function parseFlags(argv: string[]): { globals: GlobalOptions; rest: string[] } {
  const globals: GlobalOptions = {};
  const rest: string[] = [];
  const names: Record<string, keyof GlobalOptions> = { '--token': 'token', '-t': 'token', '--base-url': 'baseUrl', '-b': 'baseUrl' };
  const booleans: Record<string, keyof GlobalOptions> = { '--json': 'json', '-j': 'json', '--dry-run': 'dryRun', '-d': 'dryRun', '--yes': 'yes', '-y': 'yes' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const name = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
    if (name in names) {
      const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[++index];
      if (!value) throw new LiandiError(`${name} requires a value`, 'INVALID_INPUT', 2);
      (globals as Record<string, string | boolean | undefined>)[names[name]!] = value;
    } else if (name in booleans) {
      if (arg.includes('=')) throw new LiandiError(`${name} does not take a value`, 'INVALID_INPUT', 2);
      (globals as Record<string, string | boolean | undefined>)[booleans[name]!] = true;
    } else {
      rest.push(arg);
    }
  }
  if (globals.yes && !isWriteCommand(rest)) {
    throw new LiandiError('--yes only applies to write operations; omit it for reads', 'INVALID_INPUT', 2);
  }
  return { globals, rest };
}

const WRITE = new Set(['post', 'edit', 'read', 'login', '2fa', 'logout', 'install']);

export function isWriteCommand(argv: string[]): boolean {
  const [group, action] = argv.filter(part => !part.startsWith('-'));
  if (group === undefined) return false;
  if (action === undefined) return false;
  if (group === 'time') return false;
  return WRITE.has(action);
}

export function createProgram(options: ProgramOptions = {}): Command {
  const env = options.env ?? process.env;
  const io = options.io ?? defaultIO;
  const version = options.version ?? packageVersion();
  const program = new Command();
  let invocationGlobals: GlobalOptions = {};
  program.name('liandi').description('Human and agent friendly CLI for the ld246.com community API')
    .version(version, '-v, --version', 'Show version').helpOption('-h, --help', 'Show help')
    .configureHelp({ sortSubcommands: true, sortOptions: true })
    .configureOutput({
      writeOut: text => { io.stdout.write(text); },
      writeErr: text => { io.stderr.write(text); },
      // Errors are rendered once, by run(), so Commander must not print them itself.
      outputError: () => {},
    })
    .addHelpText('after', `
Global options (can appear before or after commands):
  -t, --token <token>       API token (highest-priority source)
  -b, --base-url <url>      API server (default: https://ld246.com)
  -j, --json                Uniform JSON output for agents
  -d, --dry-run             Preview a write; never send it
  -y, --yes                 Execute a write without interactive confirmation
  -v, --version             Show version
  -h, --help                Show help

Reads never use --dry-run/--yes. Writes always show a preview before confirmation.
Authentication: --token > LIANDI_TOKEN > ./.env > ~/.config/liandi/.env
Run "liandi <group> --help" for subcommands.`).exitOverride();

  const perform = async (name: string, args: string[], values: Values): Promise<void> => {
    lastCommand = name;
    const definition = definitions[name];
    if (!definition) throw new LiandiError('Internal command mapping is missing', 'INTERNAL_ERROR');
    const globals = invocationGlobals;
    const resolved = resolveToken(globals.token, env);
    const result = await execute(name, await definition.request(args, values), {
      ...globals, baseUrl: baseUrl(env, globals.baseUrl), token: resolved.token,
    }, io, version, env, definition);
    if (name.startsWith('auth.') && result.status === 'success') result.data = redact(result.data);
    io.stdout.write(formatOutput(result, globals.json ?? false) + '\n');
  };

  const group = (name: string, description: string, ...aliases: string[]) => {
    const command = program.command(name).description(description);
    if (aliases.length) command.aliases(aliases);
    return command;
  };
  const run = (command: Command, handler: (...args: any[]) => Promise<void>) => command.action(handler);

  const articleOptions = (command: Command) => command
    .requiredOption('--title <title>', 'Article title')
    .requiredOption('--tags <tags>', 'Comma-separated tags')
    .option('-c, --content <text>', 'Inline article content')
    .option('-f, --content-file <path>', 'Read content from a UTF-8 Markdown/HTML file')
    .option('--content-type <type>', 'markdown or html', 'markdown')
    .option('--reward-content <text>', 'Reward-area content', '')
    .option('--reward-point <number>', 'Reward points', '0');
  const commentOptions = (command: Command) => command
    .option('-c, --content <text>', 'Inline comment content')
    .option('-f, --content-file <path>', 'Read content from a UTF-8 Markdown/HTML file')
    .option('--content-type <type>', 'markdown or html', 'markdown');

  const article = group('article', 'Read, post and edit articles', 'a', 'articles');
  run(article.command('list').description('List articles')
    .option('-s, --sort <sort>', 'latest, hot, good, reply, perfect', 'latest')
    .option('-p, --page <page>', 'Page number', '1')
    .option('--tag <tag>', 'Filter by tag')
    .option('--domain <domain>', 'Filter by domain (latest sort only)'), async (v: Values) => perform('articles.list', [], v));
  run(article.command('get <id>').description('Article with paginated comments')
    .option('-p, --page <page>', 'Comment page number', '1'), async (id: string, v: Values) => perform('articles.get', [id], v));
  run(articleOptions(article.command('post').description('Publish an article (write)')), async (v: Values) => perform('articles.post', [], v));
  run(article.command('source <id>').description('Get an article for updating'), async (id: string) => perform('articles.source', [id], {}));
  run(articleOptions(article.command('edit <id>').description('Update an article (write)'))
    .requiredOption('--type <number>', 'Article type from "article source"'), async (id: string, v: Values) => perform('articles.edit', [id], v));

  const comment = group('comment', 'Post and edit comments', 'c', 'comments');
  run(commentOptions(comment.command('post <article-id>').description('Comment on an article (write)'))
    .option('-r, --reply-to <comment-id>', 'Original comment ID when replying'), async (id: string, v: Values) => perform('comments.post', [id], v));
  run(commentOptions(comment.command('edit <id>').description('Update your comment (write)'))
    .option('--visible <boolean>', 'true: only the author can see it; false: public'), async (id: string, v: Values) => perform('comments.edit', [id], v));

  for (const [name, aliases, description, label] of [
    ['domain', ['dom', 'domains'], 'List and inspect domains', 'domain'],
    ['tag', ['tags'], 'List and inspect tags', 'tag'],
  ] as const) {
    const parent = group(name, description, ...aliases);
    run(parent.command('list').description(`List ${name}s`).option('-p, --page <page>', 'Page number', '1'),
      async (v: Values) => perform(`${name}s.list`, [], v));
    run(parent.command(`get <${label}>`).description(`One ${name}`), async (id: string) => perform(`${name}s.get`, [id], {}));
  }

  const user = group('user', 'Profiles, activity and social lists', 'u', 'users');
  run(user.command('me').description('Current authenticated user'), async () => perform('users.me', [], {}));
  run(user.command('get <name>').description('Profile by username, or by user number with --number')
    .option('-n, --number', 'Treat <name> as a user number'), async (name: string, v: Values) => perform('users.get', [name], v));
  for (const [subcommand, description] of [
    ['articles', 'Articles by a user'], ['comments', 'Comments by a user'],
    ['watches', 'Articles watched by a user'], ['follows', 'Users followed by a user'],
    ['tags', 'Tags followed by a user'], ['stars', 'Articles favorited by a user'],
    ['followers', 'Followers of a user'],
  ] as const) {
    run(user.command(`${subcommand} <name>`).description(description).option('-p, --page <page>', 'Page number', '1'),
      async (name: string, v: Values) => perform(`users.${subcommand}`, [name], v));
  }
  run(user.command('events <name>').description('Recent activity').option('-s, --size <size>', 'Number of events, 1-64', '16'),
    async (name: string, v: Values) => perform('users.events', [name], v));

  const notice = group('notice', 'Read notifications and mark them read', 'n', 'notifications');
  run(notice.command('unread').description('Unread count'), async () => perform('notices.unread', [], {}));
  for (const type of ['commented', 'comment2ed', 'reply', 'at', 'following', 'point', 'broadcast', 'wallet', 'sys-announce']) {
    run(notice.command(type).description(`List ${type} notifications`).option('-p, --page <page>', 'Page number', '1'),
      async (v: Values) => perform(`notices.${type}`, [], v));
  }
  run(notice.command('read <type>').description('Mark commented, comment2ed, reply, at or following as read (write)'),
    async (type: string) => perform(`notices.read.${readableNoticeType(type)}`, [], {}));

  const top = group('top', 'Leaderboards', 'tops');
  run(top.command('newbies').description('Newly registered users'), async () => perform('tops.newbies', [], {}));
  run(top.command('followers').description('Users ranked by followers'), async () => perform('tops.followers', [], {}));

  const auth = group('auth', 'Login, two-factor authentication and logout');
  run(auth.command('login').description('Verify username/email and password (write; password is hashed locally)')
    .requiredOption('-u, --username <username>', 'Username or email')
    .option('--password <password>', 'Plain password; prefer --password-stdin to avoid shell history')
    .option('--password-stdin', 'Read one password line from stdin')
    .option('--captcha <captcha>', 'Captcha if requested by the server'), async (v: Values) => {
      if (v.passwordStdin) {
        if (v.password !== undefined) throw new LiandiError('Use either --password or --password-stdin, not both', 'INVALID_INPUT', 2);
        const rl = createInterface({ input: stdin });
        try { v.password = await rl.question('Password: '); } finally { rl.close(); }
      }
      if (v.password === undefined) throw new LiandiError('Provide --password-stdin or --password <password>', 'INVALID_INPUT', 2);
      return perform('auth.login', [], v);
    });
  run(auth.command('2fa').description('Complete two-factor login with the login session token (write)')
    .requiredOption('--session-token <token>', 'Token returned by "auth login" when 2FA is required')
    .requiredOption('--code <code>', 'Six-digit authenticator code'), async (v: Values) => perform('auth.2fa', [], v));
  run(auth.command('logout').description('Log out (write)'), async () => perform('auth.logout', [], {}));

  run(program.command('time').description('Current server time'), async () => perform('system.time', [], {}));

  run(group('skill', 'Install the bundled agent skill').command('install').description('Install or update ~/.agents/skills/liandi (local file write)'),
    async () => {
      lastCommand = 'skill.install';
      const globals = invocationGlobals;
      const preview = { action: 'install or update', destination: skillPaths().destination };
      if (globals.dryRun) {
        io.stdout.write(formatOutput({ ok: true, status: 'dry-run', command: lastCommand, data: preview }, globals.json ?? false) + '\n');
        return;
      }
      if (!globals.yes) {
        io.stdout.write(formatOutput({ ok: true, status: 'dry-run', command: lastCommand, data: preview }, globals.json ?? false) + '\n');
        if (!io.stdin.isTTY || !io.stdout.isTTY) throw new LiandiError('Confirmation required. Review with --dry-run, then rerun with --yes', 'CONFIRMATION_REQUIRED', 2);
        const confirm = io.confirm ?? (async (prompt: string) => {
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          try { return await rl.question(prompt); } finally { rl.close(); }
        });
        if (!/^y(?:es)?$/iu.test((await confirm('Install this skill? [y/N] ')).trim())) {
          io.stdout.write(formatOutput({ ok: true, status: 'cancelled', command: lastCommand }, globals.json ?? false) + '\n');
          return;
        }
      }
      io.stdout.write(formatOutput({ ok: true, status: 'success', command: lastCommand, data: await installSkill() }, globals.json ?? false) + '\n');
    });

  // Global flags are parsed separately so they work at any position, as agents commonly append -j.
  const originalParseAsync = program.parseAsync.bind(program);
  program.parseAsync = async (argv?: readonly string[], parseOptions?: { from?: 'node' | 'electron' | 'user' }) => {
    const raw = argv ? [...argv] : process.argv;
    const userArgs = parseOptions?.from === 'user' ? raw : raw.slice(2);
    const { globals, rest } = parseFlags(userArgs);
    invocationGlobals = globals;
    lastCommand = rest.filter(part => !part.startsWith('-')).slice(0, 2).join('.') || 'liandi';
    return originalParseAsync(rest, { from: 'user' });
  };
  return program;
}

/** Usage errors from Commander are argument errors, not internal failures. */
function normalizeError(error: unknown): unknown {
  if (!(error instanceof CommanderError)) return error;
  return new LiandiError(error.message.replace(/^error:\s*/iu, '').trim(), 'INVALID_INPUT', 2);
}

export async function run(argv: string[], options: ProgramOptions = {}): Promise<number> {
  const io = options.io ?? defaultIO;
  const json = (() => { try { return parseFlags(argv).globals.json ?? false; } catch { return argv.includes('--json') || argv.includes('-j'); } })();
  try {
    await createProgram(options).parseAsync(argv, { from: 'user' });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError && ['commander.helpDisplayed', 'commander.version'].includes(error.code)) return 0;
    const envelope = errorEnvelope(normalizeError(error), lastCommand);
    io.stderr.write(formatOutput(envelope, json) + '\n');
    return envelope.status === 'error' ? (normalizeError(error) as LiandiError).exitCode : 1;
  }
}
