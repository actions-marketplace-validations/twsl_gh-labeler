import type Config from "../../src/models/config";

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
