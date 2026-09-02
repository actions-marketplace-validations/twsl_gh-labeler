import { beforeEach, describe, expect, it, jest, mock } from "bun:test";

// Mock dependencies BEFORE importing
mock.module("@actions/core", () => ({
	debug: jest.fn(),
	info: jest.fn(),
	warning: jest.fn(),
	setFailed: jest.fn(),
}));

mock.module("@actions/github", () => ({
	getOctokit: jest.fn(() => ({
		rest: {
			issues: {
				addLabels: jest.fn(),
				createComment: jest.fn(),
			},
		},
	})),
	context: {
		repo: {
			owner: "test-owner",
			repo: "test-repo",
		},
		payload: {},
	},
}));

// Now import after mocking
const { RegexHandler } = await import("@/handlers/regexHandler");

import type Config from "@/models/internal/config";
import type GHActionConfig from "@/models/internal/ghActionConfig";

describe("RegexHandler", () => {
	let regexHandler: InstanceType<typeof RegexHandler>;
	let mockConfig: Config;
	let mockActionConfig: GHActionConfig;

	beforeEach(() => {
		mockConfig = {
			regex: {
				"\\bbug\\b": {
					labels: {
						add: ["bug"],
					},
				},
				"\\bfeature\\b": {
					labels: {
						add: ["enhancement"],
					},
				},
			},
		} as Config;

		mockActionConfig = {
			"github-token": "test-token",
			"config-path": "test-config.yml",
		};

		regexHandler = new RegexHandler(mockConfig, mockActionConfig);
	});

	it("reports the issue thread type", () => {
		expect(regexHandler.getThreadType()).toBe("issue");
	});

	describe("findMatchingRegexLabels", () => {
		it("should find matching labels for issue content", async () => {
			const threadData = {
				number: 1,
				title: "Found a bug in the application",
				body: "This is a detailed description of the bug",
				labels: [],
			};

			const matchingLabels = await (regexHandler as any).findMatchingRegexLabels(threadData, "issue");

			expect(matchingLabels).toContain("bug");
		});

		it("should find multiple matching labels", async () => {
			const threadData = {
				number: 1,
				title: "Bug in new feature implementation",
				body: "This feature has a bug that needs fixing",
				labels: [],
			};

			const matchingLabels = await (regexHandler as any).findMatchingRegexLabels(threadData, "issue");

			expect(matchingLabels).toContain("bug");
			expect(matchingLabels).toContain("enhancement");
		});

		it("should not add labels that already exist", async () => {
			const threadData = {
				number: 1,
				title: "Found a bug in the application",
				body: "This is a detailed description of the bug",
				labels: [{ name: "bug" }],
			};

			const matchingLabels = await (regexHandler as any).findMatchingRegexLabels(threadData, "issue");

			expect(matchingLabels).not.toContain("bug");
		});

		it("should handle case insensitive matching by default", async () => {
			const threadData = {
				number: 1,
				title: "Found a BUG in the application",
				body: "This FEATURE needs work",
				labels: [],
			};

			const matchingLabels = await (regexHandler as any).findMatchingRegexLabels(threadData, "issue");

			expect(matchingLabels).toContain("bug");
			expect(matchingLabels).toContain("enhancement");
		});

		it("should return empty array when no regex patterns match", async () => {
			const threadData = {
				number: 1,
				title: "Normal issue title",
				body: "Regular issue description",
				labels: [],
			};

			const matchingLabels = await (regexHandler as any).findMatchingRegexLabels(threadData, "issue");

			expect(matchingLabels).toHaveLength(0);
		});

		it("should handle threads without labels property (discussions)", async () => {
			const threadData = {
				number: 1,
				title: "Discussion about a bug",
				body: "Let's discuss this bug issue",
				// No labels property like discussions might have
			};

			const matchingLabels = await (regexHandler as any).findMatchingRegexLabels(threadData, "discussion");

			expect(matchingLabels).toContain("bug");
		});
	});

	describe("performRegexScanning", () => {
		it("should add labels when regex patterns match", async () => {
			const threadData = {
				number: 1,
				title: "Found a bug in the application",
				body: "This is a detailed description of the bug",
				labels: [],
			};

			const addLabelsSpy = jest.spyOn((regexHandler as any).client.rest.issues, "addLabels");

			await regexHandler.performRegexScanning(threadData, "issue");

			expect(addLabelsSpy).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				labels: ["bug"],
			});
		});

		it("should not call addLabels when no patterns match", async () => {
			const threadData = {
				number: 1,
				title: "Normal issue title",
				body: "Regular issue description",
				labels: [],
			};

			const addLabelsSpy = jest.spyOn((regexHandler as any).client.rest.issues, "addLabels");

			await regexHandler.performRegexScanning(threadData, "issue");

			expect(addLabelsSpy).not.toHaveBeenCalled();
		});
	});

	describe("performActions", () => {
		it("delegates matching issue labels", async () => {
			const threadData = { number: 1, title: "bug", body: "", labels: [] };
			const issueHandler = (regexHandler as any).issueHandler;
			const performActions = jest.spyOn(issueHandler, "performActions");

			await regexHandler.performActions({ issue: {}, label: { name: "x" } }, threadData as any);

			expect(performActions).toHaveBeenCalledWith(
				expect.objectContaining({ action: "labeled", label: { name: "bug" } }),
				threadData,
			);
		});

		it("delegates matching pull request and discussion labels", async () => {
			const threadData = { number: 1, title: "bug", body: "", labels: [] };
			const pullRequestPerformActions = jest.spyOn((regexHandler as any).pullRequestHandler, "performActions");
			const discussionPerformActions = jest.spyOn((regexHandler as any).discussionHandler, "performActions");

			await regexHandler.performActions({ pull_request: {}, label: { name: "x" } }, threadData as any);
			await regexHandler.performActions({ discussion: {}, label: { name: "x" } }, threadData as any);

			expect(pullRequestPerformActions).toHaveBeenCalled();
			expect(discussionPerformActions).toHaveBeenCalled();
		});

		it("ignores payloads without a thread", async () => {
			const performActions = jest.spyOn((regexHandler as any).issueHandler, "performActions");
			await regexHandler.performActions({ label: { name: "x" } }, { number: 1, title: "bug", body: "" } as any);

			expect(performActions).not.toHaveBeenCalled();
		});

		it("supports fallback labels and skips invalid patterns", async () => {
			const handler = new RegexHandler(
				{
					regex: {
						"[": { labels: { add: ["ignored"] } },
						"\\bbug\\b": {},
						"\\bfeature\\b": { caseSensitive: true, issues: { labels: { add: ["feature"] } } },
					},
				} as Config,
				mockActionConfig,
			);
			const labels = await (handler as any).findMatchingRegexLabels(
				{ title: "BUG feature", body: "", labels: [] },
				"issue",
			);

			expect(labels).toEqual(["\\bbug\\b", "feature"]);
		});
	});
});
