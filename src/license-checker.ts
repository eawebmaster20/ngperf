/**
 * Optional attribution helper
 * Helps users provide proper attribution as required by the license
 */

export interface AttributionInfo {
  hasAttribution: boolean;
  suggestions: string[];
  message: string;
}

export class LicenseChecker {
  
  /**
   * Helper to check if attribution is present and provide suggestions
   * This is optional and for guidance only
   */
  static checkAttribution(): AttributionInfo {
    const suggestions = [
      'Add attribution to your app\'s About/Credits section',
      'Include attribution in your project\'s README',
      'Add attribution to CLI output or logs',
      'Consider starring the GitHub repository',
      'Share your experience on social media'
    ];

    return {
      hasAttribution: false, // Users can implement their own detection
      suggestions,
      message: 'ngperf is free to use with attribution. Please give credit where it\'s due!'
    };
  }
  
  /**
   * Display attribution information
   */
  static displayAttributionInfo(): void {
    console.log('📄 ngperf Attribution Information');
    console.log('==================================');
    console.log('🆓 Free for all use cases with attribution');
    console.log('🙏 Please give credit in your project');
    console.log('📧 Created by: eawebmaster20 (eaweb-solutions.com)');
    console.log('🌐 GitHub: https://github.com/eawebmaster20/ngperf');
    console.log('⭐ Consider starring the repository!');
    console.log('');
  }

  /**
   * Get suggested attribution text
   */
  static getAttributionText(): {
    aboutSection: string;
    readme: string;
    cli: string;
  } {
    return {
      aboutSection: 'Performance analysis powered by ngperf\nCreated by eawebmaster20 (https://eaweb-solutions.com)',
      readme: 'This project uses [ngperf](https://github.com/eawebmaster20/ngperf) for Angular performance analysis.',
      cli: 'Powered by ngperf (https://github.com/eawebmaster20/ngperf)'
    };
  }
}
