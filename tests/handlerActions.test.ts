import { afterEach, beforeEach, describe, expect, it, jest, mock } from "bun:test";
import * as coreFixture from "./fixtures/core";
import * as githubFixture from "./fixtures/github";

// Mock dependencies
mock.module("@actions/core", () => coreFixture);
mock.module("@actions/github", () => githubFixture);

const { IssueHandler } = await import("../src/handlers/issueHandler");
const { PullRequestHandler } = await import("../src/handlers/pullRequestHandler");
const githubModule = await import("./fixtures/github");

import type Config from "../src/models/internal/config";
import type GHActionConfig from "../src/models/internal/ghActionConfig";

describe("Handler Actions with Config Inheritance", () => {
	let mockOctokit: {
		rest: {
			issues: Record<string, jest.Mock>;
			pulls: Record<string, jest.Mock>;
		};
		graphql: jest.Mock;
	};
	let actionConfig: GHActionConfig;

	beforeEach(() => {
		mockOctokit = {
			rest: {
				issues: {
					createComment: jest.fn(),
					addLabels: jest.fn(),
					removeLabel: jest.fn(),
					addAssignees: jest.fn(),
					removeAssignees: jest.fn(),
					update: jest.fn(),
					lock: jest.fn(),
					unlock: jest.fn(),
					get: jest.fn(),
					listMilestones: jest.fn(),
				},
				pulls: {
					requestReviewers: jest.fn(),
					removeRequestedReviewers: jest.fn(),
					createReview: jest.fn(),
					update: jest.fn(),
				},
			},
			graphql: jest.fn(),
		};

		githubModule.getOctokit.mockReturnValue(mockOctokit);

		actionConfig = {
			"github-token": "test-token",
			"config-path": "./config.yaml",
		};
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("IssueHandler", () => {
		it("should handle root-level comments", async () => {
			const config: Config = {
				labels: {
					add: {
						bug: {
							comments: ["Thank you for the bug report"],
						},
					},
				},
			};

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "bug" },
			};
			const threadData = {
				number: 1,
				locked: false,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				body: "Thank you for the bug report",
			});
		});

		it("should handle issue-specific assignees", async () => {
			const config: Config = {
				labels: {
					add: {
						bug: {
							issues: {
								assignees: {
									add: ["maintainer1", "maintainer2"],
								},
							},
						},
					},
				},
			};

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "bug" },
			};
			const threadData = {
				number: 1,
				locked: false,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.addAssignees).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				assignees: ["maintainer1", "maintainer2"],
			});
		});

		it("should handle issue close with reason", async () => {
			const config: Config = {
				labels: {
					add: {
						wontfix: {
							issues: {
								close: true,
								close_reason: "not-planned",
							},
						},
					},
				},
			};

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "wontfix" },
			};
			const threadData = {
				number: 1,
				locked: false,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith(
				expect.objectContaining({
					owner: "test-owner",
					repo: "test-repo",
					issue_number: 1,
					state: "closed",
					state_reason: "not-planned",
				}),
			);
		});

		it("should handle nested label actions", async () => {
			const config: Config = {
				labels: {
					add: {
						bug: {
							comments: ["Root comment"],
							issues: {
								labels: {
									add: ["needs-triage", "bug-confirmed"],
								},
							},
						},
					},
				},
			};

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "bug" },
			};
			const threadData = {
				number: 1,
				locked: false,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				labels: ["needs-triage", "bug-confirmed"],
			});
		});

		it("should handle milestones", async () => {
			const config: Config = {
				labels: {
					add: {
						"v1.0": {
							issues: {
								milestones: {
									add: ["v1.0"],
								},
							},
						},
					},
				},
			};

			(mockOctokit.rest.issues.listMilestones as jest.Mock).mockResolvedValue({
				data: [
					{ number: 1, title: "v1.0" },
					{ number: 2, title: "v2.0" },
				],
			} as never);

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "v1.0" },
			};
			const threadData = {
				number: 1,
				locked: false,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.listMilestones).toHaveBeenCalled();
			expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith(
				expect.objectContaining({
					owner: "test-owner",
					repo: "test-repo",
					issue_number: 1,
					milestone: 1,
				}),
			);
		});

		it("should handle issue lock", async () => {
			const config: Config = {
				labels: {
					add: {
						spam: {
							issues: {
								lock: true,
							},
						},
					},
				},
			};

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "spam" },
			};
			const threadData = {
				number: 1,
				locked: false,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.lock).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
			});
		});

		it("should handle issue reopen", async () => {
			const config: Config = {
				labels: {
					remove: {
						wontfix: {
							issues: {
								reopen: true,
							},
						},
					},
				},
			};

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "unlabeled",
				label: { name: "wontfix" },
			};
			const threadData = {
				number: 1,
				locked: false,
				state: "closed",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				state: "open",
			});
		});

		it("should handle issue unlock", async () => {
			const config: Config = {
				labels: {
					remove: {
						wontfix: {
							issues: {
								unlock: true,
							},
						},
					},
				},
			};

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "unlabeled",
				label: { name: "wontfix" },
			};
			const threadData = {
				number: 1,
				locked: true,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.unlock).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
			});
		});

		it("should handle issue unpin", async () => {
			const config: Config = {
				labels: {
					add: {
						"not-priority": {
							issues: {
								unpin: true,
							},
						},
					},
				},
			};

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "not-priority" },
			};
			const threadData = {
				number: 1,
				node_id: "issue-node-id",
				locked: false,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.graphql).toHaveBeenCalledWith(expect.stringContaining("unpinIssue"), {
				issueId: "issue-node-id",
			});
		});
	});

	describe("PullRequestHandler", () => {
		it("handles PR labels, assignees, lock, and reviewer variants", async () => {
			const config: Config = {
				labels: {
					add: {
						full: {
							prs: {
								labels: { add: { one: {}, two: {} }, remove: { stale: {} } },
								assignees: { add: ["owner"], remove: ["old-owner"] },
								reviewers: { add: ["author"], remove: ["allReviewers", "specific"] },
								lock: true,
								lock_reason: "resolved",
							},
						},
					},
				},
			};
			await new PullRequestHandler(config, actionConfig).performActions(
				{ action: "labeled", label: { name: "full" } },
				{
					number: 1,
					state: "open",
					locked: false,
					user: { login: "author" },
					labels: [{ name: "stale" }],
					requested_reviewers: [{ login: "requested" }, { name: "team" }],
				} as any,
			);

			expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith(
				expect.objectContaining({ labels: ["one", "two"] }),
			);
			expect(mockOctokit.rest.issues.removeLabel).toHaveBeenCalledWith(expect.objectContaining({ name: "stale" }));
			expect(mockOctokit.rest.issues.addAssignees).toHaveBeenCalled();
			expect(mockOctokit.rest.issues.removeAssignees).toHaveBeenCalled();
			expect(mockOctokit.rest.issues.lock).toHaveBeenCalledWith(expect.objectContaining({ lock_reason: "resolved" }));
		});

		it("handles reviewer and review API failures", async () => {
			const config: Config = {
				labels: {
					add: {
						review: {
							prs: {
								reviewers: { add: ["reviewer1"], remove: ["reviewer2"] },
								request_changes: true,
								approve: true,
							},
						},
					},
				},
			};
			mockOctokit.rest.pulls.requestReviewers.mockRejectedValue(new Error("add failed"));
			mockOctokit.rest.pulls.removeRequestedReviewers.mockRejectedValue(new Error("remove failed"));
			mockOctokit.rest.pulls.createReview.mockRejectedValue(new Error("review failed"));

			await expect(
				new PullRequestHandler(config, actionConfig).performActions({ action: "labeled", label: { name: "review" } }, {
					number: 1,
					state: "open",
					user: { login: "author" },
					labels: [],
				} as any),
			).rejects.toThrow("Failed to add reviewers");

			expect(mockOctokit.rest.pulls.requestReviewers).toHaveBeenCalled();
			expect(mockOctokit.rest.pulls.removeRequestedReviewers).not.toHaveBeenCalled();
			expect(mockOctokit.rest.pulls.createReview).not.toHaveBeenCalled();
		});

		it("handles reviewer removal and review creation failures", async () => {
			const config: Config = {
				labels: {
					add: {
						review: {
							prs: { reviewers: { remove: ["reviewer"] }, request_changes: true, approve: true },
						},
					},
				},
			};
			mockOctokit.rest.pulls.removeRequestedReviewers.mockRejectedValue(new Error("remove failed"));

			await expect(
				new PullRequestHandler(config, actionConfig).performActions({ action: "labeled", label: { name: "review" } }, {
					number: 1,
					state: "open",
					labels: [],
				} as any),
			).rejects.toThrow("Failed to remove reviewers");

			mockOctokit.rest.pulls.removeRequestedReviewers.mockResolvedValue({});
			mockOctokit.rest.pulls.createReview.mockRejectedValue(new Error("review failed"));
			await expect(
				new PullRequestHandler(config, actionConfig).performActions({ action: "labeled", label: { name: "review" } }, {
					number: 1,
					state: "open",
					labels: [],
				} as any),
			).rejects.toThrow("Failed to create request_changes review");
		});

		it("handles draft-state update failures", async () => {
			const config: Config = {
				labels: { add: { draft: { prs: { draft: true } } } },
			};
			mockOctokit.graphql.mockRejectedValue(new Error("draft failed"));

			await expect(
				new PullRequestHandler(config, actionConfig).performActions({ action: "labeled", label: { name: "draft" } }, {
					number: 1,
					node_id: "pr-node",
					draft: false,
					state: "open",
					labels: [],
				} as any),
			).rejects.toThrow("Failed to update PR draft state to true");
		});

		it("skips unchanged draft and inactive close/reopen states", async () => {
			const config: Config = {
				labels: {
					add: {
						state: { prs: { draft: false } },
					},
				},
			};

			await new PullRequestHandler(config, actionConfig).performActions(
				{ action: "labeled", label: { name: "state" } },
				{ number: 1, state: "open", draft: false, locked: false, labels: [] } as any,
			);

			expect(mockOctokit.rest.pulls.update).not.toHaveBeenCalled();
			expect(mockOctokit.graphql).not.toHaveBeenCalled();
		});
		it("should handle PR-specific reviewers", async () => {
			const config: Config = {
				labels: {
					add: {
						"needs-review": {
							prs: {
								reviewers: {
									add: ["reviewer1", "reviewer2"],
								},
							},
						},
					},
				},
			};

			const handler = new PullRequestHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "needs-review" },
			};
			const threadData = {
				number: 1,
				locked: false,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.pulls.requestReviewers).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				pull_number: 1,
				reviewers: ["reviewer1", "reviewer2"],
			});
		});

		it("should handle PR assignees", async () => {
			const config: Config = {
				labels: {
					add: {
						wip: {
							prs: {
								assignees: {
									add: ["developer1"],
								},
							},
						},
					},
				},
			};

			const handler = new PullRequestHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "wip" },
			};
			const threadData = {
				number: 1,
				locked: false,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.addAssignees).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				assignees: ["developer1"],
			});
		});

		it("should handle reviewer removal", async () => {
			const config: Config = {
				labels: {
					add: {
						"do-not-merge": {
							prs: {
								reviewers: {
									remove: ["reviewer1"],
								},
							},
						},
					},
				},
			};

			const handler = new PullRequestHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "do-not-merge" },
			};
			const threadData = {
				number: 1,
				locked: false,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.pulls.removeRequestedReviewers).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				pull_number: 1,
				reviewers: ["reviewer1"],
			});
		});

		it("should handle PR close", async () => {
			const config: Config = {
				labels: {
					add: {
						invalid: {
							prs: {
								close: true,
							},
						},
					},
				},
			};

			const handler = new PullRequestHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "invalid" },
			};
			const threadData = {
				number: 1,
				locked: false,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				pull_number: 1,
				state: "closed",
			});
		});

		it("should handle PR reopen", async () => {
			const config: Config = {
				labels: {
					remove: {
						duplicate: {
							prs: {
								reopen: true,
							},
						},
					},
				},
			};

			const handler = new PullRequestHandler(config, actionConfig);
			const payload = {
				action: "unlabeled",
				label: { name: "duplicate" },
			};
			const threadData = {
				number: 1,
				locked: false,
				state: "closed",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				pull_number: 1,
				state: "open",
			});
		});

		it("should handle PR draft state", async () => {
			const config: Config = {
				labels: {
					add: {
						wip: {
							prs: {
								draft: true,
							},
						},
					},
				},
			};

			const handler = new PullRequestHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "wip" },
			};
			const threadData = {
				number: 1,
				node_id: "pr-node-id",
				draft: false,
				locked: false,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.graphql).toHaveBeenCalledWith(expect.stringContaining("convertPullRequestToDraft"), {
				pullRequestId: "pr-node-id",
			});
		});

		it("should handle PR ready for review", async () => {
			const config: Config = {
				labels: {
					remove: {
						wip: {
							prs: {
								draft: false,
							},
						},
					},
				},
			};

			const handler = new PullRequestHandler(config, actionConfig);
			const payload = {
				action: "unlabeled",
				label: { name: "wip" },
			};
			const threadData = {
				number: 1,
				node_id: "pr-node-id",
				draft: true,
				locked: false,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.graphql).toHaveBeenCalledWith(expect.stringContaining("markPullRequestReadyForReview"), {
				pullRequestId: "pr-node-id",
			});
		});

		it("should create request changes and approve reviews", async () => {
			const config: Config = {
				labels: {
					add: {
						"needs-review-decision": {
							prs: {
								request_changes: true,
								approve: true,
							},
						},
					},
				},
			};

			const handler = new PullRequestHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "needs-review-decision" },
			};
			const threadData = {
				number: 1,
				locked: false,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.pulls.createReview).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				pull_number: 1,
				event: "REQUEST_CHANGES",
			});
			expect(mockOctokit.rest.pulls.createReview).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				pull_number: 1,
				event: "APPROVE",
			});
		});

		it("should expand allReviewers to requested reviewers", async () => {
			const config: Config = {
				labels: {
					remove: {
						wip: {
							prs: {
								reviewers: {
									remove: ["allReviewers"],
								},
							},
						},
					},
				},
			};

			const handler = new PullRequestHandler(config, actionConfig);
			const payload = {
				action: "unlabeled",
				label: { name: "wip" },
			};
			const threadData = {
				number: 1,
				locked: false,
				state: "open",
				user: { login: "testuser" },
				requested_reviewers: [{ login: "reviewer1" }, { login: "reviewer2" }],
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.pulls.removeRequestedReviewers).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				pull_number: 1,
				reviewers: ["reviewer1", "reviewer2"],
			});
		});

		it("should handle PR unlock", async () => {
			const config: Config = {
				labels: {
					remove: {
						wip: {
							prs: {
								unlock: true,
							},
						},
					},
				},
			};

			const handler = new PullRequestHandler(config, actionConfig);
			const payload = {
				action: "unlabeled",
				label: { name: "wip" },
			};
			const threadData = {
				number: 1,
				locked: true,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.unlock).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
			});
		});

		it("should filter out PR author from reviewers", async () => {
			const config: Config = {
				labels: {
					add: {
						"needs-review": {
							prs: {
								reviewers: {
									add: ["testuser", "reviewer1"],
								},
							},
						},
					},
				},
			};

			const handler = new PullRequestHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "needs-review" },
			};
			const threadData = {
				number: 1,
				locked: false,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.pulls.requestReviewers).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				pull_number: 1,
				reviewers: ["reviewer1"],
			});
		});
	});

	describe("Label removal handling", () => {
		it("should handle label removal for issues", async () => {
			const config: Config = {
				labels: {
					remove: {
						wip: {
							comments: ["No longer WIP"],
							issues: {
								assignees: {
									add: ["reviewer1"],
								},
							},
						},
					},
				},
			};

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "unlabeled",
				label: { name: "wip" },
			};
			const threadData = {
				number: 1,
				locked: false,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
			expect(mockOctokit.rest.issues.addAssignees).toHaveBeenCalled();
		});
	});

	describe("Inheritance and merging", () => {
		it("should apply both root and thread-specific actions", async () => {
			const config: Config = {
				labels: {
					add: {
						priority: {
							comments: ["Root level comment"],
							labels: {
								add: ["tracked"],
							},
							issues: {
								assignees: {
									add: ["maintainer"],
								},
								labels: {
									add: ["issue-specific"],
								},
							},
						},
					},
				},
			};

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "priority" },
			};
			const threadData = {
				number: 1,
				locked: false,
				state: "open",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			// Should execute root-level comment
			expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
			// Should execute issue-specific assignees
			expect(mockOctokit.rest.issues.addAssignees).toHaveBeenCalled();
			// Should execute issue-specific labels
			expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith(
				expect.objectContaining({
					labels: ["issue-specific"],
				}),
			);
		});
	});
});
