import { Command, CommanderError } from 'commander';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { baseUrl, resolveToken } from './config.js';
import { definitions, readableNoticeType } from './catalog.js';
import { LiandiError } from './errors.js';
import { messages, normalizeLocaleTag, resolveLocale, type Locale } from './i18n.js';
import { defaultIO, errorEnvelope, execute, type GlobalOptions, type IO } from './runtime.js';
import { formatOutput, resolveColor, type ColorMode, type OutputEnvelope, type OutputFormat } from './output.js';
import { installSkill, skillPaths } from './skill.js';

interface ProgramOptions { env?: NodeJS.ProcessEnv; io?: IO; version?: string; locale?: Locale }

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
  const values: Record<string, 'token' | 'baseUrl' | 'color' | 'format' | 'lang'> = {
    '--token': 'token', '-t': 'token', '--base-url': 'baseUrl', '-b': 'baseUrl',
    '--color': 'color', '--format': 'format', '--lang': 'lang',
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
      if (values[name] === 'lang') {
        const parsed = normalizeLocaleTag(value);
        if (!parsed) throw new LiandiError('--lang must be en, zh-CN or zh-TW', 'INVALID_INPUT', 2);
        globals.lang = parsed;
        continue;
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

export function createProgram(options: ProgramOptions = {}): Command {
  const env = options.env ?? process.env;
  const io = options.io ?? defaultIO;
  const version = options.version ?? packageVersion();
  const locale = options.locale ?? resolveLocale(undefined, env);
  const t = messages(locale);
  const program = new Command();
  let invocationGlobals: GlobalOptions = {};
  const helpConfig = {
    sortSubcommands: true,
    sortOptions: true,
    styleTitle: (title: string) => t.help.headings[title as keyof typeof t.help.headings] ?? title,
    optionDescription: (option: { description: string; defaultValue?: unknown; defaultValueDescription?: string; required?: boolean; optional?: boolean; isBoolean(): boolean }) => {
      if (option.defaultValue !== undefined) {
        const showDefault = option.required || option.optional || (option.isBoolean() && typeof option.defaultValue === 'boolean');
        if (showDefault) {
          const rendered = t.help.defaultValue(option.defaultValueDescription || JSON.stringify(option.defaultValue));
          if (!option.description) return rendered;
          return locale === 'en' ? `${option.description} ${rendered}` : `${option.description}${rendered}`;
        }
      }
      return option.description;
    },
  };
  program.name('liandi').description(t.help.description)
    .version(version, '-v, --version', t.help.showVersion)
    .helpOption('-h, --help', t.help.showHelp)
    .helpCommand('help [command]', t.help.helpCommand)
    .configureHelp(helpConfig)
    .configureOutput({
      writeOut: text => { io.stdout.write(text); },
      writeErr: text => { io.stderr.write(text); },
      // Errors are rendered once, by run(), so Commander must not print them itself.
      outputError: () => {},
    })
    .addHelpText('after', t.help.globalFooter).exitOverride();

  const perform = async (name: string, args: string[], values: Values): Promise<void> => {
    lastCommand = name;
    const definition = definitions[name];
    if (!definition) throw new LiandiError('Internal command mapping is missing', 'INTERNAL_ERROR');
    const globals = invocationGlobals;
    const activeLocale = globals.lang ?? locale;
    const resolved = resolveToken(globals.token, env);
    const server = baseUrl(env, globals.baseUrl);
    const rendered = await execute(name, await definition.request(args, values), {
      ...globals, lang: activeLocale, baseUrl: globals.baseUrl, token: resolved.token,
    }, io, version, env, definition);
    io.stdout.write(formatOutput(rendered, {
      format: globals.format ?? 'human',
      color: resolveColor(globals.color, io.stdout, env),
      width: io.stdout.columns,
      baseUrl: server,
      locale: activeLocale,
    }) + '\n');
  };

  const group = (name: string, description: string, ...aliases: string[]) => {
    const command = program.command(name).description(description);
    if (aliases.length) command.aliases(aliases);
    return command;
  };
  const run = (command: Command, handler: (...args: any[]) => Promise<void>) => command.action(handler);

  const articleOptions = (command: Command) => command
    .requiredOption('--title <title>', t.help.options.title)
    .requiredOption('--tags <tags>', t.help.options.tags)
    .option('-c, --content <text>', t.help.options.articleContent)
    .option('-f, --content-file <path>', t.help.options.contentFile)
    .option('--content-type <type>', t.help.options.contentType, 'markdown')
    .option('--reward-content <text>', t.help.options.rewardContent, '')
    .option('--reward-point <number>', t.help.options.rewardPoint, '0');
  const commentOptions = (command: Command) => command
    .option('-c, --content <text>', t.help.options.commentContent)
    .option('-f, --content-file <path>', t.help.options.contentFile)
    .option('--content-type <type>', t.help.options.contentType, 'markdown');

  const article = group('article', t.help.commands.article, 'a', 'articles');
  run(article.command('list').description(t.help.commands.articleList)
    .option('-s, --sort <sort>', t.help.options.sort, 'latest')
    .option('-p, --page <page>', t.help.options.page, '1')
    .option('--tag <tag>', t.help.options.tag)
    .option('--domain <domain>', t.help.options.domain), async (v: Values) => perform('articles.list', [], v));
  run(article.command('get <id>').description(t.help.commands.articleGet)
    .option('-p, --page <page>', t.help.options.commentPage, '1'), async (id: string, v: Values) => perform('articles.get', [id], v));
  run(articleOptions(article.command('post').description(t.help.commands.articlePost)), async (v: Values) => perform('articles.post', [], v));
  run(article.command('source <id>').description(t.help.commands.articleSource), async (id: string) => perform('articles.source', [id], {}));
  run(articleOptions(article.command('edit <id>').description(t.help.commands.articleEdit))
    .requiredOption('--type <number>', t.help.options.articleType), async (id: string, v: Values) => perform('articles.edit', [id], v));

  const comment = group('comment', t.help.commands.comment, 'c', 'comments');
  run(commentOptions(comment.command('post <article-id>').description(t.help.commands.commentPost))
    .option('-r, --reply-to <comment-id>', t.help.options.replyTo), async (id: string, v: Values) => perform('comments.post', [id], v));
  run(commentOptions(comment.command('edit <id>').description(t.help.commands.commentEdit))
    .option('--visible <boolean>', t.help.options.visible), async (id: string, v: Values) => perform('comments.edit', [id], v));

  for (const [name, aliases, description, listDesc, getDesc, label] of [
    ['domain', ['dom', 'domains'], t.help.commands.domain, t.help.commands.domainList, t.help.commands.domainGet, 'domain'],
    ['tag', ['tags'], t.help.commands.tag, t.help.commands.tagList, t.help.commands.tagGet, 'tag'],
  ] as const) {
    const parent = group(name, description, ...aliases);
    run(parent.command('list').description(listDesc).option('-p, --page <page>', t.help.options.page, '1'),
      async (v: Values) => perform(`${name}s.list`, [], v));
    run(parent.command(`get <${label}>`).description(getDesc), async (id: string) => perform(`${name}s.get`, [id], {}));
  }

  const user = group('user', t.help.commands.user, 'u', 'users');
  run(user.command('me').description(t.help.commands.userMe), async () => perform('users.me', [], {}));
  run(user.command('get <name>').description(t.help.commands.userGet)
    .option('-n, --number', t.help.options.userNumber), async (name: string, v: Values) => perform('users.get', [name], v));
  for (const [subcommand, description] of [
    ['articles', t.help.commands.userArticles], ['comments', t.help.commands.userComments],
    ['watches', t.help.commands.userWatches], ['follows', t.help.commands.userFollows],
    ['tags', t.help.commands.userTags], ['stars', t.help.commands.userStars],
    ['followers', t.help.commands.userFollowers],
  ] as const) {
    run(user.command(`${subcommand} <name>`).description(description).option('-p, --page <page>', t.help.options.page, '1'),
      async (name: string, v: Values) => perform(`users.${subcommand}`, [name], v));
  }
  run(user.command('events <name>').description(t.help.commands.userEvents).option('-s, --size <size>', t.help.options.eventSize, '16'),
    async (name: string, v: Values) => perform('users.events', [name], v));

  const notice = group('notice', t.help.commands.notice, 'n', 'notifications');
  run(notice.command('unread').description(t.help.commands.noticeUnread), async () => perform('notices.unread', [], {}));
  for (const type of ['commented', 'comment2ed', 'reply', 'at', 'following', 'point', 'broadcast', 'wallet', 'sys-announce']) {
    run(notice.command(type).description(t.help.commands.noticeType(type)).option('-p, --page <page>', t.help.options.page, '1'),
      async (v: Values) => perform(`notices.${type}`, [], v));
  }
  run(notice.command('read <type>').description(t.help.commands.noticeRead),
    async (type: string) => perform(`notices.read.${readableNoticeType(type)}`, [], {}));

  const top = group('top', t.help.commands.top, 'tops');
  run(top.command('newbies').description(t.help.commands.topNewbies), async () => perform('tops.newbies', [], {}));
  run(top.command('followers').description(t.help.commands.topFollowers), async () => perform('tops.followers', [], {}));

  run(program.command('time').description(t.help.commands.time), async () => perform('system.time', [], {}));

  run(group('skill', t.help.commands.skill).command('install').description(t.help.commands.skillInstall),
    async () => {
      lastCommand = 'skill.install';
      const globals = invocationGlobals;
      const activeLocale = globals.lang ?? locale;
      const format = globals.format ?? 'human';
      const rendering = {
        format,
        color: resolveColor(globals.color, io.stdout, env),
        width: io.stdout.columns,
        baseUrl: baseUrl(env, globals.baseUrl),
        locale: activeLocale,
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
        if (!/^y(?:es)?$/iu.test((await confirm(messages(activeLocale).output.confirmSkill)).trim())) {
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
  const configureChildren = (parent: Command): void => {
    for (const child of parent.commands) {
      child.helpOption('-h, --help', t.help.showHelp);
      if (child.commands.length > 0) child.helpCommand('help [command]', t.help.helpCommand);
      child.addHelpText('after', t.help.globalFooter);
      configureChildren(child);
    }
  };
  configureChildren(program);
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

function langFromArgv(argv: string[]): string | undefined {
  const inline = argv.find(arg => arg.startsWith('--lang='));
  if (inline) return inline.slice('--lang='.length);
  const index = argv.indexOf('--lang');
  return index >= 0 ? argv[index + 1] : undefined;
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
  const locale = options.locale ?? resolveLocale(pending?.lang ?? langFromArgv(argv), env);
  try {
    await createProgram({ ...options, locale }).parseAsync(argv, { from: 'user' });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError && ['commander.helpDisplayed', 'commander.version'].includes(error.code)) return 0;
    const known = normalizeError(error);
    io.stderr.write(formatOutput(errorEnvelope(known, lastCommand), { format, color, locale }) + '\n');
    // Unexpected exceptions are runtime failures: never report them as success.
    return known instanceof LiandiError ? known.exitCode : 1;
  }
}
