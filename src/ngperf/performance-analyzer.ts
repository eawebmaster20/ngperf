import * as ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

// Core interfaces for analysis results
export interface ComponentAnalysis {
  componentName: string;
  filePath: string;
  changeDetectionIssues: ChangeDetectionProblem[];
  templateIssues: TemplatePerformanceIssue[];
  subscriptionIssues: SubscriptionIssue[];
  bundleOptimizations: BundleOptimization[];
  performanceScore: number;
  recommendations: OptimizationRecommendation[];
}

export interface ChangeDetectionProblem {
  type:
    | 'missing-onpush'
    | 'function-in-template'
    | 'object-comparison'
    | 'unnecessary-computation';
  severity: 'high' | 'medium' | 'low';
  location: CodeLocation;
  description: string;
  estimatedImpact: string;
  fix: string;
}

export interface TemplatePerformanceIssue {
  type:
    | 'missing-trackby'
    | 'async-pipe-opportunity'
    | 'expensive-pipe'
    | 'large-ngfor';
  severity: 'high' | 'medium' | 'low';
  location: CodeLocation;
  description: string;
  elementCount?: number;
  fix: string;
}

export interface SubscriptionIssue {
  type: 'manual-subscription' | 'memory-leak' | 'multiple-subscriptions';
  severity: 'high' | 'medium' | 'low';
  location: CodeLocation;
  description: string;
  fix: string;
}

export interface BundleOptimization {
  type: 'lazy-loading' | 'tree-shaking' | 'code-splitting';
  description: string;
  estimatedSizeReduction: string;
  implementation: string;
}

export interface OptimizationRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'performance' | 'memory' | 'bundle-size';
  title: string;
  description: string;
  implementation: string;
  estimatedImpact: string;
}

export interface CodeLocation {
  file: string;
  line: number;
  column: number;
  snippet: string;
}

export interface ComponentInfo {
  name: string;
  filePath: string;
  templatePath?: string;
  sourceCode: string;
  templateCode?: string;
  metadata: ComponentMetadata;
}

export interface ComponentMetadata {
  selector: string;
  templateUrl?: string;
  styleUrls?: string[];
  changeDetection?: string;
  inputs: string[];
  outputs: string[];
  providers: string[];
}

export interface ProjectSummary {
  totalComponents: number;
  totalIssues: number;
  averagePerformanceScore: number;
  analysisErrors: number;
  issueBreakdown: Record<string, number>;
  topIssues: Array<{ type: string; count: number }>;
}


