/**
 * Content Rule Configuration
 *
 * Defines pattern-based content matching rules for automatic labeling.
 */

export default interface ContentRule {
	pattern: string;
	label: string;
	caseSensitive?: boolean;
}
