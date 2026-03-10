/**
 * GitHub API Types
 *
 * Re-exports of GitHub webhook event types from @octokit/webhooks-types.
 * These represent the actual payloads received from GitHub webhooks.
 */

export type {
  IssuesEvent,
  PullRequestEvent,
  DiscussionEvent,
  IssuesLabeledEvent,
  PullRequestLabeledEvent,
  DiscussionLabeledEvent,
} from "@octokit/webhooks-types";

/**
 * Commonly used GitHub entities extracted from webhook events
 */
export type Issue = IssuesEvent["issue"];
export type PullRequest = PullRequestEvent["pull_request"];
export type Discussion = DiscussionEvent["discussion"];

/**
 * Union type for all thread data types from GitHub
 */
export type GitHubThreadData = Issue | PullRequest | Discussion;

import type {
  IssuesEvent,
  PullRequestEvent,
  DiscussionEvent,
} from "@octokit/webhooks-types";
