import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

// Mock dependencies
jest.unstable_mockModule("@actions/core", () => import("./fixtures/core"));
jest.unstable_mockModule("@actions/github", () => import("./fixtures/github"));

const { IssueHandler } = await import("../src/handlers/issueHandler");
const { PullRequestHandler } =
  await import("../src/handlers/pullRequestHandler");
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
  });

  describe("PullRequestHandler", () => {
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

      expect(
        mockOctokit.rest.pulls.removeRequestedReviewers,
      ).toHaveBeenCalledWith({
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
