import type Config from "../../src/models/internal/config";

export const sampleConfig: Config = {
	labels: {
		bug: {
			label: "bug",
			actions: {
				assignees: ["maintainer"],
				comments: ["Thank you for reporting this bug!"],
			},
		},
		enhancement: {
			label: "enhancement",
			actions: {
				assignees: ["developer"],
				comments: ["Great feature request!"],
			},
		},
	},
	discussions: {
		"help wanted": {
			actions: {
				comments: ["We appreciate your discussion!"],
			},
		},
	},
	issues: {
		"needs triage": {
			actions: {
				assignees: ["triager"],
				comments: ["This issue needs triage."],
			},
		},
	},
	prs: {
		"ready for review": {
			actions: {
				reviewers: ["reviewer1", "reviewer2"],
				comments: ["Ready for review!"],
			},
		},
	},
};

export const emptyConfig: Config = {};

export const configWithContentRules: Config = {
	...sampleConfig,
	content: {
		rules: [
			{
				pattern: "bug",
				labels: ["bug"],
				type: "regex",
			},
			{
				pattern: "feature",
				labels: ["enhancement"],
				type: "regex",
			},
		],
	},
};

export const configWithSpecialCharacters: Config = {
	...sampleConfig,
	labels: {
		"🐛-bug": {
			label: "🐛-bug",
			actions: {
				comments: ["Bug with emoji label!"],
			},
		},
		"critical/urgent": {
			label: "critical/urgent",
			actions: {
				assignees: ["oncall"],
			},
		},
	},
};

export const largeConfig: Config = {
	...sampleConfig,
	labels: Object.fromEntries(
		Array.from({ length: 1000 }, (_, i) => [
			`label-${i}`,
			{
				label: `label-${i}`,
				actions: {
					comments: [`Auto comment for label-${i}`],
				},
			},
		]),
	),
};

export const configWithEmptyActions: Config = {
	labels: {
		"empty-action": {
			label: "empty-action",
			actions: {},
		},
	},
	issues: {},
	prs: {},
	discussions: {},
};

export const configWithComplexActions: Config = {
	labels: {
		"multi-action": {
			label: "multi-action",
			actions: {
				assignees: ["user1", "user2", "user3"],
				comments: ["First comment", "Second comment with more details", "Third comment with even more information"],
				reviewers: ["reviewer1", "reviewer2"],
				milestones: ["v1.0", "v2.0"],
			},
		},
	},
};
