#!/usr/bin/env node

/**
 * CLI Entry Point for Angular Performance Analyzer
 */

import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { 
  PerformanceAnalyzerCLI, 
  PerformanceAnalyzer 
} from './performance-analyzer';

const execAsync = promisify(exec);

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
    console.log(`Created output directory: ${outputDir}`);
  }
}

// Helper function to open report in default browser
async function openInBrowser(filePath: string): Promise<void> {
  const platform = process.platform;
  try {
    const absolutePath = path.resolve(filePath);
    if (platform === 'darwin') {
      await execAsync(`open "${absolutePath}"`);
    } else if (platform === 'win32') {
      await execAsync(`start "" "${absolutePath}"`);
    } else {
      await execAsync(`xdg-open "${absolutePath}"`);
    }
  } catch (err) {
    console.error('Failed to open browser:', err instanceof Error ? err.message : err);
  }
}

// Helper function to parse command line arguments
function parseArgs(args: string[]) {
  const parsed: any = { _: [] };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        parsed[key] = nextArg;
        i++;
      } else {
        parsed[key] = true;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        parsed[key] = nextArg;
        i++;
      } else {
        parsed[key] = true;
      }
    } else {
      parsed._.push(arg);
    }
  }
  
  return parsed;
}

// Command handlers
const commands = {
  // Analyze entire project
  async project(projectPath?: string, outputPath?: string, format?: string, open?: boolean) {
    const resolvedPath = resolveProjectPath(projectPath);
    console.log(`Analyzing project: ${resolvedPath}`);
    
    if (outputPath) {
      await ensureOutputDirectory(outputPath);
    }
    
    const { analyses, summary } = PerformanceAnalyzerCLI.analyzeProjectWithSummary(resolvedPath);
    
    let outputFile = outputPath;
    
    if (format === 'json') {
      const jsonReport = {
        summary,
        analyses,
        generatedAt: new Date().toISOString()
      };
      outputFile = outputFile || './performance-report.json';
      await PerformanceAnalyzerCLI.saveReportToFile(JSON.stringify(jsonReport, null, 2), outputFile);
      console.log(`JSON report saved to: ${outputFile}`);
    } else if (format === 'html') {
      const htmlReport = PerformanceAnalyzerCLI.generateHtmlReport(analyses, summary);
      outputFile = outputFile || './performance-report.html';
      await PerformanceAnalyzerCLI.saveReportToFile(htmlReport, outputFile);
      console.log(`HTML report saved to: ${outputFile}`);
      
      if (open) {
        await openInBrowser(outputFile);
      }
    } else {
      // Default markdown format
      const report = PerformanceAnalyzerCLI.generateReportWithSummary(analyses, summary);
      outputFile = outputFile || './performance-report.md';
      await PerformanceAnalyzerCLI.saveReportToFile(report, outputFile);
      console.log(`Performance report saved to: ${outputFile}`);
      
      if (open) {
        const htmlReport = PerformanceAnalyzerCLI.generateHtmlReport(analyses, summary);
        const htmlFile = outputFile.replace(/\.md$/, '.html') || './performance-report.html';
        await PerformanceAnalyzerCLI.saveReportToFile(htmlReport, htmlFile);
        console.log(`HTML report generated for viewing: ${htmlFile}`);
        await openInBrowser(htmlFile);
      }
    }
    
    return { analyses, summary, reportPath: outputFile };
  },

  // Analyze single component
  async component(componentPath: string) {
    if (!componentPath) {
      throw new Error('Component path is required');
    }
    
    const resolvedPath = path.resolve(componentPath);
    console.log(`Analyzing component: ${resolvedPath}`);
    
    const analyzer = new PerformanceAnalyzer();
    const analysis = analyzer.analyzeComponent(resolvedPath);
    
    console.log(`\nComponent Analysis Results:`);
    console.log(`   Name: ${analysis.componentName}`);
    console.log(`   Performance Score: ${analysis.performanceScore}/100`);
    
    const totalIssues = analysis.changeDetectionIssues.length + 
                       analysis.templateIssues.length + 
                       analysis.subscriptionIssues.length;
    console.log(`   Issues Found: ${totalIssues}`);
    
    if (analysis.recommendations.length > 0) {
      console.log(`\nTop Recommendations:`);
      analysis.recommendations.slice(0, 3).forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec.title} (${rec.priority} priority)`);
      });
    }
    
    return analysis;
  },

  // Generate detailed report
  async report(projectPath?: string, outputPath?: string, open?: boolean) {
    const resolvedPath = resolveProjectPath(projectPath);
    const defaultOutput = outputPath || './performance-report.md';
    
    console.log(`Generating detailed report for: ${resolvedPath}`);
    
    await ensureOutputDirectory(defaultOutput);
    
    const { analyses, summary } = PerformanceAnalyzerCLI.analyzeProjectWithSummary(resolvedPath);
    
    if (defaultOutput.endsWith('.html') || defaultOutput.endsWith('.htm')) {
      const htmlReport = PerformanceAnalyzerCLI.generateHtmlReport(analyses, summary);
      await PerformanceAnalyzerCLI.saveReportToFile(htmlReport, defaultOutput);
      console.log(`HTML report saved to: ${defaultOutput}`);
      if (open) {
        await openInBrowser(defaultOutput);
      }
    } else {
      const report = PerformanceAnalyzerCLI.generateReportWithSummary(analyses, summary);
      await PerformanceAnalyzerCLI.saveReportToFile(report, defaultOutput);
      console.log(`Performance report saved to: ${defaultOutput}`);
      
      if (open) {
        const htmlReport = PerformanceAnalyzerCLI.generateHtmlReport(analyses, summary);
        const htmlFile = defaultOutput.replace(/\.md$/, '.html');
        await PerformanceAnalyzerCLI.saveReportToFile(htmlReport, htmlFile);
        console.log(`HTML report generated for viewing: ${htmlFile}`);
        await openInBrowser(htmlFile);
      }
    }
    
    // Also log summary to console
    console.log(`\nAnalysis Summary:`);
    console.log(`   Components: ${summary.totalComponents}`);
    console.log(`   Average Score: ${summary.averagePerformanceScore}/100`);
    console.log(`   Total Issues: ${summary.totalIssues}`);
    
    return { analyses, summary, reportPath: defaultOutput };
  },

  // Show help
  help() {
    console.log(`
Angular Performance Analyzer CLI

USAGE:
  ngperf-audit <command> [options]

COMMANDS:
  project [path]              Analyze entire project
  component <path>            Analyze single component  
  report [path]               Generate detailed report
  help                        Show this help

OPTIONS:
  -o, --output <file>         Output file path
  -f, --format <type>         Report format: 'markdown', 'html' or 'json' (default: markdown)
  --open                      Open the HTML report in the default browser

EXAMPLES:
  ngperf-audit help                                         # Show this help
  ngperf-audit project                                      # Analyze current project
  ngperf-audit project ./src/app                           # Analyze src/app folder
  ngperf-audit project ./src/app --open                    # Analyze and open report in browser
  ngperf-audit project ./src/app -o ./reports/report.md    # Save to custom file
  ngperf-audit project ./src/app -f json                   # Generate JSON report
  ngperf-audit project ./src/app -f html --open            # Generate HTML report and open it
  
  ngperf-audit component ./src/app/app.component.ts        # Analyze single component
  
  ngperf-audit report                                       # Generate detailed report
  ngperf-audit report ./src/app -o ./my-report.html --open  # Custom HTML output path and open

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
    console.log('Angular Performance Analyzer');
    console.log('================================\n');
    
    const startTime = Date.now();
    const open = parsed.open || false;
    
    switch (command) {
      case 'project':
        const projectPath = parsed._[1];
        const outputPath = parsed.output || parsed.o;
        const format = parsed.format || parsed.f || 'markdown';
        await commands.project(projectPath, outputPath, format, open);
        break;
      case 'component':
        await commands.component(parsed._[1]);
        break;
      case 'report':
        const reportPath = parsed._[1];
        const reportOutput = parsed.output || parsed.o;
        await commands.report(reportPath, reportOutput, open);
        break;
    }
    
    const duration = Date.now() - startTime;
    console.log(`\nCompleted in ${duration}ms`);
    
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Export for programmatic use
export { commands };

// Run if called directly
if (require.main === module) {
  main();
}
