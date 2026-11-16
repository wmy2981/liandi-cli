#!/usr/bin/env node
import { run } from './program.js';

/** A reader that closes the pipe early (`liandi … | head`) ends the run normally. */
function exitOnBrokenPipe(error: NodeJS.ErrnoException): void {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
}

process.stdout.on('error', exitOnBrokenPipe);
process.stderr.on('error', exitOnBrokenPipe);

process.exitCode = await run(process.argv.slice(2));
