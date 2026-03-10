import { describe, it, expect, beforeEach, jest } from "@jest/globals";

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

  describe("findMatchingRegexLabels", () => {
    it("should find matching labels for issue content", async () => {
      const threadData = {
        number: 1,
        title: "Found a bug in the application",
        body: "This is a detailed description of the bug",
        labels: [],
      };

      const matchingLabels = await (
        regexHandler as any
      ).findMatchingRegexLabels(threadData, "issue");

      expect(matchingLabels).toContain("bug");
    });

    it("should find multiple matching labels", async () => {
      const threadData = {
        number: 1,
        title: "Bug in new feature implementation",
        body: "This feature has a bug that needs fixing",
        labels: [],
      };

      const matchingLabels = await (
        regexHandler as any
      ).findMatchingRegexLabels(threadData, "issue");

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

      const matchingLabels = await (
        regexHandler as any
      ).findMatchingRegexLabels(threadData, "issue");

      expect(matchingLabels).not.toContain("bug");
    });

    it("should handle case insensitive matching by default", async () => {
      const threadData = {
        number: 1,
        title: "Found a BUG in the application",
        body: "This FEATURE needs work",
        labels: [],
      };

      const matchingLabels = await (
        regexHandler as any
      ).findMatchingRegexLabels(threadData, "issue");

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

      const matchingLabels = await (
        regexHandler as any
      ).findMatchingRegexLabels(threadData, "issue");

      expect(matchingLabels).toHaveLength(0);
    });

    it("should handle threads without labels property (discussions)", async () => {
      const threadData = {
        number: 1,
        title: "Discussion about a bug",
        body: "Let's discuss this bug issue",
        // No labels property like discussions might have
      };

      const matchingLabels = await (
        regexHandler as any
      ).findMatchingRegexLabels(threadData, "discussion");

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

      const addLabelsSpy = jest.spyOn(
        (regexHandler as any).client.rest.issues,
        "addLabels",
      );

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

      const addLabelsSpy = jest.spyOn(
        (regexHandler as any).client.rest.issues,
        "addLabels",
      );

      await regexHandler.performRegexScanning(threadData, "issue");

      expect(addLabelsSpy).not.toHaveBeenCalled();
    });
  });
});
