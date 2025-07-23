#!/usr/bin/env node

/**
 * Quick Start Demo for Angular Performance Analyzer
 * 
 * This script demonstrates basic usage of the performance analyzer
 */

import { PerformanceAnalyzerCLI } from './ngperf/performance-analyzer';

async function quickStartDemo() {
  console.log('🚀 Angular Performance Analyzer - Quick Start Demo');
  console.log('=====================================================\n');

  const projectPath = './src';
  
  console.log('Step 1: Analyzing your Angular project...');
  console.log(`Project path: ${projectPath}\n`);

  try {
    // Run basic analysis
    const { analyses, summary } = PerformanceAnalyzerCLI.analyzeProjectWithSummary(projectPath);
    
    // Display summary
    console.log('📊 Quick Analysis Results:');
    console.log(`   └─ Components found: ${summary.totalComponents}`);
    console.log(`   └─ Average performance score: ${summary.averagePerformanceScore}/100`);
    console.log(`   └─ Total issues detected: ${summary.totalIssues}\n`);

    if (summary.totalComponents === 0) {
      console.log('⚠️  No Angular components found in the specified directory.');
      console.log('   Make sure you\'re running this from an Angular project root.');
      console.log('   Try: npm run analyze:project ./src/app\n');
      return;
    }

    // Show top issues
    if (summary.topIssues.length > 0) {
      console.log('🔍 Most Common Issues:');
      summary.topIssues.slice(0, 3).forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.type}: ${issue.count} occurrences`);
      });
      console.log('');
    }

    // Show worst performing components
    const worstComponents = analyses
      .sort((a, b) => a.performanceScore - b.performanceScore)
      .slice(0, 3);

    if (worstComponents.length > 0) {
      console.log('🚨 Components Needing Attention:');
      worstComponents.forEach((comp, index) => {
        const issueCount = comp.changeDetectionIssues.length + 
                          comp.templateIssues.length + 
                          comp.subscriptionIssues.length;
        console.log(`   ${index + 1}. ${comp.componentName} (Score: ${comp.performanceScore}/100, ${issueCount} issues)`);
      });
      console.log('');
    }

    // Generate report
    console.log('Step 2: Generating detailed report...');
    const report = PerformanceAnalyzerCLI.generateReportWithSummary(analyses, summary);
    const reportPath = './performance-report.md';
    
    await PerformanceAnalyzerCLI.saveReportToFile(report, reportPath);
    console.log(`   └─ Report saved to: ${reportPath}\n`);

    // Next steps
    console.log('🎯 Next Steps:');
    console.log('   1. Open performance-report.md to see detailed analysis');
    console.log('   2. Focus on high-severity issues first');
    console.log('   3. Run analysis again after making improvements');
    console.log('   4. Use: npm run ngperf help for more options\n');

    console.log('💡 Quick Commands:');
    console.log('   npm run ngperf:project     # Analyze entire project');
    console.log('   npm run ngperf:component   # Analyze single component');
    console.log('   npm run ngperf:report      # Generate detailed report');

  } catch (error) {
    console.error('❌ Demo failed:', error instanceof Error ? error.message : error);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure you\'re in an Angular project directory');
    console.log('   2. Ensure TypeScript files are accessible');
    console.log('   3. Try: npm run ngperf help for usage instructions');
  }
}

// Export for potential reuse
export { quickStartDemo };

// Run demo if called directly
if (require.main === module) {
  quickStartDemo();
}
