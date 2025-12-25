import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock dependencies
jest.unstable_mockModule("@actions/core", () => ({
	debug: jest.fn(),
	info: jest.fn(),
	warning: jest.fn(),
	setFailed: jest.fn(),
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

const { IssueHandler } = await import("../src/handlers/issueHandler");
const core = await import("@actions/core");
const github = await import("@actions/github");
import type Config from "../src/models/config";
import type GHActionConfig from "../src/models/ghActionConfig";

describe("IssueHandler", () => {
	let mockOctokit: any;
	let actionConfig: GHActionConfig;

	beforeEach(() => {
		jest.clearAllMocks();

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
			},
			graphql: jest.fn(),
		};

		(github.getOctokit as any).mockReturnValue(mockOctokit);

		actionConfig = {
			"github-token": "test-token",
			"config-path": "./config.yaml",
		};
	});

	describe("getThreadType", () => {
		it("should return 'issue'", () => {
			const config: Config = {} as Config;
			const handler = new IssueHandler(config, actionConfig);
			expect(handler.getThreadType()).toBe("issue");
		});
	});

	describe("performActions", () => {
		it("should add comments to unlocked issue", async () => {
			const config: Config = {
				labels: {
					add: {
						bug: {
							comments: ["Thank you for reporting this bug"],
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
				body: "Thank you for reporting this bug",
			});
		});

		it("should replace issue-author placeholder in comments", async () => {
			const config: Config = {
				labels: {
					add: {
						bug: {
							comments: ["Thanks @{issue-author} for the report"],
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
				user: { login: "contributor" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				body: "Thanks @contributor for the report",
			});
		});

		it("should unlock, comment, and re-lock on locked issue", async () => {
			const config: Config = {
				labels: {
					add: {
						bug: {
							comments: ["Adding comment"],
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
				locked: true,
				active_lock_reason: "spam",
				user: { login: "testuser" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.unlock).toHaveBeenCalled();
			expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
			expect(mockOctokit.rest.issues.lock).toHaveBeenCalled();
		});

		it("should add multiple labels", async () => {
			const config: Config = {
				labels: {
					add: {
						bug: {
							labels: {
								add: ["needs-triage", "priority-high"],
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
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				labels: ["needs-triage", "priority-high"],
			});
		});

		it("should not add labels that already exist", async () => {
			const config: Config = {
				labels: {
					add: {
						bug: {
							labels: {
								add: ["needs-triage", "priority-high"],
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
				labels: [{ name: "needs-triage" }],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				labels: ["priority-high"],
			});
		});

		it("should remove labels", async () => {
			const config: Config = {
				labels: {
					add: {
						bug: {
							labels: {
								remove: ["wontfix", "invalid"],
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
				labels: [{ name: "wontfix" }, { name: "enhancement" }],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.removeLabel).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				name: "wontfix",
			});
		});

		it("should add assignees", async () => {
			const config: Config = {
				labels: {
					add: {
						bug: {
							assignees: {
								add: ["maintainer1", "maintainer2"],
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

		it("should remove assignees", async () => {
			const config: Config = {
				labels: {
					add: {
						resolved: {
							assignees: {
								remove: ["maintainer1"],
							},
						},
					},
				},
			};

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "resolved" },
			};
			const threadData = {
				number: 1,
				locked: false,
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.removeAssignees).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				assignees: ["maintainer1"],
			});
		});

		it("should close issue", async () => {
			const config: Config = {
				labels: {
					add: {
						wontfix: {
							close: true,
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
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				state: "closed",
			});
		});

		it("should close issue with reason", async () => {
			const config: Config = {
				labels: {
					add: {
						wontfix: {
							close: true,
							close_reason: "not-planned",
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
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				state: "closed",
				state_reason: "not-planned",
			});
		});

		it("should not close already closed issue", async () => {
			const config: Config = {
				labels: {
					add: {
						wontfix: {
							close: true,
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
				state: "closed",
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.update).not.toHaveBeenCalled();
		});

		it("should lock issue", async () => {
			const config: Config = {
				labels: {
					add: {
						spam: {
							lock: true,
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
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.lock).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
			});
		});

		it("should not lock already locked issue", async () => {
			const config: Config = {
				labels: {
					add: {
						spam: {
							lock: true,
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
				locked: true,
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.lock).not.toHaveBeenCalled();
		});

		it("should pin issue using GraphQL", async () => {
			const config: Config = {
				labels: {
					add: {
						important: {
							pin: true,
						},
					},
				},
			};

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "important" },
			};
			const threadData = {
				number: 1,
				locked: false,
				node_id: "issue_node_id",
				labels: [],
			} as any;

			mockOctokit.graphql.mockResolvedValue({});

			await handler.performActions(payload, threadData);

			expect(mockOctokit.graphql).toHaveBeenCalledWith(
				expect.stringContaining("pinIssue"),
				expect.objectContaining({ issueId: "issue_node_id" }),
			);
		});

		it("should handle pin failure gracefully", async () => {
			const config: Config = {
				labels: {
					add: {
						important: {
							pin: true,
						},
					},
				},
			};

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "important" },
			};
			const threadData = {
				number: 1,
				locked: false,
				node_id: "issue_node_id",
				labels: [],
			} as any;

			mockOctokit.graphql.mockRejectedValue(new Error("Pin failed"));

			await handler.performActions(payload, threadData);

			expect(core.warning).toHaveBeenCalledWith(expect.stringContaining("Failed to pin issue"));
		});

		it("should add milestone to issue", async () => {
			const config: Config = {
				labels: {
					add: {
						"v1.0": {
							milestones: {
								add: ["Version 1.0"],
							},
						},
					},
				},
			};

			mockOctokit.rest.issues.listMilestones.mockResolvedValue({
				data: [
					{ number: 1, title: "Version 1.0" },
					{ number: 2, title: "Version 2.0" },
				],
			});

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "v1.0" },
			};
			const threadData = {
				number: 1,
				locked: false,
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.listMilestones).toHaveBeenCalled();
			expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				milestone: 1,
			});
		});

		it("should warn when milestone not found", async () => {
			const config: Config = {
				labels: {
					add: {
						"v1.0": {
							milestones: {
								add: ["Nonexistent"],
							},
						},
					},
				},
			};

			mockOctokit.rest.issues.listMilestones.mockResolvedValue({
				data: [{ number: 1, title: "Version 1.0" }],
			});

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "v1.0" },
			};
			const threadData = {
				number: 1,
				locked: false,
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Milestone "Nonexistent" not found'));
		});

		it("should remove milestone from issue", async () => {
			const config: Config = {
				labels: {
					add: {
						"no-milestone": {
							milestones: {
								remove: ["old-milestone"],
							},
						},
					},
				},
			};

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "no-milestone" },
			};
			const threadData = {
				number: 1,
				locked: false,
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				milestone: null,
			});
		});

		it("should handle no actions found", async () => {
			const config: Config = {
				labels: {},
			};

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "unknown" },
			};
			const threadData = {
				number: 1,
				locked: false,
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(core.debug).toHaveBeenCalledWith("No actions found for issue");
		});

		it("should perform multiple actions in sequence", async () => {
			const config: Config = {
				labels: {
					add: {
						critical: {
							comments: ["Critical bug detected"],
							labels: {
								add: ["priority-high"],
							},
							assignees: {
								add: ["team-lead"],
							},
							close: false,
						},
					},
				},
			};

			const handler = new IssueHandler(config, actionConfig);
			const payload = {
				action: "labeled",
				label: { name: "critical" },
			};
			const threadData = {
				number: 1,
				locked: false,
				state: "open",
				user: { login: "reporter" },
				labels: [],
			} as any;

			await handler.performActions(payload, threadData);

			expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
			expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalled();
			expect(mockOctokit.rest.issues.addAssignees).toHaveBeenCalled();
		});
	});
});
