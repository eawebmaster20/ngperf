# ngperf-audit

A comprehensive Angular performance analyzer that identifies performance bottlenecks, memory leaks, and optimization opportunities in Angular applications.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Smart OnPush Detection** - Recommends OnPush for components that would actually benefit from it.
- **Memory Leak Detection** - Identifies subscription issues and memory leaks, with smart support for RxJS pipe operators and manual properties.
- **Template Optimization** - Finds missing trackBy functions, template performance issues, and functions called within template interpolation (excluding Signals).
- **Performance Scoring** - Gives each component a performance score out of 100.
- **Detailed Reports** - Generates comprehensive markdown and interactive HTML reports with actionable recommendations.
- **Browser Report Viewer** - Automatically opens audit reports in the default browser to view results in a premium, interactive dashboard.
- **Targeted Analysis** - Focuses on components with actual complexity.

## Installation

### Global Installation (Recommended for CLI usage)
```bash
npm install -g ngperf-audit
```
After global installation, you can use the `ngperf-audit` command anywhere.

### Project Installation
```bash
# As dev dependency
npm install --save-dev ngperf-audit
```

**Note**: When installed locally in a project, use one of these methods:

**Option 1: Use npx (recommended)**
```bash
npx ngperf-audit project ./src/app
```

**Option 2: Add to package.json scripts**
```json
{
  "scripts": {
    "perf-check": "ngperf-audit project ./src/app --open",
    "perf-report": "ngperf-audit report ./src/app --open"
  }
}
```
Then run: `npm run perf-check`

**Option 3: Use full path**
```bash
./node_modules/.bin/ngperf-audit help
```

## Quick Start

### Command Line Usage

```bash
# Global installation - use directly
ngperf-audit project ./src/app --open

# Local installation - use with npx
npx ngperf-audit project ./src/app --open

# Or use npm scripts (see Installation section)
npm run perf-check
```

### Examples

```bash
# Analyze entire Angular project
ngperf-audit project ./src/app

# Analyze and open interactive HTML report in browser
ngperf-audit project ./src/app --open

# Save HTML report to a custom path and open
ngperf-audit project ./src/app -f html -o ./reports/perf-report.html --open

# Analyze specific component
ngperf-audit component ./src/app/my-component/my-component.ts

# Generate detailed report
ngperf-audit report ./src/app

# Get help
ngperf-audit help
```

### Programmatic Usage

```typescript
import { PerformanceAnalyzerCLI, PerformanceAnalyzer } from 'ngperf-audit';

// Quick analysis with summary
const { analyses, summary } = PerformanceAnalyzerCLI.analyzeProjectWithSummary('./src/app');

console.log(`Found ${summary.totalComponents} components`);
console.log(`Average score: ${summary.averagePerformanceScore}/100`);

// Generate markdown report
const report = PerformanceAnalyzerCLI.generateReportWithSummary(analyses, summary);
await PerformanceAnalyzerCLI.saveReportToFile(report, './performance-report.md');

// Generate HTML report
const htmlReport = PerformanceAnalyzerCLI.generateHtmlReport(analyses, summary);
await PerformanceAnalyzerCLI.saveReportToFile(htmlReport, './performance-report.html');
```

## Commands

### `ngperf-audit project <path>`
Analyzes all Angular components in the specified directory and generates a comprehensive report.

**Options:**
- `-o, --output <file>`: Output file path for the report (default: `./performance-report.md` or `./performance-report.html`)
- `-f, --format <type>`: Report format - `markdown`, `html`, or `json` (default: `markdown`)
- `--open`: Open the HTML report automatically in your default browser

**Examples:**
```bash
ngperf-audit project ./src/app
ngperf-audit project ./src/app -o ./reports/perf-analysis.md
ngperf-audit project ./src/app -f html --open
ngperf-audit project ./src/app -o ./reports/analysis.json -f json
```

### `ngperf-audit component <path>`
Analyzes a single Angular component file.

**Example:**
```bash
ngperf-audit component ./src/app/user-profile/user-profile.component.ts
```

### `ngperf-audit report <path>`
Generates a detailed performance report for the specified directory.

**Options:**
- `-o, --output <file>`: Output file path
- `--open`: Open the generated report automatically in the browser (generates HTML if markdown is selected)

### `ngperf-audit help`
Shows help information and available commands.

## What It Analyzes

### Smart OnPush Detection
Unlike other tools that blindly recommend OnPush for every component, ngperf intelligently determines which components would actually benefit:

- **Recommends OnPush for components with:**
  - Service injections (HttpClient, APIs, etc.)
  - Lifecycle hooks (ngOnInit, ngOnChanges)
  - Observable subscriptions
  - Form handling (FormBuilder, FormGroup)
  - Complex methods and computed properties
  - Event handlers
  - Template complexity (ngFor, ngIf, event bindings)

- **Skips simple "dummy" components that:**
  - Only display static content
  - Have minimal logic
  - Don't use services or observables
  - Have simple templates

### Memory Leak Detection
- Manual subscriptions without proper cleanup
- Recognizes RxJS pipe cleanup operators (`takeUntil`, `takeUntilDestroyed`, `take`, `first`)
- Recognizes manual subscription assignments and collections (`this.sub = ...`, `this.subs.add(...)`)
- Multiple subscriptions that could be optimized

### Template Performance
- Missing trackBy functions in ngFor loops or track expressions in `@for` control flow
- Function calls in templates (fully ignores Angular Signals, preventing false positives)
- Opportunities for async pipes
- Large lists that need virtual scrolling

### Performance Scoring
Each component gets a score from 0-100 based on:
- Change detection strategy appropriateness
- Template optimization
- Subscription management
- Overall complexity vs. optimization

## Integration with CI/CD

Add performance checks to your build process:

```json
{
  "scripts": {
    "perf-check": "ngperf-audit project ./src/app --format json",
    "perf-report": "ngperf-audit project ./src/app"
  }
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

**ngperf-audit is free for everyone with attribution requirements**

### Free for All Use Cases
- Personal projects
- Open source projects  
- Commercial applications
- Enterprise use
- SaaS products
- Consulting work

### Attribution Required
Just give credit where it's due! Include attribution in one of these ways:

**In your app's About/Credits section:**
```
Performance analysis powered by ngperf-audit
Created by eawebmaster20 (https://eaweb-solutions.com)
```

**In your project's README:**
```markdown
## Performance Analysis
This project uses [ngperf-audit](https://github.com/eawebmaster20/ngperf) 
for Angular performance analysis.
```

**In CLI output:**
```
Powered by ngperf-audit (https://github.com/eawebmaster20/ngperf)
```

### Show Your Appreciation (Optional)
- Star the GitHub repository
- Mention @eawebmaster20 on social media
- Write a blog post about your experience
- Contribute improvements

Full license details: [MIT with Attribution](LICENSE)

## Support

- **Community Support**: [GitHub Issues](https://github.com/eawebmaster20/ngperf/issues)
- **Documentation**: [GitHub Wiki](https://github.com/eawebmaster20/ngperf/wiki)

- Report bugs: [GitHub Issues](https://github.com/eawebmaster20/ngperf/issues)
- Request features: [GitHub Issues](https://github.com/eawebmaster20/ngperf/issues)
- Documentation: [GitHub Readme](https://github.com/eawebmaster20/ngperf#readme)

---

Made for the Angular community
