// Additional test fixtures for main.ts testing
import type Config from "../../src/models/internal/config";

export const complexConfig: Config = {
	...require("./config").sampleConfig,
	labels: {
		"critical-bug": {
			label: "critical-bug",
			actions: {
				assignees: ["senior-dev", "team-lead"],
				comments: ["⚠️ Critical bug reported! Investigating immediately."],
				reviewers: ["security-team"],
			},
		},
		performance: {
			label: "performance",
			actions: {
				assignees: ["performance-team"],
				milestones: ["performance-optimization"],
				projects: ["performance-tracking"],
			},
		},
		documentation: {
			label: "documentation",
			actions: {
				assignees: ["docs-team"],
				comments: ["📝 Thanks for improving our documentation!"],
			},
		},
	},
	discussions: {
		"help-wanted": {
			actions: {
				comments: ["We'd love help with this! Please check our contribution guidelines."],
				assignees: ["community-manager"],
			},
		},
		"feature-request": {
			actions: {
				comments: ["Interesting feature idea! We'll discuss this with the team."],
				labels: ["enhancement", "needs-discussion"],
			},
		},
	},
	issues: {
		"needs-reproduction": {
			actions: {
				assignees: ["triage-team"],
				comments: ["Could you provide steps to reproduce this issue?"],
				labels: ["needs-more-info"],
			},
		},
		security: {
			actions: {
				assignees: ["security-team"],
				comments: ["🔒 Security issue reported. Please email security@company.com for sensitive issues."],
				labels: ["security", "high-priority"],
			},
		},
	},
	prs: {
		"breaking-change": {
			actions: {
				reviewers: ["team-lead", "architecture-team"],
				comments: ["⚠️ This PR contains breaking changes. Please review carefully."],
				labels: ["breaking-change", "needs-careful-review"],
			},
		},
		hotfix: {
			actions: {
				reviewers: ["senior-dev"],
				comments: ["🚨 Hotfix PR - expedited review requested."],
				assignees: ["release-manager"],
			},
		},
	},
	content: {
		rules: [
			{
				pattern: "(critical|urgent|emergency)",
				labels: ["critical-bug", "high-priority"],
				type: "regex",
			},
			{
				pattern: "(performance|slow|lag|memory)",
				labels: ["performance"],
				type: "regex",
			},
			{
				pattern: "(docs|documentation|readme)",
				labels: ["documentation"],
				type: "regex",
			},
			{
				pattern: "(security|vulnerability|exploit)",
				labels: ["security"],
				type: "regex",
			},
		],
	},
};

export const configWithSpecialCharacters: Config = {
	labels: {
		"🐛-bug": {
			label: "🐛-bug",
			actions: {
				comments: ["Bug reported with emoji label!"],
			},
		},
		"feature/request": {
			label: "feature/request",
			actions: {
				comments: ["Feature request with slash in label!"],
			},
		},
		"very-very-very-long-label-name-that-exceeds-normal-length-limits": {
			label: "very-very-very-long-label-name-that-exceeds-normal-length-limits",
			actions: {
				comments: ["This is a very long label name!"],
			},
		},
	},
};

export const emptyConfig: Config = {};

export const configWithOnlyLabels: Config = {
	labels: {
		"simple-label": {
			label: "simple-label",
			actions: {},
		},
	},
};

export const configWithOnlyContent: Config = {
	content: {
		rules: [
			{
				pattern: "test",
				labels: ["test-label"],
				type: "regex",
			},
		],
	},
};
