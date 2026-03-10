import type {
  DiscussionEvent,
  IssuesEvent,
  PullRequestEvent,
} from "@octokit/webhooks-types";
import type Config from "../../src/models/internal/config";

export const createIssuePayload = (
  action: string,
  issueData?: Record<string, unknown>,
  labelData?: Record<string, unknown>,
): IssuesEvent =>
  ({
    action,
    issue: {
      number: 123,
      title: "Test Issue",
      body: "Test issue body",
      state: "open",
      labels: [],
      ...issueData,
    },
    label: labelData
      ? {
          name: "bug",
          color: "d73a4a",
          ...labelData,
        }
      : undefined,
  }) as unknown as IssuesEvent;

export const createPullRequestPayload = (
  action: string,
  prData?: Record<string, unknown>,
  labelData?: Record<string, unknown>,
): PullRequestEvent =>
  ({
    action,
    pull_request: {
      number: 456,
      title: "Test PR",
      body: "Test pull request body",
      state: "open",
      labels: [],
      ...prData,
    },
    label: labelData
      ? {
          name: "enhancement",
          color: "a2eeef",
          ...labelData,
        }
      : undefined,
  }) as unknown as PullRequestEvent;

export const createDiscussionPayload = (
  action: string,
  discussionData?: Record<string, unknown>,
  labelData?: Record<string, unknown>,
): DiscussionEvent =>
  ({
    action,
    discussion: {
      number: 789,
      title: "Test Discussion",
      body: "Test discussion body",
      ...discussionData,
    },
    label: labelData
      ? {
          name: "question",
          color: "d876e3",
          ...labelData,
        }
      : undefined,
  }) as unknown as DiscussionEvent;

export const sampleConfig: Config = {
  "scan-title": true,
  "scan-body": true,
  content: [
    {
      matches: ["bug", "error"],
      labels: ["bug"],
    },
    {
      matches: ["feature", "enhancement"],
      labels: ["enhancement"],
    },
  ],
  issues: {
    bug: {
      close: true,
      comment: "This is a bug issue",
    },
    enhancement: {
      assign: ["developer1"],
    },
  },
  pr: {
    "needs-review": {
      assign: ["reviewer1"],
      comment: "Please review this PR",
    },
  },
  discussions: {
    question: {
      comment: "Thanks for your question!",
    },
  },
};
