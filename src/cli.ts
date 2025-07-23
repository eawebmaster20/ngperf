#!/usr/bin/env node

/**
 * Standalone CLI entry point for ngperf package
 * This file is used when ngperf is installed globally or run via npx
 */

// Import and execute the CLI
const { commands } = require('./ngperf/cli');

// Helper function to parse command line arguments
function parseArgs(args: string[]): any {
  const parsed: any = { _: [] };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      // Long flag: --output
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        parsed[key] = nextArg;
        i++; // Skip next arg since we consumed it
      } else {
        parsed[key] = true;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      // Short flag: -o
      const key = arg.slice(1);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        parsed[key] = nextArg;
        i++; // Skip next arg since we consumed it
      } else {
        parsed[key] = true;
      }
    } else {
      // Positional argument
      parsed._.push(arg);
    }
  }
  
  return parsed;
}

async function main() {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);
  const command = parsed._[0];
  
  if (!command || command === 'help' || !commands[command]) {
    commands.help();
    return;
  }
  
  try {
    console.log('🚀 Angular Performance Analyzer');
    console.log('================================\n');
    
    const startTime = Date.now();
    
    switch (command) {
      case 'project':
        const projectPath = parsed._[1];
        const outputPath = parsed.output || parsed.o;
        const format = parsed.format || parsed.f || 'markdown';
        await commands.project(projectPath, outputPath, format);
        break;
      case 'component':
        await commands.component(parsed._[1]);
        break;
      case 'report':
        const reportPath = parsed._[1];
        const reportOutput = parsed.output || parsed.o;
        await commands.report(reportPath, reportOutput);
        break;
    }
    
    const duration = Date.now() - startTime;
    console.log(`\n✅ Completed in ${duration}ms`);
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the CLI
main();
