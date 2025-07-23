#!/usr/bin/env node

/**
 * CLI Entry Point for Angular Performance Analyzer
 */

import * as path from 'path';
import { 
  PerformanceAnalyzerCLI, 
  PerformanceAnalyzer 
} from './performance-analyzer';

// Helper function to resolve project path
function resolveProjectPath(inputPath?: string): string {
  if (!inputPath) {
    return process.cwd();
  }
  
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  
  return path.resolve(process.cwd(), inputPath);
}

// Helper function to create output directory if needed
async function ensureOutputDirectory(outputPath: string): Promise<void> {
  const fs = await import('fs/promises');
  const outputDir = path.dirname(outputPath);
  
  try {
    await fs.access(outputDir);
  } catch {
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${outputDir}`);
  }
}

// Helper function to parse command line arguments
function parseArgs(args: string[]) {
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

// Command handlers
const commands = {
  // Analyze entire project
  async project(projectPath?: string, outputPath?: string, format?: string) {
    const resolvedPath = resolveProjectPath(projectPath);
    console.log(`🔍 Analyzing project: ${resolvedPath}`);
    
    if (outputPath) {
      await ensureOutputDirectory(outputPath);
    }
    
    if (format === 'json') {
      // Handle JSON format
      const { analyses, summary } = PerformanceAnalyzerCLI.analyzeProjectWithSummary(resolvedPath);
      const jsonReport = {
        summary,
        analyses,
        generatedAt: new Date().toISOString()
      };
      
      const outputFile = outputPath || './performance-report.json';
      await PerformanceAnalyzerCLI.saveReportToFile(JSON.stringify(jsonReport, null, 2), outputFile);
      console.log(`📄 JSON report saved to: ${outputFile}`);
      
      return { analyses, summary, reportPath: outputFile };
    } else {
      // Default markdown format
      return PerformanceAnalyzerCLI.runAnalysis(resolvedPath, outputPath);
    }
  },

  // Analyze single component
  async component(componentPath: string) {
    if (!componentPath) {
      throw new Error('Component path is required');
    }
    
    const resolvedPath = path.resolve(componentPath);
    console.log(`🔍 Analyzing component: ${resolvedPath}`);
    
    const analyzer = new PerformanceAnalyzer();
    const analysis = analyzer.analyzeComponent(resolvedPath);
    
    console.log(`\n📊 Component Analysis Results:`);
    console.log(`   Name: ${analysis.componentName}`);
    console.log(`   Performance Score: ${analysis.performanceScore}/100`);
    
    const totalIssues = analysis.changeDetectionIssues.length + 
                       analysis.templateIssues.length + 
                       analysis.subscriptionIssues.length;
    console.log(`   Issues Found: ${totalIssues}`);
    
    if (analysis.recommendations.length > 0) {
      console.log(`\n💡 Top Recommendations:`);
      analysis.recommendations.slice(0, 3).forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec.title} (${rec.priority} priority)`);
      });
    }
    
    return analysis;
  },

  // Generate detailed report
  async report(projectPath?: string, outputPath?: string) {
    const resolvedPath = resolveProjectPath(projectPath);
    const defaultOutput = outputPath || './performance-report.md';
    
    console.log(`📋 Generating detailed report for: ${resolvedPath}`);
    
    await ensureOutputDirectory(defaultOutput);
    
    const { analyses, summary } = PerformanceAnalyzerCLI.analyzeProjectWithSummary(resolvedPath);
    const report = PerformanceAnalyzerCLI.generateReportWithSummary(analyses, summary);
    
    await PerformanceAnalyzerCLI.saveReportToFile(report, defaultOutput);
    
    // Also log summary to console
    console.log(`\n📊 Analysis Summary:`);
    console.log(`   Components: ${summary.totalComponents}`);
    console.log(`   Average Score: ${summary.averagePerformanceScore}/100`);
    console.log(`   Total Issues: ${summary.totalIssues}`);
    
    return { analyses, summary, reportPath: defaultOutput };
  },

  // Show help
  help() {
    console.log(`
🚀 Angular Performance Analyzer CLI

USAGE:
  ngperf-audit <command> [options]

COMMANDS:
  project [path]              Analyze entire project
  component <path>            Analyze single component  
  report [path]               Generate detailed report
  help                        Show this help

OPTIONS:
  -o, --output <file>         Output file path
  -f, --format <type>         Report format: 'markdown' or 'json' (default: markdown)

EXAMPLES:
  ngperf-audit help                                         # Show this help
  ngperf-audit project                                      # Analyze current project
  ngperf-audit project ./src/app                           # Analyze src/app folder
  ngperf-audit project ./src/app -o ./reports/report.md    # Save to custom file
  ngperf-audit project ./src/app -f json                   # Generate JSON report
  ngperf-audit project ./src/app -o ./report.json -f json  # JSON report with custom path
  
  ngperf-audit component ./src/app/app.component.ts        # Analyze single component
  
  ngperf-audit report                                       # Generate detailed report
  ngperf-audit report ./src/app -o ./my-report.md          # Custom output path

DEVELOPMENT USAGE (in project root):
  npm run ngperf-audit project                              # If added to package.json scripts
  npx tsx src/ngperf/cli.ts project                  # Direct TypeScript execution

For more information: https://github.com/eawebmaster20/ngperf
`);
  }
};

// Main CLI handler
async function main() {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);
  const command = parsed._[0] as keyof typeof commands;
  
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

// Export for programmatic use
export { commands };

// Run if called directly
if (require.main === module) {
  main();
}
