import { beforeEach, describe, expect, it, jest } from "@jest/globals";

// Mock dependencies BEFORE importing
jest.unstable_mockModule("@actions/core", () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  setFailed: jest.fn(),
}));

jest.unstable_mockModule("@actions/github", () => ({
  getOctokit: jest.fn(() => ({
    rest: {
      issues: {
        get: jest.fn(),
        unlock: jest.fn(),
        lock: jest.fn(),
        addLabels: jest.fn(),
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
const { AbstractHandler } = await import("../src/handlers/baseHandler");
const github = await import("@actions/github");

import type { WebhookPayload } from "@actions/github/lib/interfaces";
import type Config from "../src/models/config";
import type GHActionConfig from "../src/models/ghActionConfig";
import type { ThreadType } from "../src/types/common";

// Create a concrete implementation for testing
class TestHandler extends AbstractHandler {
  getThreadType(): ThreadType {
    return "issue";
  }

  async performActions(
    _payload: WebhookPayload,
    _threadData:
      | IssuesEvent["issue"]
      | PullRequestEvent["pull_request"]
      | DiscussionEvent["discussion"],
  ): Promise<void> {
    // Test implementation
  }
}

describe("AbstractHandler / BaseHandler", () => {
  let mockOctokit: {
    rest: {
      issues: Record<string, jest.Mock>;
      pulls: Record<string, jest.Mock>;
    };
    graphql: jest.Mock;
  };
  let mockConfig: Config;
  let mockActionConfig: GHActionConfig;
  let handler: TestHandler;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOctokit = {
      rest: {
        issues: {
          get: jest.fn(),
          unlock: jest.fn(),
          lock: jest.fn(),
          addLabels: jest.fn(),
        },
      },
    };

    (github.getOctokit as any).mockReturnValue(mockOctokit);

    mockActionConfig = {
      "github-token": "test-token",
      "config-path": "test-config.yml",
    };

    mockConfig = {} as Config;
  });

  describe("constructor", () => {
    it("should initialize with correct config and client", () => {
      handler = new TestHandler(mockConfig, mockActionConfig);

      expect(handler).toBeDefined();
      expect(github.getOctokit).toHaveBeenCalledWith("test-token");
    });
  });

  describe("getLabelActions", () => {
    it("should return actions for label addition", async () => {
      mockConfig = {
        labels: {
          add: {
            bug: {
              comments: ["Bug detected"],
            },
          },
        },
      };

      handler = new TestHandler(mockConfig, mockActionConfig);
      const actions = await (handler as any).getLabelActions(
        "bug",
        "labeled",
        "issue",
      );

      expect(actions).toBeDefined();
      expect(actions?.comments).toEqual(["Bug detected"]);
    });

    it("should return actions for label removal", async () => {
      mockConfig = {
        labels: {
          remove: {
            wip: {
              comments: ["No longer WIP"],
            },
          },
        },
      };

      handler = new TestHandler(mockConfig, mockActionConfig);
      const actions = await (handler as any).getLabelActions(
        "wip",
        "unlabeled",
        "issue",
      );

      expect(actions).toBeDefined();
      expect(actions?.comments).toEqual(["No longer WIP"]);
    });

    it("should merge thread-specific actions with root-level actions", async () => {
      mockConfig = {
        labels: {
          add: {
            bug: {
              comments: ["Root comment"],
              issues: {
                assignees: {
                  add: ["maintainer1"],
                },
                close: true,
              },
            },
          },
        },
      };

      handler = new TestHandler(mockConfig, mockActionConfig);
      const actions = await (handler as any).getLabelActions(
        "bug",
        "labeled",
        "issue",
      );

      expect(actions).toBeDefined();
      expect(actions?.comments).toEqual(["Root comment"]);
      expect(actions?.assignees).toEqual({ add: ["maintainer1"] });
      expect(actions?.close).toBe(true);
    });

    it("should prioritize thread-specific actions over root-level", async () => {
      mockConfig = {
        labels: {
          add: {
            bug: {
              comments: ["Root comment"],
              issues: {
                comments: ["Issue-specific comment"],
              },
            },
          },
        },
      };

      handler = new TestHandler(mockConfig, mockActionConfig);
      const actions = await (handler as any).getLabelActions(
        "bug",
        "labeled",
        "issue",
      );

      expect(actions).toBeDefined();
      expect(actions?.comments).toEqual(["Issue-specific comment"]);
    });

    it("should handle PR-specific actions", async () => {
      mockConfig = {
        labels: {
          add: {
            "needs-review": {
              prs: {
                reviewers: {
                  add: ["reviewer1"],
                },
              },
            },
          },
        },
      };

      handler = new TestHandler(mockConfig, mockActionConfig);
      const actions = await (handler as any).getLabelActions(
        "needs-review",
        "labeled",
        "pr",
      );

      expect(actions).toBeDefined();
      expect(actions?.reviewers).toEqual({ add: ["reviewer1"] });
    });

    it("should handle discussion-specific actions", async () => {
      mockConfig = {
        labels: {
          add: {
            question: {
              discussions: {
                category: "Q&A",
              },
            },
          },
        },
      };

      handler = new TestHandler(mockConfig, mockActionConfig);
      const actions = await (handler as any).getLabelActions(
        "question",
        "labeled",
        "discussion",
      );

      expect(actions).toBeDefined();
      expect(actions?.category).toBe("Q&A");
    });

    it("should return default actions when specific label not found", async () => {
      mockConfig = {
        labels: {
          default: {
            "*": {
              comments: ["Default action"],
            },
          },
        },
      };

      handler = new TestHandler(mockConfig, mockActionConfig);
      const actions = await (handler as any).getLabelActions(
        "unknown-label",
        "labeled",
        "issue",
      );

      expect(actions).toBeDefined();
      expect(actions?.comments).toEqual(["Default action"]);
    });

    it("should return undefined when no actions found", async () => {
      mockConfig = {
        labels: {},
      };

      handler = new TestHandler(mockConfig, mockActionConfig);
      const actions = await (handler as any).getLabelActions(
        "unknown-label",
        "labeled",
        "issue",
      );

      expect(actions).toBeUndefined();
    });

    it("should handle missing labels config", async () => {
      mockConfig = {};

      handler = new TestHandler(mockConfig, mockActionConfig);
      const actions = await (handler as any).getLabelActions(
        "bug",
        "labeled",
        "issue",
      );

      expect(actions).toBeUndefined();
    });
  });

  describe("getActionConfig", () => {
    it("should return the action configuration", async () => {
      handler = new TestHandler(mockConfig, mockActionConfig);
      const config = await (handler as any).getActionConfig();

      expect(config).toEqual(mockActionConfig);
    });
  });

  describe("ensureUnlock", () => {
    const issueParams = {
      owner: "test-owner",
      repo: "test-repo",
      issue_number: 1,
    };

    it("should execute action directly when issue is not locked", async () => {
      handler = new TestHandler(mockConfig, mockActionConfig);
      const mockAction = jest.fn();
      const lock = { active: false };

      await (handler as any).ensureUnlock(issueParams, lock, mockAction);

      expect(mockAction).toHaveBeenCalled();
      expect(mockOctokit.rest.issues.unlock).not.toHaveBeenCalled();
      expect(mockOctokit.rest.issues.lock).not.toHaveBeenCalled();
    });

    it("should unlock, execute action, and re-lock when issue is locked", async () => {
      handler = new TestHandler(mockConfig, mockActionConfig);
      const mockAction = jest.fn();
      const lock = { active: true, reason: "spam" };

      await (handler as any).ensureUnlock(issueParams, lock, mockAction);

      expect(mockOctokit.rest.issues.unlock).toHaveBeenCalledWith(issueParams);
      expect(mockAction).toHaveBeenCalled();
      expect(mockOctokit.rest.issues.lock).toHaveBeenCalledWith({
        ...issueParams,
        lock_reason: "spam",
        headers: {
          Accept: "application/vnd.github.sailor-v-preview+json",
        },
      });
    });

    it("should fetch lock reason if not provided", async () => {
      handler = new TestHandler(mockConfig, mockActionConfig);
      const mockAction = jest.fn();
      const lock = { active: true };

      mockOctokit.rest.issues.get.mockResolvedValue({
        data: {
          active_lock_reason: "too heated",
        },
      });

      await (handler as any).ensureUnlock(issueParams, lock, mockAction);

      expect(mockOctokit.rest.issues.get).toHaveBeenCalledWith({
        ...issueParams,
        headers: {
          Accept: "application/vnd.github.sailor-v-preview+json",
        },
      });
      expect(mockOctokit.rest.issues.unlock).toHaveBeenCalledWith(issueParams);
      expect(mockAction).toHaveBeenCalled();
      expect(mockOctokit.rest.issues.lock).toHaveBeenCalledWith({
        ...issueParams,
        lock_reason: "too heated",
        headers: {
          Accept: "application/vnd.github.sailor-v-preview+json",
        },
      });
    });

    it("should re-lock even if action throws an error", async () => {
      handler = new TestHandler(mockConfig, mockActionConfig);
      const mockAction = jest
        .fn()
        .mockRejectedValue(new Error("Action failed"));
      const lock = { active: true, reason: "spam" };

      await expect(
        (handler as any).ensureUnlock(issueParams, lock, mockAction),
      ).rejects.toThrow("Action failed");

      expect(mockOctokit.rest.issues.unlock).toHaveBeenCalled();
      expect(mockOctokit.rest.issues.lock).toHaveBeenCalled();
    });

    it("should handle lock without reason", async () => {
      handler = new TestHandler(mockConfig, mockActionConfig);
      const mockAction = jest.fn();
      const lock = { active: true, reason: null };

      mockOctokit.rest.issues.get.mockResolvedValue({
        data: {
          active_lock_reason: null,
        },
      });

      await (handler as any).ensureUnlock(issueParams, lock, mockAction);

      expect(mockOctokit.rest.issues.lock).toHaveBeenCalledWith(issueParams);
    });

    it("should handle all valid lock reasons", async () => {
      handler = new TestHandler(mockConfig, mockActionConfig);
      const mockAction = jest.fn();
      const validReasons = ["resolved", "off-topic", "too heated", "spam"];

      for (const reason of validReasons) {
        jest.clearAllMocks();
        const lock = { active: true, reason };

        await (handler as any).ensureUnlock(issueParams, lock, mockAction);

        expect(mockOctokit.rest.issues.lock).toHaveBeenCalledWith({
          ...issueParams,
          lock_reason: reason,
          headers: {
            Accept: "application/vnd.github.sailor-v-preview+json",
          },
        });
      }
    });
  });

  describe("thread type handling", () => {
    it("should correctly map issue thread type", () => {
      handler = new TestHandler(mockConfig, mockActionConfig);
      expect(handler.getThreadType()).toBe("issue");
    });

    it("should handle complex label configurations", async () => {
      mockConfig = {
        labels: {
          add: {
            security: {
              comments: ["Security issue detected"],
              labels: {
                add: ["high-priority"],
              },
              issues: {
                assignees: {
                  add: ["security-team"],
                },
                pin: true,
              },
              prs: {
                reviewers: {
                  add: ["security-reviewer"],
                },
              },
            },
          },
        },
      };

      handler = new TestHandler(mockConfig, mockActionConfig);
      const actions = await (handler as any).getLabelActions(
        "security",
        "labeled",
        "issue",
      );

      expect(actions).toBeDefined();
      expect(actions?.comments).toEqual(["Security issue detected"]);
      expect(actions?.labels).toEqual({ add: ["high-priority"] });
      expect(actions?.assignees).toEqual({ add: ["security-team"] });
      expect(actions?.pin).toBe(true);
    });
  });
});
