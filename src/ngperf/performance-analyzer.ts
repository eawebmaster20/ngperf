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

// Main Performance Analyzer Class
export class PerformanceAnalyzer {
  private sourceFile!: ts.SourceFile;
  private templateContent!: string;
  private componentInfo!: ComponentInfo;

  constructor(private typeChecker?: ts.TypeChecker) {}

  public analyzeComponent(componentPath: string): ComponentAnalysis {
    this.componentInfo = this.parseComponentFile(componentPath);
    this.sourceFile = ts.createSourceFile(
      this.componentInfo.filePath,
      this.componentInfo.sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const changeDetectionIssues = this.analyzeChangeDetection();
    const templateIssues = this.analyzeTemplate();
    const subscriptionIssues = this.analyzeSubscriptions();
    const bundleOptimizations = this.analyzeBundleOptimizations();

    const performanceScore = this.calculatePerformanceScore(
      changeDetectionIssues,
      templateIssues,
      subscriptionIssues
    );

    const recommendations = this.generateRecommendations(
      changeDetectionIssues,
      templateIssues,
      subscriptionIssues,
      bundleOptimizations
    );

    return {
      componentName: this.componentInfo.name,
      filePath: this.componentInfo.filePath,
      changeDetectionIssues,
      templateIssues,
      subscriptionIssues,
      bundleOptimizations,
      performanceScore,
      recommendations,
    };
  }

  private parseComponentFile(filePath: string): ComponentInfo {
    const sourceCode = readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    let componentName = '';
    let metadata: ComponentMetadata = {
      selector: '',
      inputs: [],
      outputs: [],
      providers: [],
    };

    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node) && node.name) {
        componentName = node.name.text;

        // Extract @Component decorator
        let decorators: readonly ts.Decorator[] | undefined;
        if (ts.canHaveDecorators(node)) {
          decorators = ts.getDecorators(node);
        }
        const decorator = decorators?.find(
          (d) =>
            ts.isDecorator(d) &&
            ts.isCallExpression(d.expression) &&
            ts.isIdentifier(d.expression.expression) &&
            d.expression.expression.text === 'Component'
        );

        if (decorator && ts.isCallExpression(decorator.expression)) {
          const arg = decorator.expression.arguments[0];
          if (ts.isObjectLiteralExpression(arg)) {
            metadata = this.parseComponentMetadata(arg);
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    let templateCode = '';
    if (metadata.templateUrl) {
      const templatePath = join(filePath, '..', metadata.templateUrl);
      try {
        templateCode = readFileSync(templatePath, 'utf8');
      } catch (error) {
        console.warn(`Could not read template file: ${templatePath}`);
      }
    }

    return {
      name: componentName,
      filePath,
      sourceCode,
      templateCode,
      metadata,
    };
  }

  private parseComponentMetadata(
    metadataObj: ts.ObjectLiteralExpression
  ): ComponentMetadata {
    const metadata: ComponentMetadata = {
      selector: '',
      inputs: [],
      outputs: [],
      providers: [],
    };

    metadataObj.properties.forEach((prop) => {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
        const name = prop.name.text;

        if (name === 'selector' && ts.isStringLiteral(prop.initializer)) {
          metadata.selector = prop.initializer.text;
        } else if (
          name === 'templateUrl' &&
          ts.isStringLiteral(prop.initializer)
        ) {
          metadata.templateUrl = prop.initializer.text;
        } else if (
          name === 'changeDetection' &&
          ts.isPropertyAccessExpression(prop.initializer)
        ) {
          metadata.changeDetection = prop.initializer.name.text;
        }
      }
    });

    return metadata;
  }

  private analyzeChangeDetection(): ChangeDetectionProblem[] {
    const issues: ChangeDetectionProblem[] = [];

    // Check if OnPush is missing - but only for components that would benefit from it
    if (
      !this.componentInfo.metadata.changeDetection ||
      this.componentInfo.metadata.changeDetection !== 'OnPush'
    ) {
      if (this.shouldRecommendOnPush()) {
        issues.push({
          type: 'missing-onpush',
          severity: 'high',
          location: this.getComponentDecoratorLocation(),
          description: 'Component uses default change detection strategy',
          estimatedImpact: '60% reduction in change detection cycles',
          fix: 'Add ChangeDetectionStrategy.OnPush to component decorator',
        });
      }
    }

    // Check for function calls in template
    if (this.componentInfo.templateCode) {
      const functionCalls = this.findFunctionCallsInTemplate(
        this.componentInfo.templateCode
      );
      functionCalls.forEach((call) => {
        issues.push({
          type: 'function-in-template',
          severity: 'high',
          location: call.location,
          description: `Function call '${call.functionName}' in template causes unnecessary re-execution`,
          estimatedImpact:
            'Significant performance degradation on each change detection',
          fix: 'Move function call to component property or use pipe',
        });
      });
    }

    // Check for object comparisons in ngIf
    if (this.componentInfo.templateCode) {
      const objectComparisons = this.findObjectComparisonsInTemplate(
        this.componentInfo.templateCode
      );
      objectComparisons.forEach((comparison) => {
        issues.push({
          type: 'object-comparison',
          severity: 'medium',
          location: comparison.location,
          description: `Object comparison in template: ${comparison.expression}`,
          estimatedImpact:
            'Unnecessary re-renders when object references change',
          fix: 'Use trackBy function or compare primitive values',
        });
      });
    }

    return issues;
  }

  private analyzeTemplate(): TemplatePerformanceIssue[] {
    const issues: TemplatePerformanceIssue[] = [];

    if (!this.componentInfo.templateCode) return issues;

    // Check for missing trackBy in ngFor
    const ngForLoops = this.findNgForLoops(this.componentInfo.templateCode);
    ngForLoops.forEach((loop) => {
      if (!loop.hasTrackBy) {
        issues.push({
          type: 'missing-trackby',
          severity: 'high',
          location: loop.location,
          description: `*ngFor loop missing trackBy function`,
          elementCount: loop.estimatedSize,
          fix: 'Add trackBy function to prevent unnecessary DOM manipulations',
        });
      }
    });

    // Check for async pipe opportunities
    const subscriptionUsages = this.findSubscriptionUsagesInTemplate(
      this.componentInfo.templateCode
    );
    subscriptionUsages.forEach((usage) => {
      issues.push({
        type: 'async-pipe-opportunity',
        severity: 'medium',
        location: usage.location,
        description: `Manual subscription can be replaced with async pipe`,
        fix: 'Replace manual subscription with async pipe for automatic unsubscription',
      });
    });

    // Check for large ngFor lists
    ngForLoops.forEach((loop) => {
      if (loop.estimatedSize && loop.estimatedSize > 100) {
        issues.push({
          type: 'large-ngfor',
          severity: 'high',
          location: loop.location,
          description: `Large ngFor loop with ~${loop.estimatedSize} items`,
          elementCount: loop.estimatedSize,
          fix: 'Consider virtual scrolling or pagination for large lists',
        });
      }
    });

    return issues;
  }

  private analyzeSubscriptions(): SubscriptionIssue[] {
    const issues: SubscriptionIssue[] = [];

    // Find manual subscriptions
    const subscriptions = this.findManualSubscriptions();
    subscriptions.forEach((sub) => {
      issues.push({
        type: 'manual-subscription',
        severity: 'medium',
        location: sub.location,
        description: `Manual subscription without proper cleanup: ${sub.variableName}`,
        fix: 'Use async pipe, takeUntil pattern, or implement OnDestroy',
      });
    });

    // Check for multiple subscriptions that could be combined
    if (subscriptions.length > 3) {
      issues.push({
        type: 'multiple-subscriptions',
        severity: 'low',
        location: this.getComponentDecoratorLocation(),
        description: `Component has ${subscriptions.length} manual subscriptions`,
        fix: 'Consider combining subscriptions using combineLatest or merge operators',
      });
    }

    return issues;
  }

  private analyzeBundleOptimizations(): BundleOptimization[] {
    const optimizations: BundleOptimization[] = [];

    // Check for lazy loading opportunities
    const imports = this.findImports();
    const largeImports = imports.filter((imp) =>
      this.isLargeLibrary(imp.moduleName)
    );

    largeImports.forEach((imp) => {
      optimizations.push({
        type: 'lazy-loading',
        description: `Large library '${imp.moduleName}' could be lazy loaded`,
        estimatedSizeReduction: '20-40KB',
        implementation:
          'Consider lazy loading this module or using dynamic imports',
      });
    });

    return optimizations;
  }

  private calculatePerformanceScore(
    changeDetectionIssues: ChangeDetectionProblem[],
    templateIssues: TemplatePerformanceIssue[],
    subscriptionIssues: SubscriptionIssue[]
  ): number {
    let score = 100;

    // Deduct points for each issue based on severity
    const deductPoints = (issues: any[]) => {
      issues.forEach((issue) => {
        switch (issue.severity) {
          case 'high':
            score -= 15;
            break;
          case 'medium':
            score -= 10;
            break;
          case 'low':
            score -= 5;
            break;
        }
      });
    };

    deductPoints(changeDetectionIssues);
    deductPoints(templateIssues);
    deductPoints(subscriptionIssues);

    return Math.max(0, score);
  }

  private generateRecommendations(
    changeDetectionIssues: ChangeDetectionProblem[],
    templateIssues: TemplatePerformanceIssue[],
    subscriptionIssues: SubscriptionIssue[],
    bundleOptimizations: BundleOptimization[]
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Priority recommendations based on impact
    const hasOnPushIssue = changeDetectionIssues.some(
      (issue) => issue.type === 'missing-onpush'
    );
    if (hasOnPushIssue) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        title: 'Implement OnPush Change Detection',
        description:
          'Switch to OnPush strategy to dramatically reduce change detection cycles',
        implementation:
          'Add ChangeDetectionStrategy.OnPush to @Component decorator',
        estimatedImpact: '60% reduction in change detection overhead',
      });
    }

    const hasTrackByIssues = templateIssues.some(
      (issue) => issue.type === 'missing-trackby'
    );
    if (hasTrackByIssues) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        title: 'Add TrackBy Functions',
        description:
          'Implement trackBy functions for all ngFor loops to prevent unnecessary DOM updates',
        implementation:
          'Create trackBy functions that return unique identifiers for list items',
        estimatedImpact:
          'Eliminate unnecessary DOM re-renders for list updates',
      });
    }

    const hasSubscriptionIssues = subscriptionIssues.length > 0;
    if (hasSubscriptionIssues) {
      recommendations.push({
        priority: 'medium',
        category: 'memory',
        title: 'Optimize Subscription Management',
        description:
          'Replace manual subscriptions with async pipes or proper cleanup',
        implementation:
          'Use async pipe in templates or implement takeUntil pattern',
        estimatedImpact: 'Prevent memory leaks and improve component cleanup',
      });
    }

    return recommendations;
  }

  /**
   * Determines if a component is complex enough to warrant OnPush strategy
   * Only recommends OnPush for components that have meaningful logic or complexity
   */
  private shouldRecommendOnPush(): boolean {
    const sourceCode = this.componentInfo.sourceCode;
    const templateCode = this.componentInfo.templateCode || '';
    
    // Check if component has meaningful complexity indicators
    const complexityIndicators = [
      // Has injected services (likely doing some logic)
      /constructor\s*\([^)]*\s+\w+Service/i,
      /constructor\s*\([^)]*\s+Http/i,
      /constructor\s*\([^)]*\s+Api/i,
      
      // Has lifecycle hooks (ngOnInit, ngOnChanges, etc.)
      /ngOnInit\s*\(/,
      /ngOnChanges\s*\(/,
      /ngAfterViewInit\s*\(/,
      /ngOnDestroy\s*\(/,
      
      // Has observables/subscriptions
      /\.subscribe\s*\(/,
      /Observable\s*</,
      /Subject\s*</,
      /BehaviorSubject\s*</,
      
      // Has form handling
      /FormBuilder/,
      /FormGroup/,
      /FormControl/,
      /Validators\./,
      
      // Has complex methods (more than just getters/setters)
      /\w+\s*\([^)]*\)\s*:\s*\w+\s*\{[\s\S]{50,}/,
      
      // Has computed properties
      /get\s+\w+\s*\(\s*\)\s*\{[\s\S]{20,}/,
      
      // Has event handlers
      /on\w+\s*\(/,
      /handle\w+\s*\(/,
      
      // Has inputs that could change frequently
      /@Input\(\)\s+\w+(?:\s*:\s*(?:any|object|\w+\[\]))/,
    ];

    // Check template complexity indicators
    const templateComplexityIndicators = [
      // Has ngFor loops (data iteration)
      /\*ngFor/,
      
      // Has conditional rendering
      /\*ngIf/,
      /\[ngSwitch\]/,
      
      // Has event bindings
      /\(\w+\)\s*=/,
      
      // Has property bindings
      /\[\w+\]\s*=/,
      
      // Has multiple interpolations
      /\{\{.*?\}\}/g,
    ];

    // Count complexity indicators in source code
    const sourceComplexityCount = complexityIndicators.reduce((count, pattern) => {
      return count + (pattern.test(sourceCode) ? 1 : 0);
    }, 0);

    // Count template complexity
    const templateMatches = templateCode.match(/\{\{.*?\}\}/g) || [];
    const hasTemplateComplexity = templateComplexityIndicators.some(pattern => 
      pattern.test(templateCode)
    );

    // Only recommend OnPush if component has meaningful complexity
    // Criteria:
    // - Has at least 2 source complexity indicators, OR
    // - Has template complexity AND at least 1 source complexity indicator, OR  
    // - Has many interpolations (>3) indicating data binding complexity
    return (
      sourceComplexityCount >= 2 ||
      (hasTemplateComplexity && sourceComplexityCount >= 1) ||
      templateMatches.length > 3
    );
  }

  // Helper methods for analysis
  private getComponentDecoratorLocation(): CodeLocation {
    return {
      file: this.componentInfo.filePath,
      line: 1,
      column: 1,
      snippet: '@Component({',
    };
  }

  private findFunctionCallsInTemplate(
    template: string
  ): Array<{ functionName: string; location: CodeLocation }> {
    const functionCalls: Array<{
      functionName: string;
      location: CodeLocation;
    }> = [];
    const regex = /\{\{\s*(\w+)\s*\(\s*\)\s*\}\}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      functionCalls.push({
        functionName: match[1],
        location: {
          file: this.componentInfo.templatePath || 'inline template',
          line: this.getLineNumber(template, match.index),
          column: this.getColumnNumber(template, match.index),
          snippet: match[0],
        },
      });
    }

    return functionCalls;
  }

  private findObjectComparisonsInTemplate(
    template: string
  ): Array<{ expression: string; location: CodeLocation }> {
    const comparisons: Array<{ expression: string; location: CodeLocation }> =
      [];
    const regex = /\*ngIf\s*=\s*"([^"]*\.\w+\s*===?\s*[^"]*)/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      comparisons.push({
        expression: match[1],
        location: {
          file: this.componentInfo.templatePath || 'inline template',
          line: this.getLineNumber(template, match.index),
          column: this.getColumnNumber(template, match.index),
          snippet: match[0],
        },
      });
    }

    return comparisons;
  }

  private findNgForLoops(template: string): Array<{
    location: CodeLocation;
    hasTrackBy: boolean;
    estimatedSize?: number;
  }> {
    const loops: Array<{
      location: CodeLocation;
      hasTrackBy: boolean;
      estimatedSize?: number;
    }> = [];
    const regex = /\*ngFor\s*=\s*"([^"]*)"/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      const hasTrackBy = match[1].includes('trackBy');
      loops.push({
        location: {
          file: this.componentInfo.templatePath || 'inline template',
          line: this.getLineNumber(template, match.index),
          column: this.getColumnNumber(template, match.index),
          snippet: match[0],
        },
        hasTrackBy,
        estimatedSize: this.estimateLoopSize(match[1]),
      });
    }

    return loops;
  }

  private findSubscriptionUsagesInTemplate(
    template: string
  ): Array<{ location: CodeLocation }> {
    const usages: Array<{ location: CodeLocation }> = [];
    const regex = /\{\{\s*(\w+)\s*\}\}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      if (this.isSubscriptionVariable(match[1])) {
        usages.push({
          location: {
            file: this.componentInfo.templatePath || 'inline template',
            line: this.getLineNumber(template, match.index),
            column: this.getColumnNumber(template, match.index),
            snippet: match[0],
          },
        });
      }
    }

    return usages;
  }

  private findManualSubscriptions(): Array<{
    location: CodeLocation;
    variableName: string;
  }> {
    const subscriptions: Array<{
      location: CodeLocation;
      variableName: string;
    }> = [];

    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'subscribe'
      ) {
        const sourceFile = node.getSourceFile();
        const lineChar = sourceFile.getLineAndCharacterOfPosition(
          node.getStart()
        );

        subscriptions.push({
          location: {
            file: this.componentInfo.filePath,
            line: lineChar.line + 1,
            column: lineChar.character + 1,
            snippet: node.getText(),
          },
          variableName: node.expression.expression.getText(),
        });
      }
      ts.forEachChild(node, visit);
    };

    visit(this.sourceFile);
    return subscriptions;
  }

  private findImports(): Array<{ moduleName: string; location: CodeLocation }> {
    const imports: Array<{ moduleName: string; location: CodeLocation }> = [];

    const visit = (node: ts.Node) => {
      if (
        ts.isImportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const sourceFile = node.getSourceFile();
        const lineChar = sourceFile.getLineAndCharacterOfPosition(
          node.getStart()
        );

        imports.push({
          moduleName: node.moduleSpecifier.text,
          location: {
            file: this.componentInfo.filePath,
            line: lineChar.line + 1,
            column: lineChar.character + 1,
            snippet: node.getText(),
          },
        });
      }
      ts.forEachChild(node, visit);
    };

    visit(this.sourceFile);
    return imports;
  }

  private estimateLoopSize(ngForExpression: string): number | undefined {
    // This is a simplified estimation - in real implementation, you'd analyze the component
    // to understand the data source size
    if (
      ngForExpression.includes('users') ||
      ngForExpression.includes('items')
    ) {
      return 50; // Estimated average
    }
    return undefined;
  }

  private isSubscriptionVariable(variableName: string): boolean {
    // Check if variable name suggests it's from a subscription
    return (
      variableName.includes('$') ||
      variableName.includes('subscription') ||
      variableName.includes('observable') ||
      variableName.includes('stream')
    );
  }

  private isLargeLibrary(moduleName: string): boolean {
    const largeLibraries = ['lodash', 'moment', 'rxjs', '@angular/material'];
    return largeLibraries.some((lib) => moduleName.includes(lib));
  }

  private getLineNumber(text: string, index: number): number {
    return text.substring(0, index).split('\n').length;
  }

  private getColumnNumber(text: string, index: number): number {
    const lines = text.substring(0, index).split('\n');
    return lines[lines.length - 1].length + 1;
  }
}


