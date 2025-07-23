#!/usr/bin/env node

/**
 * Main entry point for ngperf package
 * Exports the main classes and functions for programmatic usage
 */

export { 
  PerformanceAnalyzer, 
  PerformanceAnalyzerCLI 
} from './ngperf/performance-analyzer';

export { quickStartDemo } from './quick-start';

// Optional attribution helper
export { LicenseChecker } from './license-checker';
export type { AttributionInfo } from './license-checker';

export type {
  ComponentAnalysis,
  ChangeDetectionProblem,
  TemplatePerformanceIssue,
  SubscriptionIssue,
  BundleOptimization,
  OptimizationRecommendation,
  CodeLocation,
  ComponentInfo,
  ComponentMetadata,
  ProjectSummary
} from './ngperf/performance-analyzer';
