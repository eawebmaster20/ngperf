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
    | 'suboptimal-trackby'
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
  signals: Set<string>;
}

export interface ComponentMetadata {
  selector: string;
  templateUrl?: string;
  templateCode?: string;
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
    const signals = new Set<string>();

    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node) && node.name) {
        componentName = node.name.text;

        node.members.forEach((member) => {
          if (ts.isPropertyDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
            const propName = member.name.text;
            if (member.initializer && ts.isCallExpression(member.initializer)) {
              let isSignal = false;
              const expr = member.initializer.expression;
              
              if (ts.isIdentifier(expr)) {
                const callName = expr.text;
                if (['signal', 'computed', 'input', 'model', 'viewChild', 'contentChild', 'viewChildren', 'contentChildren'].includes(callName)) {
                  isSignal = true;
                }
              } else if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
                const objName = expr.expression.text;
                if (['input', 'model'].includes(objName)) {
                  isSignal = true;
                }
              }
              
              if (isSignal) {
                signals.add(propName);
              }
            }
          }
        });

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
    if (metadata.templateCode) {
      templateCode = metadata.templateCode;
    } else if (metadata.templateUrl) {
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
      signals,
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
        } else if (name === 'template') {
          if (ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
            metadata.templateCode = prop.initializer.text;
          } else if (ts.isTemplateExpression(prop.initializer)) {
            metadata.templateCode = prop.initializer.getText().slice(1, -1);
          }
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
        const syntaxType = loop.isModernSyntax ? '@for' : '*ngFor';
        const defaultFix = loop.isModernSyntax 
          ? 'Add track expression to prevent unnecessary DOM manipulations'
          : 'Add trackBy function to prevent unnecessary DOM manipulations';
        
        const smartFix = loop.recommendedTracking || defaultFix;
        
        issues.push({
          type: 'missing-trackby',
          severity: 'high',
          location: loop.location,
          description: `${syntaxType} loop missing tracking function`,
          elementCount: loop.estimatedSize,
          fix: smartFix,
        });
      } else if (loop.recommendedTracking) {
        // Has tracking but could be improved
        issues.push({
          type: 'suboptimal-trackby',
          severity: 'medium',
          location: loop.location,
          description: `${loop.isModernSyntax ? '@for' : '*ngFor'} loop tracking could be optimized`,
          elementCount: loop.estimatedSize,
          fix: loop.recommendedTracking,
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
    
    const interpolationRegex = /\{\{([\s\S]*?)\}\}/g;
    let interpolationMatch;

    while ((interpolationMatch = interpolationRegex.exec(template)) !== null) {
      const content = interpolationMatch[1];
      const interpolationIndex = interpolationMatch.index;
      
      const fnRegex = /\b(\w+)\s*\(/g;
      let fnMatch;
      while ((fnMatch = fnRegex.exec(content)) !== null) {
        const funcName = fnMatch[1];
        
        const skipNames = ['String', 'Number', 'Boolean', 'Array', 'Object', 'Math', 'Date', 'JSON'];
        if (skipNames.includes(funcName)) continue;
        if (this.componentInfo.signals && this.componentInfo.signals.has(funcName)) continue;
        
        const absoluteIndex = interpolationIndex + 2 + fnMatch.index;
        functionCalls.push({
          functionName: funcName,
          location: {
            file: this.componentInfo.templatePath || 'inline template',
            line: this.getLineNumber(template, absoluteIndex),
            column: this.getColumnNumber(template, absoluteIndex),
            snippet: fnMatch[0] + '...)',
          },
        });
      }
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
    isModernSyntax?: boolean;
    recommendedTracking?: string;
  }> {
    const loops: Array<{
      location: CodeLocation;
      hasTrackBy: boolean;
      estimatedSize?: number;
      isModernSyntax?: boolean;
      recommendedTracking?: string;
    }> = [];
    
    // Legacy *ngFor syntax
    const ngForRegex = /\*ngFor\s*=\s*"([^"]*)"/g;
    let match;

    while ((match = ngForRegex.exec(template)) !== null) {
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
        isModernSyntax: false
      });
    }

    // Modern @for syntax
    const modernForRegex = /@for\s*\(\s*([^;]+);\s*track\s+([^)]+)\)|@for\s*\(\s*([^)]+)\)/g;
    
    while ((match = modernForRegex.exec(template)) !== null) {
      const hasTrackBy = match[2] !== undefined; // Has track expression
      const loopExpression = match[1] || match[3]; // Get the loop expression
      const trackExpression = match[2]; // Get tracking expression if present
      
      // Analyze the loop expression for smart tracking recommendations
      const recommendedTracking = this.analyzeForTrackingRecommendation(loopExpression, trackExpression);
      
      loops.push({
        location: {
          file: this.componentInfo.templatePath || 'inline template',
          line: this.getLineNumber(template, match.index),
          column: this.getColumnNumber(template, match.index),
          snippet: match[0],
        },
        hasTrackBy,
        estimatedSize: this.estimateLoopSize(loopExpression),
        isModernSyntax: true,
        recommendedTracking
      });
    }

    return loops;
  }

  private analyzeForTrackingRecommendation(loopExpression: string, currentTracking?: string): string | undefined {
    if (currentTracking) {
      // Already has tracking, check if it could be improved
      if (currentTracking.includes('$index') && this.hasIdProperty(loopExpression)) {
        return 'Consider tracking by object id instead of $index for better performance';
      }
      return undefined;
    }

    // No tracking, provide recommendation
    if (this.hasIdProperty(loopExpression)) {
      const itemVar = this.extractItemVariable(loopExpression);
      return `Add tracking: track ${itemVar}.id`;
    } else {
      const itemVar = this.extractItemVariable(loopExpression);
      return `Add tracking: track ${itemVar}`;
    }
  }

  private hasIdProperty(loopExpression: string): boolean {
    // Simple heuristic: if the array variable contains 'item', 'user', 'product', etc.
    // and typically has id properties, suggest id tracking
    const commonIdPatterns = /\b(items?|users?|products?|entities?|records?|data|list|todos?|tasks?|messages?|posts?)\b/i;
    return commonIdPatterns.test(loopExpression);
  }

  private extractItemVariable(loopExpression: string): string {
    // Extract item variable from expressions like "let item of items" or "item of collection; let i = $index"
    const match = loopExpression.match(/let\s+(\w+)\s+of|(\w+)\s+of/);
    return match ? (match[1] || match[2]) : 'item';
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

  private hasProperCleanup(node: ts.CallExpression): boolean {
    let baseExpr = node.expression;
    if (ts.isPropertyAccessExpression(baseExpr)) {
      const obj = baseExpr.expression;
      
      if (ts.isCallExpression(obj) && ts.isPropertyAccessExpression(obj.expression) && obj.expression.name.text === 'pipe') {
        for (const arg of obj.arguments) {
          let operatorName = '';
          if (ts.isCallExpression(arg)) {
            const expr = arg.expression;
            if (ts.isIdentifier(expr)) {
              operatorName = expr.text;
            }
          } else if (ts.isIdentifier(arg)) {
            operatorName = arg.text;
          }
          
          if (['takeUntil', 'takeUntilDestroyed', 'take', 'first'].includes(operatorName)) {
            return true;
          }
        }
      }
    }
    
    let parent = node.parent;
    while (parent) {
      if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        return true;
      }
      if (ts.isPropertyDeclaration(parent) || ts.isVariableDeclaration(parent)) {
        return true;
      }
      if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression)) {
        const name = parent.expression.name.text;
        if (name === 'add' || name === 'push') {
          return true;
        }
      }
      if (ts.isMethodDeclaration(parent) || ts.isFunctionDeclaration(parent) || ts.isArrowFunction(parent)) {
        break;
      }
      parent = parent.parent;
    }
    
    return false;
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
        if (!this.hasProperCleanup(node)) {
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

// Usage example and CLI integration helper
export class PerformanceAnalyzerCLI {
  public static analyzeProject(projectPath?: string): ComponentAnalysis[] {
    const analyzer = new PerformanceAnalyzer();
    const results: ComponentAnalysis[] = [];

    // Use current working directory if no path provided
    const targetPath = projectPath || process.cwd();
    
    // In real implementation, you'd recursively find all component files
    // This is a simplified example
    const componentFiles = this.findComponentFiles(targetPath);

    componentFiles.forEach((filePath) => {
      try {
        const analysis = analyzer.analyzeComponent(filePath);
        results.push(analysis);
      } catch (error) {
        console.error(`Error analyzing ${filePath}:`, error);
      }
    });

    return results;
  }

  public static analyzeProjectWithSummary(projectPath?: string): {
    analyses: ComponentAnalysis[];
    summary: ProjectSummary;
  } {
    const analyzer = new PerformanceAnalyzer();
    const results: ComponentAnalysis[] = [];
    
    // Use current working directory if no path provided
    const targetPath = projectPath || process.cwd();
    
    const componentFiles = this.findComponentFiles(targetPath);

    console.log(`Found ${componentFiles.length} component files to analyze...`);

    let successCount = 0;
    let errorCount = 0;

    componentFiles.forEach((filePath, index) => {
      try {
        console.log(
          `Analyzing ${index + 1}/${componentFiles.length}: ${filePath}`
        );
        const analysis = analyzer.analyzeComponent(filePath);
        results.push(analysis);
        successCount++;
      } catch (error) {
        console.error(`Error analyzing ${filePath}:`, error);
        errorCount++;
      }
    });

    const summary = this.generateProjectSummary(
      results,
      successCount,
      errorCount
    );

    return {
      analyses: results,
      summary,
    };
  }

  private static generateProjectSummary(
    analyses: ComponentAnalysis[],
    successCount: number,
    errorCount: number
  ): ProjectSummary {
    const totalIssues = analyses.reduce((sum, analysis) => {
      return (
        sum +
        analysis.changeDetectionIssues.length +
        analysis.templateIssues.length +
        analysis.subscriptionIssues.length
      );
    }, 0);

    const averageScore =
      analyses.length > 0
        ? analyses.reduce(
            (sum, analysis) => sum + analysis.performanceScore,
            0
          ) / analyses.length
        : 0;

    const issuesByType = {
      'missing-onpush': 0,
      'function-in-template': 0,
      'missing-trackby': 0,
      'manual-subscription': 0,
      'async-pipe-opportunity': 0,
      'large-ngfor': 0,
    };

    analyses.forEach((analysis) => {
      analysis.changeDetectionIssues.forEach((issue) => {
        issuesByType[issue.type as keyof typeof issuesByType]++;
      });
      analysis.templateIssues.forEach((issue) => {
        issuesByType[issue.type as keyof typeof issuesByType]++;
      });
      analysis.subscriptionIssues.forEach((issue) => {
        issuesByType[issue.type as keyof typeof issuesByType]++;
      });
    });

    return {
      totalComponents: successCount,
      totalIssues,
      averagePerformanceScore: Math.round(averageScore * 100) / 100,
      analysisErrors: errorCount,
      issueBreakdown: issuesByType,
      topIssues: Object.entries(issuesByType)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([type, count]) => ({ type, count })),
    };
  }

  private static findComponentFiles(projectPath: string): string[] {
    const componentFiles: string[] = [];

    const traverseDirectory = (dirPath: string) => {
      try {
        const items = readdirSync(dirPath);

        for (const item of items) {
          const fullPath = join(dirPath, item);

          try {
            const stats = statSync(fullPath);

            if (stats.isDirectory()) {
              // Skip node_modules, dist, and other build directories
              if (!this.shouldSkipDirectory(item)) {
                traverseDirectory(fullPath);
              }
            } else if (stats.isFile()) {
              // Check if it's a component file
              if (this.isComponentFile(fullPath)) {
                componentFiles.push(fullPath);
              }
            }
          } catch (error) {
            // Skip files/directories we can't access
            console.warn(
              `Could not access ${fullPath}:`,
              error instanceof Error ? error.message : error
            );
          }
        }
      } catch (error) {
        console.warn(
          `Could not read directory ${dirPath}:`,
          error instanceof Error ? error.message : error
        );
      }
    };

    traverseDirectory(projectPath);
    return componentFiles;
  }

  private static shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules',
      'dist',
      'build',
      '.git',
      '.angular',
      'coverage',
      'e2e',
      '.vscode',
      '.idea',
      'tmp',
      'temp',
    ];

    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  private static isComponentFile(filePath: string): boolean {
    if (!filePath.endsWith('.ts') || filePath.endsWith('.spec.ts') || filePath.endsWith('.test.ts') || filePath.endsWith('.d.ts')) {
      return false;
    }

    try {
      const content = readFileSync(filePath, 'utf8');

      // Check if file contains @Component decorator and a class declaration
      const hasComponentDecorator = content.includes('@Component');
      const hasClassDeclaration = /class\s+\w+/i.test(content);

      return hasComponentDecorator && hasClassDeclaration;
    } catch (error) {
      console.warn(
        `Could not validate component file ${filePath}:`,
        error instanceof Error ? error.message : error
      );
      return false;
    }
  }

  public static generateReport(analyses: ComponentAnalysis[]): string {
    let report = '# Angular Performance Analysis Report\n\n';

    if (analyses.length === 0) {
      report += 'No components found to analyze.\n\n';
      return report;
    }

    // Project overview
    const totalIssues = analyses.reduce((sum, analysis) => {
      return (
        sum +
        analysis.changeDetectionIssues.length +
        analysis.templateIssues.length +
        analysis.subscriptionIssues.length
      );
    }, 0);

    const averageScore =
      analyses.reduce((sum, analysis) => sum + analysis.performanceScore, 0) /
      analyses.length;

    report += `## Project Overview\n`;
    report += `- **Components Analyzed**: ${analyses.length}\n`;
    report += `- **Average Performance Score**: ${
      Math.round(averageScore * 100) / 100
    }/100\n`;
    report += `- **Total Issues Found**: ${totalIssues}\n\n`;

    // Performance distribution
    const scoreRanges = {
      excellent: analyses.filter((a) => a.performanceScore >= 90).length,
      good: analyses.filter(
        (a) => a.performanceScore >= 70 && a.performanceScore < 90
      ).length,
      fair: analyses.filter(
        (a) => a.performanceScore >= 50 && a.performanceScore < 70
      ).length,
      poor: analyses.filter((a) => a.performanceScore < 50).length,
    };

    report += `## Performance Distribution\n`;
    report += `- **Excellent (90-100)**: ${scoreRanges.excellent} components\n`;
    report += `- **Good (70-89)**: ${scoreRanges.good} components\n`;
    report += `- **Fair (50-69)**: ${scoreRanges.fair} components\n`;
    report += `- **Poor (0-49)**: ${scoreRanges.poor} components\n\n`;

    // Top priority components (lowest scores)
    const sortedByScore = [...analyses].sort(
      (a, b) => a.performanceScore - b.performanceScore
    );
    const topPriority = sortedByScore.slice(0, 5);

    if (topPriority.length > 0) {
      report += `## Top Priority Components (Lowest Scores)\n`;
      topPriority.forEach((analysis, index) => {
        report += `${index + 1}. **${analysis.componentName}** - Score: ${
          analysis.performanceScore
        }/100\n`;
      });
      report += '\n';
    }

    // Detailed component analysis
    report += `## Detailed Component Analysis\n\n`;

    analyses.forEach((analysis) => {
      report += `### ${analysis.componentName}\n`;
      report += `**File**: \`${analysis.filePath}\`  \n`;
      report += `**Performance Score**: ${analysis.performanceScore}/100\n\n`;

      const allIssues = [
        ...analysis.changeDetectionIssues,
        ...analysis.templateIssues,
        ...analysis.subscriptionIssues,
      ];

      if (allIssues.length > 0) {
        report += `#### Issues Found (${allIssues.length})\n`;

        // Group by severity
        const highSeverity = allIssues.filter((i) => i.severity === 'high');
        const mediumSeverity = allIssues.filter((i) => i.severity === 'medium');
        const lowSeverity = allIssues.filter((i) => i.severity === 'low');

        [
          { severity: 'high', issues: highSeverity, label: 'High' },
          { severity: 'medium', issues: mediumSeverity, label: 'Medium' },
          { severity: 'low', issues: lowSeverity, label: 'Low' },
        ].forEach((group) => {
          if (group.issues.length > 0) {
            group.issues.forEach((issue) => {
              report += `[${group.label}] **${issue.type}** (${issue.severity})\n`;
              report += `   ${issue.description}\n`;
              report += `   *Fix*: ${issue.fix}\n\n`;
            });
          }
        });
      }

      if (analysis.recommendations.length > 0) {
        report += '#### Recommendations\n';
        analysis.recommendations.forEach((rec) => {
          report += `[Recommendation] **${rec.title}** (${rec.priority} priority)\n`;
          report += `   ${rec.description}\n`;
          report += `   *Impact*: ${rec.estimatedImpact}\n\n`;
        });
      }

      report += '---\n\n';
    });

    return report;
  }

  public static generateReportWithSummary(
    analyses: ComponentAnalysis[],
    summary: ProjectSummary
  ): string {
    let report = this.generateReport(analyses);

    // Add summary section at the end
    report += `## Analysis Summary\n\n`;
    report += `- **Components Processed**: ${summary.totalComponents}\n`;
    report += `- **Analysis Errors**: ${summary.analysisErrors}\n`;
    report += `- **Average Score**: ${summary.averagePerformanceScore}/100\n\n`;

    if (summary.topIssues.length > 0) {
      report += `### Most Common Issues\n`;
      summary.topIssues.forEach((issue, index) => {
        report += `${index + 1}. **${issue.type}**: ${
          issue.count
        } occurrences\n`;
      });
    }

    return report;
  }

  public static generateHtmlReport(
    analyses: ComponentAnalysis[],
    summary: ProjectSummary
  ): string {
    const componentDataJson = JSON.stringify(analyses);
    const summaryDataJson = JSON.stringify(summary);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Angular Performance Audit Report</title>
  <style>
    :root {
      --bg-dark: #fafafa;
      --bg-card: #ffffff;
      --bg-card-hover: #f4f4f5;
      --border-color: #e4e4e7;
      --border-color-hover: #d4d4d8;
      --text-main: #09090b;
      --text-muted: #71717a;
      --color-high: #ef4444;
      --color-medium: #d97706;
      --color-low: #059669;
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      font-family: var(--font-sans);
      line-height: 1.5;
      padding: 3rem 2rem;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    header {
      margin-bottom: 3rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    
    .header-title h1 {
      font-size: 1.75rem;
      font-weight: 600;
      letter-spacing: -0.03em;
    }
    
    .header-title p {
      color: var(--text-muted);
      font-size: 0.95rem;
      margin-top: 0.35rem;
    }
    
    .header-date {
      color: var(--text-muted);
      font-size: 0.85rem;
      font-family: var(--font-mono);
    }
    
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5rem;
      margin-bottom: 3rem;
    }
    
    @media (max-width: 768px) {
      .dashboard-grid {
        grid-template-columns: 1fr;
      }
    }
    
    .metric-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.5rem;
    }
    
    .metric-title {
      font-size: 0.75rem;
      font-weight: 550;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    
    .metric-value {
      font-size: 2rem;
      font-weight: 600;
      letter-spacing: -0.03em;
      font-family: var(--font-mono);
    }
    
    .metric-sub {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 0.5rem;
    }
    
    .main-layout {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 3rem;
    }
    
    @media (max-width: 960px) {
      .main-layout {
        grid-template-columns: 1fr;
        gap: 2rem;
      }
    }
    
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    
    .search-box {
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 0.65rem 0.85rem;
      color: var(--text-main);
      font-family: inherit;
      font-size: 0.875rem;
      outline: none;
      transition: border-color 0.15s ease;
    }
    
    .search-box:focus {
      border-color: var(--border-color-hover);
    }
    
    .filter-section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    
    .section-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    
    .severity-filters {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    
    .filter-btn {
      background: none;
      border: 1px solid transparent;
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
      color: var(--text-muted);
      cursor: pointer;
      text-align: left;
      font-size: 0.875rem;
      transition: all 0.15s ease;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .filter-btn:hover {
      background: rgba(0, 0, 0, 0.02);
      color: var(--text-main);
    }
    
    .filter-btn.active {
      background: var(--bg-card);
      border-color: var(--border-color);
      color: var(--text-main);
    }
    
    .filter-count {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      background: rgba(0, 0, 0, 0.05);
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
    }
    
    .components-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    
    .component-node {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
    }
    
    .component-summary {
      padding: 1.25rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s ease;
    }
    
    .component-summary:hover {
      background: rgba(0, 0, 0, 0.005);
    }
    
    .component-meta {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    
    .component-name {
      font-weight: 550;
      font-size: 1.05rem;
      letter-spacing: -0.01em;
    }
    
    .component-path {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-family: var(--font-mono);
      word-break: break-all;
    }
    
    .component-stats {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    
    .score-badge {
      font-family: var(--font-mono);
      font-weight: 600;
      font-size: 0.85rem;
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
      border: 1px solid;
    }
    
    .score-excellent {
      background: rgba(5, 150, 105, 0.05);
      border-color: rgba(5, 150, 105, 0.15);
      color: var(--color-low);
    }
    
    .score-good {
      background: rgba(217, 119, 6, 0.05);
      border-color: rgba(217, 119, 6, 0.15);
      color: var(--color-medium);
    }
    
    .score-poor {
      background: rgba(239, 68, 68, 0.05);
      border-color: rgba(239, 68, 68, 0.15);
      color: var(--color-high);
    }
    
    .toggle-icon {
      color: var(--text-muted);
      transition: transform 0.15s ease;
      width: 16px;
      height: 16px;
    }
    
    .component-node.expanded .toggle-icon {
      transform: rotate(180deg);
    }
    
    .component-details {
      border-top: 1px solid var(--border-color);
      padding: 1.5rem;
      display: none;
      background: rgba(0, 0, 0, 0.01);
    }
    
    .component-node.expanded .component-details {
      display: block;
    }
    
    .details-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
      color: var(--text-muted);
    }
    
    .issue-card {
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 1rem 1.25rem;
      margin-bottom: 1rem;
      background: var(--bg-card);
    }
    
    .issue-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    
    .issue-label {
      font-weight: 600;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    
    .issue-card.high { border-left: 3px solid var(--color-high); }
    .issue-card.high .issue-label { color: var(--color-high); }
    
    .issue-card.medium { border-left: 3px solid var(--color-medium); }
    .issue-card.medium .issue-label { color: var(--color-medium); }
    
    .issue-card.low { border-left: 3px solid var(--color-low); }
    .issue-card.low .issue-label { color: var(--color-low); }
    
    .issue-loc {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }
    
    .issue-text {
      font-size: 0.875rem;
      color: var(--text-main);
      margin-bottom: 0.5rem;
    }
    
    .issue-impact-tag {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
    }
    
    .issue-code {
      font-size: 0.8rem;
      font-family: var(--font-mono);
      background: #f4f4f5;
      border: 1px solid var(--border-color);
      padding: 0.65rem 0.85rem;
      border-radius: 4px;
      color: #0f172a;
      overflow-x: auto;
      white-space: pre;
    }
    
    .rec-card {
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 1rem 1.25rem;
      margin-bottom: 0.75rem;
      background: var(--bg-card);
    }
    
    .rec-heading {
      font-weight: 600;
      color: #2563eb;
      font-size: 0.9rem;
      margin-bottom: 0.25rem;
    }
    
    .rec-text {
      font-size: 0.85rem;
      color: var(--text-main);
      margin-bottom: 0.25rem;
    }
    
    .rec-impact-label {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    
    .empty-state {
      border: 1px dashed var(--border-color);
      border-radius: 8px;
      padding: 3rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-title">
        <h1>Angular Performance Audit</h1>
        <p>Project analysis summary report</p>
      </div>
      <div class="header-date" id="date-label"></div>
    </header>

    <div class="dashboard-grid">
      <div class="metric-card">
        <span class="metric-title">Average Performance</span>
        <span class="metric-value" id="summary-score">-</span>
        <span class="metric-sub">Score out of 100</span>
      </div>
      <div class="metric-card">
        <span class="metric-title">Components</span>
        <span class="metric-value" id="summary-components">-</span>
        <span class="metric-sub">Files analyzed</span>
      </div>
      <div class="metric-card">
        <span class="metric-title">Total Issues</span>
        <span class="metric-value" id="summary-issues">-</span>
        <span class="metric-sub">Performance bottlenecks</span>
      </div>
    </div>

    <div class="main-layout">
      <div class="sidebar">
        <input type="text" id="search-input" class="search-box" placeholder="Search components...">
        
        <div class="filter-section">
          <span class="section-label">Filter by Severity</span>
          <div class="severity-filters">
            <button class="filter-btn active" data-severity="all">
              <span>All Components</span>
              <span class="filter-count" id="badge-count-all">0</span>
            </button>
            <button class="filter-btn" data-severity="high">
              <span>High Severity</span>
              <span class="filter-count" id="badge-count-high">0</span>
            </button>
            <button class="filter-btn" data-severity="medium">
              <span>Medium Severity</span>
              <span class="filter-count" id="badge-count-medium">0</span>
            </button>
            <button class="filter-btn" data-severity="low">
              <span>Low Severity</span>
              <span class="filter-count" id="badge-count-low">0</span>
            </button>
          </div>
        </div>
      </div>

      <div class="components-list" id="results-container">
        <!-- Generated dynamically -->
      </div>
    </div>
  </div>

  <script>
    const analyses = ${componentDataJson};
    const summary = ${summaryDataJson};
    
    document.getElementById('date-label').innerText = new Date().toLocaleString();
    document.getElementById('summary-score').innerText = summary.averagePerformanceScore + '/100';
    document.getElementById('summary-components').innerText = summary.totalComponents;
    document.getElementById('summary-issues').innerText = summary.totalIssues;

    let currentFilter = 'all';
    let searchQuery = '';

    function getCount(severity) {
      if (severity === 'all') return analyses.length;
      return analyses.filter(a => {
        const issues = [...a.changeDetectionIssues, ...a.templateIssues, ...a.subscriptionIssues];
        return issues.some(i => i.severity === severity);
      }).length;
    }

    document.getElementById('badge-count-all').innerText = getCount('all');
    document.getElementById('badge-count-high').innerText = getCount('high');
    document.getElementById('badge-count-medium').innerText = getCount('medium');
    document.getElementById('badge-count-low').innerText = getCount('low');

    function renderResults() {
      const container = document.getElementById('results-container');
      container.innerHTML = '';
      
      const filtered = analyses.filter(a => {
        if (searchQuery && !a.componentName.toLowerCase().includes(searchQuery.toLowerCase()) && !a.filePath.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        
        if (currentFilter !== 'all') {
          const issues = [...a.changeDetectionIssues, ...a.templateIssues, ...a.subscriptionIssues];
          if (!issues.some(i => i.severity === currentFilter)) {
            return false;
          }
        }
        
        return true;
      });

      if (filtered.length === 0) {
        container.innerHTML = \`<div class="empty-state">No components match the active filter criteria.</div>\`;
        return;
      }

      filtered.forEach(a => {
        const node = document.createElement('div');
        node.className = 'component-node';
        
        let scoreClass = 'score-excellent';
        if (a.performanceScore < 50) scoreClass = 'score-poor';
        else if (a.performanceScore < 90) scoreClass = 'score-good';

        const allIssues = [...a.changeDetectionIssues, ...a.templateIssues, ...a.subscriptionIssues];

        let issuesHtml = '';
        if (allIssues.length > 0) {
          issuesHtml += \`<div class="details-title">Detected Issues (\${allIssues.length})</div>\`;
          allIssues.sort((x, y) => {
            const priority = { 'high': 3, 'medium': 2, 'low': 1 };
            return priority[y.severity] - priority[x.severity];
          }).forEach(issue => {
            const locStr = issue.location ? \`Line \${issue.location.line}, Col \${issue.location.column}\` : '';
            const impactHtml = issue.estimatedImpact ? \`<div class="issue-impact-tag">Impact: \${issue.estimatedImpact}</div>\` : '';
            issuesHtml += \`
              <div class="issue-card \${issue.severity}">
                <div class="issue-card-header">
                  <span class="issue-label">\${issue.type.replace('-', ' ')}</span>
                  <span class="issue-loc">\${locStr}</span>
                </div>
                <div class="issue-text">\${issue.description}</div>
                \${impactHtml}
                <div class="issue-code">Fix: \${escapeHtml(issue.fix)}</div>
              </div>
            \`;
          });
        } else {
          issuesHtml += \`<div class="details-title">No Issues Found</div><p style="font-size:0.875rem;color:var(--text-muted)">This component is fully optimized.</p>\`;
        }

        let recommendationsHtml = '';
        if (a.recommendations && a.recommendations.length > 0) {
          recommendationsHtml += \`<div class="details-title" style="margin-top:2rem">Recommendations</div>\`;
          a.recommendations.forEach(rec => {
            recommendationsHtml += \`
              <div class="rec-card">
                <div class="rec-heading">\${rec.title}</div>
                <div class="rec-text">\${rec.description}</div>
                <div class="rec-impact-label">Impact: \${rec.estimatedImpact}</div>
              </div>
            \`;
          });
        }

        node.innerHTML = \`
          <div class="component-summary" onclick="this.parentElement.classList.toggle('expanded')">
            <div class="component-meta">
              <span class="component-name">\${a.componentName}</span>
              <span class="component-path">\${a.filePath}</span>
            </div>
            <div class="component-stats">
              <span class="score-badge \${scoreClass}">\${a.performanceScore}/100</span>
              <svg class="toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
          <div class="component-details">
            \${issuesHtml}
            \${recommendationsHtml}
          </div>
        \`;
        
        container.appendChild(node);
      });
    }

    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    document.getElementById('search-input').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderResults();
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-severity');
        renderResults();
      });
    });

    renderResults();
  </script>
</body>
</html>`;
  }

  public static async saveReportToFile(
    report: string,
    outputPath: string = 'performance-report.md'
  ): Promise<void> {
    const fs = await import('fs/promises');
    try {
      await fs.writeFile(outputPath, report, 'utf8');
      console.log(`Performance report saved to: ${outputPath}`);
    } catch (error) {
      console.error(`Failed to save report:`, error);
      throw error;
    }
  }

  public static runAnalysis(
    projectPath?: string,
    outputPath?: string
  ): ComponentAnalysis[] {
    const targetPath = projectPath || process.cwd();
    
    console.log(`Starting performance analysis for: ${targetPath}`);

    const startTime = Date.now();
    const { analyses, summary } = this.analyzeProjectWithSummary(targetPath);
    const endTime = Date.now();

    console.log(`\nAnalysis completed in ${endTime - startTime}ms`);
    console.log(
      `Results: ${summary.totalComponents} components, ${summary.totalIssues} issues found`
    );

    const report = this.generateReportWithSummary(analyses, summary);

    if (outputPath) {
      this.saveReportToFile(report, outputPath).catch(console.error);
    } else {
      console.log('\n' + report);
    }

    return analyses;
  }
}
