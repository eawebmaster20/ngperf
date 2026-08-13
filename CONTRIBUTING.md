# Contributing to ngperf-audit

Thank you for your interest in contributing to ngperf-audit! 🎉 We welcome contributions from the Angular community and appreciate your help in making this tool better for everyone.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [eawebmaster20@gmail.com](mailto:eawebmaster20@gmail.com).

## How Can You Contribute?

### 🐛 Bug Reports
- Found a bug? Please check [existing issues](https://github.com/eaweb20/ngperf/issues) first
- Use the bug report template when creating new issues
- Provide detailed reproduction steps and environment information

### 💡 Feature Requests
- Have an idea for improvement? We'd love to hear it!
- Check existing feature requests first to avoid duplicates
- Use the feature request template
- Explain the use case and expected benefits

### 📝 Documentation
- Fix typos, improve clarity, or add missing documentation
- Update examples and usage instructions
- Improve inline code comments

### 🔧 Code Contributions
- Fix bugs or implement new features
- Add tests for your changes
- Follow our coding standards (see below)

## Getting Started

### Prerequisites
- Node.js 16.0.0 or higher
- npm or yarn package manager
- Git
- TypeScript knowledge
- Basic understanding of Angular concepts

### Development Setup

1. **Fork the repository**
   ```bash
   # Click "Fork" on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/ngperf.git
   cd ngperf
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Test the CLI locally**
   ```bash
   # Test development version
   npm run ngperf-audit help
   
   # Test built version
   node dist/cli.js help
   ```

### Project Structure

```
ngperf/
├── src/
│   ├── ngperf/
│   │   ├── performance-analyzer.ts  # Core analysis logic
│   │   ├── cli.ts                   # CLI implementation
│   │   └── README.md               # Internal documentation
│   ├── cli.ts                      # Main CLI entry point
│   └── index.ts                    # Package exports
├── dist/                           # Compiled output
├── README.md                       # Main documentation
├── CODE_OF_CONDUCT.md             # Community guidelines
├── CONTRIBUTING.md                # This file
└── package.json                   # Package configuration
```

## Development Guidelines

### Coding Standards

#### TypeScript
- Use TypeScript strict mode
- Follow existing code style and formatting
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

```typescript
/**
 * Analyzes Angular component for performance issues
 * @param componentPath - Absolute path to component file
 * @returns Analysis results with recommendations
 */
public analyzeComponent(componentPath: string): ComponentAnalysis {
  // Implementation
}
```

#### Error Handling
- Use descriptive error messages
- Handle edge cases gracefully
- Provide helpful suggestions when possible

```typescript
if (!fs.existsSync(componentPath)) {
  throw new Error(`Component file not found: ${componentPath}. Please check the path and try again.`);
}
```

#### Performance
- Optimize for common use cases
- Avoid unnecessary file system operations
- Use efficient algorithms for code analysis

### Testing Guidelines

#### Unit Tests
- Test core functionality thoroughly
- Include edge cases and error scenarios
- Use descriptive test names

```typescript
describe('PerformanceAnalyzer', () => {
  it('should detect OnPush opportunities in components with services', () => {
    // Test implementation
  });
  
  it('should skip OnPush recommendation for simple display components', () => {
    // Test implementation
  });
});
```

#### Integration Tests
- Test CLI commands end-to-end
- Verify output formats (JSON, Markdown)
- Test with real Angular project structures

### Git Workflow

#### Branch Naming
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

#### Commit Messages
Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): description

feat(analyzer): add support for Angular 17 @for syntax
fix(cli): resolve path resolution issues on Windows
docs(readme): update installation instructions
test(analyzer): add tests for OnPush detection logic
```

#### Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Make your changes**
   - Follow coding standards
   - Add tests if applicable
   - Update documentation

3. **Test your changes**
   ```bash
   npm run build
   npm run test  # if tests exist
   
   # Test CLI functionality
   node dist/cli.js project ./test-project
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat(analyzer): add new performance check"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/my-new-feature
   ```
   Then create a Pull Request on GitHub

#### Pull Request Guidelines

- **Use the PR template** when creating pull requests
- **Link related issues** using "Fixes #123" or "Closes #123"
- **Provide clear description** of changes and motivation
- **Include screenshots** for UI changes
- **Keep PRs focused** - one feature or fix per PR
- **Update documentation** if needed

## Adding New Features

### Performance Analysis Rules

When adding new analysis rules:

1. **Research the performance impact**
   - Provide evidence or references
   - Consider different Angular versions
   - Test with real-world scenarios

2. **Follow the existing pattern**
   ```typescript
   interface AnalysisRule {
     name: string;
     description: string;
     check: (component: ComponentInfo) => boolean;
     recommendation: string;
     priority: 'high' | 'medium' | 'low';
   }
   ```

3. **Add comprehensive tests**
   - Test positive and negative cases
   - Include edge cases
   - Verify recommendation quality

### CLI Commands

When adding new CLI commands:

1. **Follow existing patterns** in `cli.ts`
2. **Add help documentation** with examples
3. **Handle arguments and flags** properly
4. **Provide meaningful error messages**
5. **Update README** with new command usage

## Documentation

### README Updates
- Keep installation instructions current
- Add examples for new features
- Update command reference
- Ensure all links work

### Code Documentation
- Add JSDoc comments for public APIs
- Document complex algorithms
- Explain performance considerations
- Include usage examples

### Changelog
- Document breaking changes
- Highlight new features
- Credit contributors

## Release Process

### Version Numbering
We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features (backward compatible)
- **PATCH** (0.0.1): Bug fixes (backward compatible)

### Release Checklist
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Version bumped appropriately
- [ ] Changelog updated
- [ ] Build successful
- [ ] Manual testing completed

## Community

### Getting Help
- 📖 Read the [documentation](README.md)
- 🔍 Search [existing issues](https://github.com/eawebmaster20/ngperf/issues)
- 💬 Ask questions in [GitHub Discussions](https://github.com/eawebmaster20/ngperf/discussions)
- 📧 Email maintainer: [eawebmaster20@gmail.com](mailto:eawebmaster20@gmail.com)

### Recognition
Contributors are recognized in:
- GitHub contributors list
- Release notes and changelog
- Project documentation
- Special thanks in major releases

## Angular-Specific Guidelines

### Supported Angular Versions
- Currently supports Angular 12+
- Test changes against multiple versions
- Consider version-specific features (@for, signals, etc.)

### Analysis Accuracy
- Avoid false positives
- Provide actionable recommendations
- Consider real-world usage patterns
- Test with various project structures

### Performance Considerations
- Optimize for large codebases
- Handle monorepos appropriately
- Minimize analysis time
- Provide progress feedback for long operations

## Questions?

Don't hesitate to ask questions! We're here to help:

- Open a [GitHub Discussion](https://github.com/eawebmaster20/ngperf/discussions)
- Email [eawebmaster20@gmail.com](mailto:eaweb20@gmail.com)
- Create an issue with the "question" label

Thank you for contributing to ngperf-audit! 🚀

---

*This guide is based on best practices from the open source community and is continuously updated based on contributor feedback.*
