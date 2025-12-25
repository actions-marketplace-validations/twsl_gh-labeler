import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { parse } from "yaml";

// Mock dependencies before imports
jest.unstable_mockModule("@actions/core", () => ({
	debug: jest.fn(),
	info: jest.fn(),
	warning: jest.fn(),
	setFailed: jest.fn(),
	getInput: jest.fn(),
}));

jest.unstable_mockModule("@actions/github", () => ({
	getOctokit: jest.fn(),
	context: {
		repo: {
			owner: "test-owner",
			repo: "test-repo",
		},
		payload: {},
	},
}));

// Import after mocking
const { IssueHandler } = await import("@/handlers/issueHandler");
const { PullRequestHandler } = await import("@/handlers/pullRequestHandler");
const { DiscussionHandler } = await import("@/handlers/discussionHandler");
const { ContentLabelHandler } = await import("@/handlers/contentLabelHandler");
const github = await import("@actions/github");

import type { DiscussionEvent, IssuesEvent, PullRequestEvent } from "@octokit/webhooks-types";
import type Config from "@/models/internal/config";
import type GHActionConfig from "@/models/internal/ghActionConfig";

describe("Integration Tests - Payload Processing", () => {
	let mockOctokit: any;
	let actionConfig: GHActionConfig;
	let config: Config;

	beforeEach(() => {
		jest.clearAllMocks();

		// Setup mock Octokit
		mockOctokit = {
			rest: {
				issues: {
					createComment: jest.fn().mockResolvedValue({}),
					addLabels: jest.fn().mockResolvedValue({}),
					removeLabel: jest.fn().mockResolvedValue({}),
					addAssignees: jest.fn().mockResolvedValue({}),
					removeAssignees: jest.fn().mockResolvedValue({}),
					update: jest.fn().mockResolvedValue({}),
					lock: jest.fn().mockResolvedValue({}),
					unlock: jest.fn().mockResolvedValue({}),
					get: jest.fn().mockResolvedValue({
						data: {
							milestone: null,
						},
					}),
					listMilestones: jest.fn().mockResolvedValue({
						data: [],
					}),
				},
				pulls: {
					createReviewComment: jest.fn().mockResolvedValue({}),
					requestReviewers: jest.fn().mockResolvedValue({}),
					removeRequestedReviewers: jest.fn().mockResolvedValue({}),
					update: jest.fn().mockResolvedValue({}),
				},
			},
			graphql: jest.fn().mockResolvedValue({}),
		};

		(github.getOctokit as jest.Mock).mockReturnValue(mockOctokit);

		// Setup action config
		actionConfig = {
			"github-token": "test-token",
			"config-path": ".github/gh-labeler.yaml",
		};

		// Load test config from example
		const configPath = path.join(process.cwd(), "example", "config.yaml");
		const configContent = fs.readFileSync(configPath, "utf8");
		config = parse(configContent) as Config;
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	describe("Issue Handler Integration", () => {
		it("should process bug report issue payload", async () => {
			const payloadPath = path.join(process.cwd(), "data", "issue", "issue-bug-report.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as IssuesEvent;

			// Verify payload loaded correctly
			expect(payload.issue).toBeDefined();
			expect(payload.issue.number).toBe(101);
			expect(payload.issue.title).toContain("Bug");
			expect(payload.action).toBe("opened");
		});

		it("should process feature request issue payload", async () => {
			const payloadPath = path.join(process.cwd(), "data", "issue", "issue-feature-request.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as IssuesEvent;

			// Verify payload loaded correctly
			expect(payload.issue).toBeDefined();
			expect(payload.issue.number).toBe(102);
			expect(payload.issue.title).toContain("Feature Request");
			expect(payload.issue.body).toContain("dark mode");
		});

		it("should process documentation issue payload", async () => {
			const payloadPath = path.join(process.cwd(), "data", "issue", "issue-documentation.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as IssuesEvent;

			// Verify payload loaded correctly
			expect(payload.issue).toBeDefined();
			expect(payload.issue.number).toBe(103);
			expect(payload.issue.title).toContain("Documentation");
			expect(payload.issue.body).toContain("API documentation");
		});
	});

	describe("Pull Request Handler Integration", () => {
		it("should process bugfix PR payload", async () => {
			const payloadPath = path.join(process.cwd(), "data", "pull_request", "pr-bugfix.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as PullRequestEvent;

			// Verify payload loaded correctly
			expect(payload.pull_request).toBeDefined();
			expect(payload.pull_request.number).toBe(201);
			expect(payload.pull_request.title).toContain("Fix");
			expect(payload.pull_request.body).toContain("crash");
		});

		it("should process feature PR payload", async () => {
			const payloadPath = path.join(process.cwd(), "data", "pull_request", "pr-feature.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as PullRequestEvent;

			// Verify payload loaded correctly
			expect(payload.pull_request).toBeDefined();
			expect(payload.pull_request.number).toBe(202);
			expect(payload.pull_request.title).toContain("Feature");
			expect(payload.pull_request.body).toContain("dark mode");
		});

		it("should process refactor PR payload", async () => {
			const payloadPath = path.join(process.cwd(), "data", "pull_request", "pr-refactor.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as PullRequestEvent;

			// Verify payload loaded correctly
			expect(payload.pull_request).toBeDefined();
			expect(payload.pull_request.number).toBe(203);
			expect(payload.pull_request.title).toContain("Refactor");
			expect(payload.pull_request.body).toContain("maintainability");
		});
	});

	describe("Discussion Handler Integration", () => {
		it("should process question discussion payload", async () => {
			const payloadPath = path.join(process.cwd(), "data", "discussion", "discussion-question.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as DiscussionEvent;

			// Verify payload loaded correctly
			expect(payload.discussion).toBeDefined();
			expect(payload.discussion.number).toBe(301);
			expect(payload.discussion.title).toContain("How to");
			expect(payload.discussion.category.name).toBe("Q&A");
		});

		it("should process idea discussion payload", async () => {
			const payloadPath = path.join(process.cwd(), "data", "discussion", "discussion-idea.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as DiscussionEvent;

			// Verify payload loaded correctly
			expect(payload.discussion).toBeDefined();
			expect(payload.discussion.number).toBe(302);
			expect(payload.discussion.title).toContain("Idea");
			expect(payload.discussion.category.name).toBe("Ideas");
		});

		it("should process announcement discussion payload", async () => {
			const payloadPath = path.join(process.cwd(), "data", "discussion", "discussion-announcement.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as DiscussionEvent;

			// Verify payload loaded correctly
			expect(payload.discussion).toBeDefined();
			expect(payload.discussion.number).toBe(303);
			expect(payload.discussion.title).toContain("Announcement");
			expect(payload.discussion.category.name).toBe("Announcements");
		});
	});

	describe("Content-Based Labeling Integration", () => {
		it("should apply labels based on regex rules for issue", async () => {
			// Create a test config with regex patterns (how the system actually works)
			const testConfig: Config = {
				regex: {
					"\\b(bug|crash|error)\\b": {
						labels: {
							add: ["bug"],
						},
					},
					"\\b(feature|enhancement|improvement)\\b": {
						labels: {
							add: ["enhancement"],
						},
					},
				},
			};

			const payloadPath = path.join(process.cwd(), "data", "issue", "issue-bug-report.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as IssuesEvent;

			const contentHandler = new ContentLabelHandler(testConfig, actionConfig, "issue");
			await contentHandler.performContentScanning(payload.issue);

			// Should have attempted to add labels based on regex matching
			expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 101,
				labels: expect.arrayContaining(["bug"]),
			});
		});

		it("should apply labels based on regex rules for PR", async () => {
			const testConfig: Config = {
				regex: {
					"\\b(fix|bugfix|hotfix)\\b": {
						labels: {
							add: ["bugfix"],
						},
					},
					"\\b(feature|feat)\\b": {
						labels: {
							add: ["feature"],
						},
					},
				},
			};

			const payloadPath = path.join(process.cwd(), "data", "pull_request", "pr-bugfix.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as PullRequestEvent;

			const contentHandler = new ContentLabelHandler(testConfig, actionConfig, "pr");
			await contentHandler.performContentScanning(payload.pull_request);

			expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 201,
				labels: expect.arrayContaining(["bugfix"]),
			});
		});

		it("should apply labels based on regex rules for discussion", async () => {
			const testConfig: Config = {
				regex: {
					"\\bhow to\\b": {
						labels: {
							add: ["question"],
						},
					},
					"\\b(idea|proposal)\\b": {
						labels: {
							add: ["idea"],
						},
					},
				},
			};

			const payloadPath = path.join(process.cwd(), "data", "discussion", "discussion-question.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as DiscussionEvent;

			const contentHandler = new ContentLabelHandler(testConfig, actionConfig, "discussion");
			await contentHandler.performContentScanning(payload.discussion);

			// Discussions use regular issues API for labels
			expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 301,
				labels: expect.arrayContaining(["question"]),
			});
		});
	});

	describe("Label-Triggered Actions Integration", () => {
		it("should perform actions when bug label is added to issue", async () => {
			const payloadPath = path.join(process.cwd(), "data", "issue", "issue-bug-report.json");
			const basePayload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as IssuesEvent;

			// Simulate a labeled event
			const labeledPayload = {
				...basePayload,
				action: "labeled" as const,
				label: {
					name: "bug",
					color: "d73a4a",
				},
			};

			const handler = new IssueHandler(config, actionConfig);
			await handler.performActions(labeledPayload, labeledPayload.issue);

			// Should have added comments and assignees based on config
			expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
		});

		it("should perform actions when enhancement label is added to PR", async () => {
			const payloadPath = path.join(process.cwd(), "data", "pull_request", "pr-feature.json");
			const basePayload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as PullRequestEvent;

			// Simulate a labeled event
			const labeledPayload = {
				...basePayload,
				action: "labeled" as const,
				label: {
					name: "enhancement",
					color: "a2eeef",
				},
			};

			const handler = new PullRequestHandler(config, actionConfig);
			await handler.performActions(labeledPayload, labeledPayload.pull_request);

			// Should have performed PR-specific actions
			expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
		});

		it("should perform actions when label is added to discussion", async () => {
			const payloadPath = path.join(process.cwd(), "data", "discussion", "discussion-question.json");
			const basePayload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as DiscussionEvent;

			// Simulate a labeled event
			const labeledPayload = {
				...basePayload,
				action: "labeled" as const,
				label: {
					name: "question",
					color: "d876e3",
				},
			};

			// Mock GraphQL for discussion actions
			(mockOctokit.graphql as jest.Mock).mockResolvedValue({
				addDiscussionComment: { comment: { id: "comment_id" } },
			});

			const handler = new DiscussionHandler(config, actionConfig);
			await handler.performActions(labeledPayload, labeledPayload.discussion);

			// Should have commented via GraphQL
			expect(mockOctokit.graphql).toHaveBeenCalled();
		});
	});

	describe("End-to-End Payload Processing", () => {
		it("should handle complete workflow for issue creation with content labeling and label actions", async () => {
			// Setup config with both regex rules and label actions
			const fullConfig: Config = {
				regex: {
					"\\b(bug|crash)\\b": {
						labels: {
							add: ["bug"],
						},
					},
				},
				labels: {
					add: {
						bug: {
							comments: ["Thank you for reporting this bug!"],
							issues: {
								assignees: {
									add: ["bugTeamMember"],
								},
								pin: true,
							},
						},
					},
				},
			};

			const payloadPath = path.join(process.cwd(), "data", "issue", "issue-bug-report.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as IssuesEvent;

			// Step 1: Content scanning adds "bug" label
			const contentHandler = new ContentLabelHandler(fullConfig, actionConfig, "issue");
			await contentHandler.performContentScanning(payload.issue);

			expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: payload.issue.number,
				labels: expect.arrayContaining(["bug"]),
			});

			// Step 2: Label action handler processes the added label
			const labeledPayload = {
				...payload,
				action: "labeled" as const,
				label: { name: "bug", color: "d73a4a" },
			};

			const handler = new IssueHandler(fullConfig, actionConfig);
			await handler.performActions(labeledPayload, labeledPayload.issue);

			// Should have performed label-triggered actions
			expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
			expect(mockOctokit.rest.issues.addAssignees).toHaveBeenCalled();
		});
	});
});
