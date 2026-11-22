import { Command, CommanderError } from 'commander';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { baseUrl, resolveToken } from './config.js';
import { definitions, readableNoticeType } from './catalog.js';
import { LiandiError } from './errors.js';
import { defaultIO, errorEnvelope, execute, type GlobalOptions, type IO } from './runtime.js';
import { formatOutput, resolveColor, type ColorMode, type OutputEnvelope, type OutputFormat } from './output.js';
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
  let jsonFlag = false;
  const values: Record<string, 'token' | 'baseUrl' | 'color' | 'format'> = {
    '--token': 'token', '-t': 'token', '--base-url': 'baseUrl', '-b': 'baseUrl',
    '--color': 'color', '--format': 'format',
  };
  const booleans: Record<string, keyof GlobalOptions> = { '--dry-run': 'dryRun', '-d': 'dryRun', '--yes': 'yes', '-y': 'yes' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const name = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
    if (name === '--json' || name === '-j') {
      if (arg.includes('=')) throw new LiandiError(`${name} does not take a value`, 'INVALID_INPUT', 2);
      if (globals.format === 'human') throw new LiandiError('Use either --json or --format human, not both', 'INVALID_INPUT', 2);
      jsonFlag = true;
      globals.format = 'json';
    } else if (name === '--no-color') {
      if (arg.includes('=')) throw new LiandiError('--no-color does not take a value', 'INVALID_INPUT', 2);
      globals.color = 'never';
    } else if (name in values) {
      const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[++index];
      if (!value) throw new LiandiError(`${name} requires a value`, 'INVALID_INPUT', 2);
      if (values[name] === 'color' && !isColorMode(value)) {
        throw new LiandiError('--color must be auto, always or never', 'INVALID_INPUT', 2);
      }
      if (values[name] === 'format') {
        if (!isFormat(value)) throw new LiandiError('--format must be human or json', 'INVALID_INPUT', 2);
        if (jsonFlag && value === 'human') throw new LiandiError('Use either --json or --format human, not both', 'INVALID_INPUT', 2);
      }
      (globals as Record<string, string | boolean | undefined>)[values[name]!] = value;
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

const COLOR_MODES: readonly ColorMode[] = ['auto', 'always', 'never'];
const FORMATS: readonly OutputFormat[] = ['human', 'json'];

function isColorMode(value: string): value is ColorMode {
  return (COLOR_MODES as readonly string[]).includes(value);
}

function isFormat(value: string): value is OutputFormat {
  return (FORMATS as readonly string[]).includes(value);
}

const WRITE = new Set(['post', 'edit', 'read', 'install']);

/** Map a typed `group.action` path to the definition name used in envelopes. */
function definitionName(typed: string): string | undefined {
  if (typed === 'time') return 'system.time';
  const [group, action] = typed.split('.');
  if (!group || !action) return undefined;
  return [`${group}s.${action}`, `${group}.${action}`].find(candidate => candidate in definitions);
}

/** Best-effort command label for errors raised before Commander resolves the command. */
function typedCommand(argv: string[]): string {
  const typed = argv.filter(part => !part.startsWith('-')).slice(0, 2).join('.') || 'liandi';
  return definitionName(typed) ?? typed;
}

export function isWriteCommand(argv: string[]): boolean {
  const [group, action] = argv.filter(part => !part.startsWith('-'));
  if (group === undefined) return false;
  if (action === undefined) return false;
  if (group === 'time') return false;
  return WRITE.has(action);
}

/** Printed by every command: these flags are parsed before Commander sees them. */
const GLOBAL_HELP = `
Global options (can appear before or after commands):
  -t, --token <token>       API token (highest-priority source)
  -b, --base-url <url>      API server (default: https://ld246.com)
  --format <format>         Output format: human (default) or json
  -j, --json                Shorthand for --format json
  -d, --dry-run             Preview a write; never send it
  -y, --yes                 Execute a write without interactive confirmation
  --color <when>            Colorize status lines and hints: auto, always, never
  --no-color                Never colorize (same as --color never)
  -v, --version             Show version
  -h, --help                Show help

Reads never use --dry-run/--yes. Writes always show a preview before confirmation.
--format human renders tables and summaries; --format json is the stable envelope for scripts.
Authentication: --token > LIANDI_TOKEN > ./.env > ~/.config/liandi/.env
Run "liandi <group> --help" for subcommands.`;

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
    .addHelpText('after', GLOBAL_HELP).exitOverride();

  const perform = async (name: string, args: string[], values: Values): Promise<void> => {
    lastCommand = name;
    const definition = definitions[name];
    if (!definition) throw new LiandiError('Internal command mapping is missing', 'INTERNAL_ERROR');
    const globals = invocationGlobals;
    const resolved = resolveToken(globals.token, env);
    const server = baseUrl(env, globals.baseUrl);
    const rendered = await execute(name, await definition.request(args, values), {
      ...globals, baseUrl: globals.baseUrl, token: resolved.token,
    }, io, version, env, definition);
    io.stdout.write(formatOutput(rendered, {
      format: globals.format ?? 'human',
      color: resolveColor(globals.color, io.stdout, env),
      width: io.stdout.columns,
      baseUrl: server,
    }) + '\n');
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

  run(program.command('time').description('Current server time'), async () => perform('system.time', [], {}));

  run(group('skill', 'Install the bundled agent skill').command('install').description('Install or update ~/.agents/skills/liandi (local file write)'),
    async () => {
      lastCommand = 'skill.install';
      const globals = invocationGlobals;
      const format = globals.format ?? 'human';
      const rendering = {
        format,
        color: resolveColor(globals.color, io.stdout, env),
        width: io.stdout.columns,
        baseUrl: baseUrl(env, globals.baseUrl),
      };
      const preview = { action: 'install or update', destination: skillPaths().destination };
      if (globals.dryRun) {
        io.stdout.write(formatOutput({ ok: true, status: 'dry-run', command: lastCommand, data: preview }, rendering) + '\n');
        return;
      }
      if (!globals.yes) {
        const interactive = Boolean(io.stdin.isTTY && io.stdout.isTTY);
        const running: OutputEnvelope = { ok: true, status: 'dry-run', command: lastCommand, data: preview };
        // stdout stays a single envelope in JSON mode; see runtime.execute.
        if (format === 'human') io.stdout.write(formatOutput(running, rendering) + '\n');
        else if (interactive) io.stderr.write(formatOutput(running, { format: 'json' }) + '\n');
        if (!interactive) throw new LiandiError('Confirmation required. Review with --dry-run, then rerun with --yes', 'CONFIRMATION_REQUIRED', 2, preview);
        const confirm = io.confirm ?? (async (prompt: string) => {
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          try { return await rl.question(prompt); } finally { rl.close(); }
        });
        if (!/^y(?:es)?$/iu.test((await confirm('Install this skill? [y/N] ')).trim())) {
          io.stdout.write(formatOutput({ ok: true, status: 'cancelled', command: lastCommand }, rendering) + '\n');
          return;
        }
      }
      io.stdout.write(formatOutput({ ok: true, status: 'success', command: lastCommand, data: await installSkill() }, rendering) + '\n');
    });

  // Global flags are parsed separately so they work at any position, as agents commonly append -j.
  const originalParseAsync = program.parseAsync.bind(program);
  program.parseAsync = async (argv?: readonly string[], parseOptions?: { from?: 'node' | 'electron' | 'user' }) => {
    const raw = argv ? [...argv] : process.argv;
    const userArgs = parseOptions?.from === 'user' ? raw : raw.slice(2);
    const { globals, rest } = parseFlags(userArgs);
    invocationGlobals = globals;
    lastCommand = typedCommand(rest);
    return originalParseAsync(rest, { from: 'user' });
  };
  const addGlobalHelp = (parent: Command): void => {
    for (const child of parent.commands) {
      child.addHelpText('after', GLOBAL_HELP);
      addGlobalHelp(child);
    }
  };
  addGlobalHelp(program);
  return program;
}

/** Usage errors from Commander are argument errors, not internal failures. */
function normalizeError(error: unknown): unknown {
  if (!(error instanceof CommanderError)) return error;
  return new LiandiError(error.message.replace(/^error:\s*/iu, '').trim(), 'INVALID_INPUT', 2);
}

/** Flags that decide how an error is printed, readable even when parsing failed. */
function formatFromArgv(argv: string[]): OutputFormat {
  if (argv.includes('--json') || argv.includes('-j')) return 'json';
  const inline = argv.find(arg => arg.startsWith('--format='));
  if (inline) return inline.slice('--format='.length) === 'json' ? 'json' : 'human';
  const index = argv.indexOf('--format');
  return index >= 0 && argv[index + 1] === 'json' ? 'json' : 'human';
}

export async function run(argv: string[], options: ProgramOptions = {}): Promise<number> {
  const io = options.io ?? defaultIO;
  const env = options.env ?? process.env;
  // Reset first: global-flag errors are thrown before the command is resolved.
  lastCommand = typedCommand(argv);
  const pending = (() => {
    try { return parseFlags(argv).globals; } catch { return undefined; }
  })();
  const format = pending?.format ?? formatFromArgv(argv);
  const color = resolveColor(pending?.color, io.stderr, env);
  try {
    await createProgram(options).parseAsync(argv, { from: 'user' });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError && ['commander.helpDisplayed', 'commander.version'].includes(error.code)) return 0;
    const known = normalizeError(error);
    io.stderr.write(formatOutput(errorEnvelope(known, lastCommand), { format, color }) + '\n');
    // Unexpected exceptions are runtime failures: never report them as success.
    return known instanceof LiandiError ? known.exitCode : 1;
  }
}
