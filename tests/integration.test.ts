import { afterEach, beforeEach, describe, expect, it, jest, mock } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

// Mock dependencies before imports
const mockContext = {
	repo: {
		owner: "test-owner",
		repo: "test-repo",
	},
	payload: {} as any,
};

mock.module("@actions/core", () => ({
	debug: jest.fn(),
	info: jest.fn(),
	warning: jest.fn(),
	setFailed: jest.fn(),
	getInput: jest.fn(),
}));

mock.module("@actions/github", () => ({
	getOctokit: jest.fn(),
	context: mockContext,
}));

// Import after mocking
const { IssueHandler } = await import("../src/handlers/issueHandler");
const { PullRequestHandler } = await import("../src/handlers/pullRequestHandler");
const { DiscussionHandler } = await import("../src/handlers/discussionHandler");
const { ContentLabelHandler } = await import("../src/handlers/contentLabelHandler");
const github = await import("@actions/github");

import type { DiscussionEvent, IssuesEvent, PullRequestEvent } from "@octokit/webhooks-types";
import type Config from "../src/models/internal/config";
import type GHActionConfig from "../src/models/internal/ghActionConfig";

describe("Integration Tests - Payload Processing", () => {
	let mockOctokit: {
		rest: {
			issues: Record<string, jest.Mock>;
			pulls: Record<string, jest.Mock>;
		};
		graphql: jest.Mock;
	};
	let actionConfig: GHActionConfig;

	beforeEach(() => {
		jest.clearAllMocks();

		// Setup mock Octokit
		mockOctokit = {
			rest: {
				issues: {
					createComment: jest.fn<() => Promise<any>>().mockResolvedValue({}),
					addLabels: jest.fn<() => Promise<any>>().mockResolvedValue({}),
					removeLabel: jest.fn<() => Promise<any>>().mockResolvedValue({}),
					addAssignees: jest.fn<() => Promise<any>>().mockResolvedValue({}),
					removeAssignees: jest.fn<() => Promise<any>>().mockResolvedValue({}),
					update: jest.fn<() => Promise<any>>().mockResolvedValue({}),
					lock: jest.fn<() => Promise<any>>().mockResolvedValue({}),
					unlock: jest.fn<() => Promise<any>>().mockResolvedValue({}),
					get: jest.fn<() => Promise<any>>().mockResolvedValue({
						data: {
							milestone: null,
						},
					}),
					listMilestones: jest.fn<() => Promise<any>>().mockResolvedValue({
						data: [],
					}),
				},
				pulls: {
					createReviewComment: jest.fn<() => Promise<any>>().mockResolvedValue({}),
					requestReviewers: jest.fn<() => Promise<any>>().mockResolvedValue({}),
					removeRequestedReviewers: jest.fn<() => Promise<any>>().mockResolvedValue({}),
					update: jest.fn<() => Promise<any>>().mockResolvedValue({}),
				},
			},
			graphql: jest.fn<() => Promise<any>>().mockResolvedValue({}),
		};

		(github.getOctokit as jest.Mock).mockReturnValue(mockOctokit);

		// Setup action config
		actionConfig = {
			"github-token": "test-token",
			"config-path": ".github/gh-labeler.yaml",
		};
	});

	afterEach(() => {
		jest.resetAllMocks();
		// Reset payload
		mockContext.payload = {};
	});

	describe("Issue Handler Integration", () => {
		it("should process bug report issue payload with content labeling", async () => {
			const payloadPath = path.join(process.cwd(), "data", "issue", "issue-bug-report.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as IssuesEvent;

			// Mock payload in github.context
			mockContext.payload = payload;

			// Verify payload loaded correctly
			expect(payload.issue).toBeDefined();
			expect(payload.issue.number).toBe(101);
			expect(payload.issue.title).toContain("Bug");

			// Create config with regex rules to test content labeling
			const testConfig: Config = {
				regex: {
					"\\b(bug|crash)\\b": {
						labels: {
							add: ["bug"],
						},
					},
				},
			};

			// Call content label handler to scan and label
			const contentHandler = new ContentLabelHandler(testConfig, actionConfig, "issue");
			await contentHandler.performContentScanning(payload.issue);

			// Verify that content scanning triggered label addition
			expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 101,
				labels: expect.arrayContaining(["bug"]),
			});
		});

		it("should process feature request issue payload", async () => {
			const payloadPath = path.join(process.cwd(), "data", "issue", "issue-feature-request.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as IssuesEvent;

			// Mock payload in github.context
			mockContext.payload = payload;

			// Verify payload loaded correctly
			expect(payload.issue).toBeDefined();
			expect(payload.issue.number).toBe(102);
			expect(payload.issue.title).toContain("Feature Request");

			// Define config with regex rules for feature requests
			const testConfig: Config = {
				regex: {
					"\\b(feature|enhancement)\\b": {
						labels: {
							add: ["enhancement"],
						},
					},
				},
			};

			// Call content label handler
			const contentHandler = new ContentLabelHandler(testConfig, actionConfig, "issue");
			await contentHandler.performContentScanning(payload.issue);
		});

		it("should process documentation issue payload", async () => {
			const payloadPath = path.join(process.cwd(), "data", "issue", "issue-documentation.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as IssuesEvent;

			// Mock payload in github.context
			mockContext.payload = payload;

			// Verify payload loaded correctly
			expect(payload.issue).toBeDefined();
			expect(payload.issue.number).toBe(103);
			expect(payload.issue.title).toContain("Documentation");

			// Define config with regex rules for documentation
			const testConfig: Config = {
				regex: {
					"\\b(documentation|docs)\\b": {
						labels: {
							add: ["documentation"],
						},
					},
				},
			};

			// Call content label handler
			const contentHandler = new ContentLabelHandler(testConfig, actionConfig, "issue");
			await contentHandler.performContentScanning(payload.issue);
		});
	});

	describe("Pull Request Handler Integration", () => {
		it("should process bugfix PR payload", async () => {
			const payloadPath = path.join(process.cwd(), "data", "pull_request", "pr-bugfix.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as PullRequestEvent;

			// Mock payload in github.context
			mockContext.payload = payload;

			// Verify payload loaded correctly
			expect(payload.pull_request).toBeDefined();
			expect(payload.pull_request.number).toBe(201);
			expect(payload.pull_request.title).toContain("Fix");

			// Define config with regex rules for bugfixes
			const testConfig: Config = {
				regex: {
					"\\b(fix|bugfix)\\b": {
						labels: {
							add: ["bugfix"],
						},
					},
				},
			};

			// Call content label handler
			const contentHandler = new ContentLabelHandler(testConfig, actionConfig, "pr");
			await contentHandler.performContentScanning(payload.pull_request);
		});

		it("should process feature PR payload", async () => {
			const payloadPath = path.join(process.cwd(), "data", "pull_request", "pr-feature.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as PullRequestEvent;

			// Mock payload in github.context
			mockContext.payload = payload;

			// Verify payload loaded correctly
			expect(payload.pull_request).toBeDefined();
			expect(payload.pull_request.number).toBe(202);
			expect(payload.pull_request.title).toContain("Feature");

			// Define config with regex rules for features
			const testConfig: Config = {
				regex: {
					"\\b(feature|feat)\\b": {
						labels: {
							add: ["feature"],
						},
					},
				},
			};

			// Call content label handler
			const contentHandler = new ContentLabelHandler(testConfig, actionConfig, "pr");
			await contentHandler.performContentScanning(payload.pull_request);
		});

		it("should process refactor PR payload", async () => {
			const payloadPath = path.join(process.cwd(), "data", "pull_request", "pr-refactor.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as PullRequestEvent;

			// Mock payload in github.context
			mockContext.payload = payload;

			// Verify payload loaded correctly
			expect(payload.pull_request).toBeDefined();
			expect(payload.pull_request.number).toBe(203);
			expect(payload.pull_request.title).toContain("Refactor");

			// Define config with regex rules for refactoring
			const testConfig: Config = {
				regex: {
					"\\b(refactor|restructure)\\b": {
						labels: {
							add: ["refactor"],
						},
					},
				},
			};

			// Call content label handler
			const contentHandler = new ContentLabelHandler(testConfig, actionConfig, "pr");
			await contentHandler.performContentScanning(payload.pull_request);
		});
	});

	describe("Discussion Handler Integration", () => {
		it("should process question discussion payload", async () => {
			const payloadPath = path.join(process.cwd(), "data", "discussion", "discussion-question.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as DiscussionEvent;

			// Mock payload in github.context
			mockContext.payload = payload;

			// Verify payload loaded correctly
			expect(payload.discussion).toBeDefined();
			expect(payload.discussion.number).toBe(301);
			expect(payload.discussion.title).toContain("How to");

			// Define config with regex rules for questions
			const testConfig: Config = {
				regex: {
					"\\bhow to\\b": {
						labels: {
							add: ["question"],
						},
					},
				},
			};

			// Call content label handler
			const contentHandler = new ContentLabelHandler(testConfig, actionConfig, "discussion");
			await contentHandler.performContentScanning(payload.discussion);
		});

		it("should process idea discussion payload", async () => {
			const payloadPath = path.join(process.cwd(), "data", "discussion", "discussion-idea.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as DiscussionEvent;

			// Mock payload in github.context
			mockContext.payload = payload;

			// Verify payload loaded correctly
			expect(payload.discussion).toBeDefined();
			expect(payload.discussion.number).toBe(302);
			expect(payload.discussion.title).toContain("Idea");

			// Define config with regex rules for ideas
			const testConfig: Config = {
				regex: {
					"\\b(idea|proposal)\\b": {
						labels: {
							add: ["idea"],
						},
					},
				},
			};

			// Call content label handler
			const contentHandler = new ContentLabelHandler(testConfig, actionConfig, "discussion");
			await contentHandler.performContentScanning(payload.discussion);
		});

		it("should process announcement discussion payload", async () => {
			const payloadPath = path.join(process.cwd(), "data", "discussion", "discussion-announcement.json");
			const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as DiscussionEvent;

			// Mock payload in github.context
			mockContext.payload = payload;

			// Verify payload loaded correctly
			expect(payload.discussion).toBeDefined();
			expect(payload.discussion.number).toBe(303);
			expect(payload.discussion.title).toContain("Announcement");

			// Define config with regex rules for announcements
			const testConfig: Config = {
				regex: {
					"\\b(announcement|announce)\\b": {
						labels: {
							add: ["announcement"],
						},
					},
				},
			};

			// Call content label handler
			const contentHandler = new ContentLabelHandler(testConfig, actionConfig, "discussion");
			await contentHandler.performContentScanning(payload.discussion);
		});
	});

	describe("Content-Based Labeling Integration", () => {
		it("should apply labels based on regex rules for issue", async () => {
			// Create a test config with regex patterns
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

			// Mock payload in github.context
			mockContext.payload = payload;

			// Call content label handler
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

			// Mock payload in github.context
			mockContext.payload = payload;

			// Call content label handler
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

			// Mock payload in github.context
			mockContext.payload = payload;
			mockOctokit.graphql
				.mockResolvedValueOnce({
					repository: {
						labels: {
							nodes: [{ id: "label-question", name: "question" }],
						},
					},
				})
				.mockResolvedValueOnce({});

			// Call content label handler
			const contentHandler = new ContentLabelHandler(testConfig, actionConfig, "discussion");
			await contentHandler.performContentScanning(payload.discussion);

			expect(mockOctokit.rest.issues.addLabels).not.toHaveBeenCalled();
			expect(mockOctokit.graphql).toHaveBeenNthCalledWith(
				1,
				expect.stringContaining("repository(owner: $owner, name: $name)"),
				{
					owner: "test-owner",
					name: "test-repo",
					labels: "question",
				},
			);
			expect(mockOctokit.graphql).toHaveBeenNthCalledWith(2, expect.stringContaining("addLabelsToLabelable"), {
				discussionId: payload.discussion.node_id,
				labelIds: ["label-question"],
			});
		});
	});

	describe("Label-Triggered Actions Integration", () => {
		it("should perform actions when bug label is added to issue", async () => {
			const payloadPath = path.join(process.cwd(), "data", "issue", "issue-bug-report.json");
			const basePayload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as IssuesEvent;

			// Define config with label-triggered actions
			const testConfig: Config = {
				labels: {
					add: {
						bug: {
							comments: ["Thank you for reporting this bug!"],
							issues: {
								assignees: {
									add: ["bugTeamMember"],
								},
							},
						},
					},
				},
			};

			// Simulate a labeled event
			const labeledPayload: IssuesEvent = {
				...basePayload,
				action: "labeled",
				label: {
					id: 1,
					node_id: "MDU6TGFiZWwx",
					url: "https://api.github.com/repos/test-owner/test-repo/labels/bug",
					name: "bug",
					color: "d73a4a",
					default: false,
					description: "Something isn't working",
				},
			};

			// Mock payload in github.context
			mockContext.payload = labeledPayload;

			// Call action handler
			const handler = new IssueHandler(testConfig, actionConfig);
			await handler.performActions(labeledPayload, labeledPayload.issue);

			// Verify comment was posted
			expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 101,
				body: "Thank you for reporting this bug!",
			});

			// Verify assignee was added
			expect(mockOctokit.rest.issues.addAssignees).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 101,
				assignees: ["bugTeamMember"],
			});
		});

		it("should perform actions when enhancement label is added to PR", async () => {
			const payloadPath = path.join(process.cwd(), "data", "pull_request", "pr-feature.json");
			const basePayload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as PullRequestEvent;

			// Define config with label-triggered actions for PRs
			const testConfig: Config = {
				labels: {
					add: {
						enhancement: {
							comments: ["Thank you for this enhancement!"],
							prs: {
								reviewers: {
									add: ["featureReviewer"],
								},
							},
						},
					},
				},
			};

			// Simulate a labeled event
			const labeledPayload: PullRequestEvent = {
				...basePayload,
				action: "labeled",
				label: {
					id: 2,
					node_id: "MDU6TGFiZWwy",
					url: "https://api.github.com/repos/test-owner/test-repo/labels/enhancement",
					name: "enhancement",
					color: "a2eeef",
					default: false,
					description: "New feature or request",
				},
			};

			// Mock payload in github.context
			mockContext.payload = labeledPayload;

			// Call action handler
			const handler = new PullRequestHandler(testConfig, actionConfig);
			await handler.performActions(labeledPayload, labeledPayload.pull_request);

			// Verify comment was posted
			expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 202,
				body: "Thank you for this enhancement!",
			});

			// Verify reviewer was requested
			expect(mockOctokit.rest.pulls.requestReviewers).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				pull_number: 202,
				reviewers: ["featureReviewer"],
			});
		});

		it("should perform actions when label is added to discussion", async () => {
			const payloadPath = path.join(process.cwd(), "data", "discussion", "discussion-question.json");
			const basePayload = JSON.parse(fs.readFileSync(payloadPath, "utf8")) as DiscussionEvent;

			// Define config with label-triggered actions for discussions
			const testConfig: Config = {
				labels: {
					add: {
						question: {
							comments: ["Thank you for your question!"],
						},
					},
				},
			};

			// Simulate a labeled event
			const labeledPayload: DiscussionEvent = {
				...basePayload,
				action: "labeled",
				label: {
					id: 3,
					node_id: "MDU6TGFiZWwz",
					url: "https://api.github.com/repos/test-owner/test-repo/labels/question",
					name: "question",
					color: "d876e3",
					default: false,
					description: "Further information is requested",
				},
			};

			// Mock payload in github.context
			mockContext.payload = labeledPayload;

			// Mock GraphQL for discussion actions
			mockOctokit.graphql = jest.fn<() => Promise<any>>().mockResolvedValue({
				addDiscussionComment: { comment: { id: "comment_id" } },
			});

			// Call action handler
			const handler = new DiscussionHandler(testConfig, actionConfig);
			await handler.performActions(labeledPayload, labeledPayload.discussion);

			// Verify GraphQL mutation was called to add comment
			expect(mockOctokit.graphql).toHaveBeenCalledWith(
				expect.stringContaining("addDiscussionComment"),
				expect.objectContaining({
					body: "Thank you for your question!",
					discussionId: labeledPayload.discussion.node_id,
				}),
			);
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

			// Mock payload in github.context
			mockContext.payload = payload;

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
			const labeledPayload: IssuesEvent = {
				...payload,
				action: "labeled",
				label: {
					id: 1,
					node_id: "MDU6TGFiZWwx",
					url: "https://api.github.com/repos/test-owner/test-repo/labels/bug",
					name: "bug",
					color: "d73a4a",
					default: false,
					description: "Something isn't working",
				},
			};

			// Update context payload for labeled action
			mockContext.payload = labeledPayload;

			const handler = new IssueHandler(fullConfig, actionConfig);
			await handler.performActions(labeledPayload, labeledPayload.issue);

			// Should have performed label-triggered actions
			expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
			expect(mockOctokit.rest.issues.addAssignees).toHaveBeenCalled();
		});
	});
});
