// Additional payload fixtures for comprehensive testing
import type { DiscussionEvent, IssuesEvent, PullRequestEvent } from "@octokit/webhooks-types";

export const createComplexIssuePayload = (action: string, overrides: Record<string, unknown> = {}): IssuesEvent =>
	({
		action,
		issue: {
			number: 123,
			title: "Complex issue with multiple labels",
			body: "This is a complex issue body with performance problems and security concerns",
			state: "open",
			labels: [
				{ name: "bug", color: "d73a4a" },
				{ name: "performance", color: "fef2c0" },
			],
			assignees: [{ login: "user1" }, { login: "user2" }],
			milestone: {
				title: "v1.0.0",
				number: 1,
			},
			user: {
				login: "issue-reporter",
				id: 12345,
			},
			created_at: "2023-01-01T00:00:00Z",
			updated_at: "2023-01-01T01:00:00Z",
			...overrides,
		},
	}) as unknown as IssuesEvent;

export const createComplexPRPayload = (action: string, overrides: Record<string, unknown> = {}): PullRequestEvent =>
	({
		action,
		pull_request: {
			number: 456,
			title: "Feature: Add new performance optimization",
			body: "This PR adds critical performance improvements and fixes security vulnerabilities",
			state: "open",
			labels: [
				{ name: "enhancement", color: "a2eeef" },
				{ name: "performance", color: "fef2c0" },
			],
			assignees: [{ login: "pr-author" }],
			requested_reviewers: [{ login: "reviewer1" }, { login: "reviewer2" }],
			user: {
				login: "pr-author",
				id: 67890,
			},
			draft: false,
			merged: false,
			mergeable: true,
			created_at: "2023-01-01T00:00:00Z",
			updated_at: "2023-01-01T01:00:00Z",
			...overrides,
		},
	}) as unknown as PullRequestEvent;

export const createComplexDiscussionPayload = (
	action: string,
	overrides: Record<string, unknown> = {},
): DiscussionEvent =>
	({
		action,
		discussion: {
			number: 789,
			title: "How to optimize performance in large repositories?",
			body: "I'm experiencing performance issues with large repositories. Any suggestions for optimization?",
			category: {
				name: "Q&A",
				slug: "q-a",
			},
			labels: [
				{ name: "question", color: "d876e3" },
				{ name: "performance", color: "fef2c0" },
			],
			user: {
				login: "discussion-author",
				id: 11111,
			},
			created_at: "2023-01-01T00:00:00Z",
			updated_at: "2023-01-01T01:00:00Z",
			...overrides,
		},
	}) as unknown as DiscussionEvent;

export const createMalformedPayload = (
	type: "issue" | "pr" | "discussion" = "issue",
): IssuesEvent | PullRequestEvent | DiscussionEvent => {
	const base = {
		action: "opened",
	};

	switch (type) {
		case "issue":
			return {
				...base,
				issue: {
					// Missing required fields to test error handling
					title: "",
					body: "",
					// number field intentionally missing
				},
			} as unknown as IssuesEvent;
		case "pr":
			return {
				...base,
				pull_request: {
					title: "",
					body: "",
					// number field intentionally missing
				},
			} as unknown as PullRequestEvent;
		case "discussion":
			return {
				...base,
				discussion: {
					title: "",
					body: "",
					// number field intentionally missing
				},
			} as unknown as DiscussionEvent;
		default:
			return base as unknown as IssuesEvent;
	}
};

export const createLargePayload = (
	type: "issue" | "pr" | "discussion" = "issue",
): IssuesEvent | PullRequestEvent | DiscussionEvent => {
	const largeBody = "Lorem ipsum ".repeat(1000); // ~11KB of text
	const manyLabels = Array.from({ length: 50 }, (_, i) => ({
		name: `label-${i}`,
		color: "ffffff",
	}));

	const base = {
		action: "opened",
	};

	switch (type) {
		case "issue":
			return {
				...base,
				issue: {
					number: 999999,
					title: "Very long title ".repeat(50),
					body: largeBody,
					labels: manyLabels,
				},
			} as unknown as IssuesEvent;
		case "pr":
			return {
				...base,
				pull_request: {
					number: 999999,
					title: "Very long PR title ".repeat(50),
					body: largeBody,
					labels: manyLabels,
				},
			} as unknown as PullRequestEvent;
		case "discussion":
			return {
				...base,
				discussion: {
					number: 999999,
					title: "Very long discussion title ".repeat(50),
					body: largeBody,
					labels: manyLabels,
				},
			} as unknown as DiscussionEvent;
		default:
			return base as unknown as IssuesEvent;
	}
};

export const createPayloadWithSpecialCharacters = (
	type: "issue" | "pr" | "discussion" = "issue",
): IssuesEvent | PullRequestEvent | DiscussionEvent => {
	const base = {
		action: "labeled",
		label: {
			name: "🐛-critical-bug/security-🔒",
			color: "ff0000",
		},
	};

	const specialContent = {
		title: "Issue with émojis 🚀 and spëcial châractérs áñd ümlauts",
		body: "This contains special chars: <script>alert('xss')</script> & unicode: 漢字 🎉",
		number: 12345,
	};

	switch (type) {
		case "issue":
			return {
				...base,
				issue: specialContent,
			} as unknown as IssuesEvent;
		case "pr":
			return {
				...base,
				pull_request: specialContent,
			} as unknown as PullRequestEvent;
		case "discussion":
			return {
				...base,
				discussion: specialContent,
			} as unknown as DiscussionEvent;
		default:
			return base as unknown as IssuesEvent;
	}
};
