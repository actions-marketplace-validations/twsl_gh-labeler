/**
 * Model Exports
 *
 * This module provides a clear separation between:
 *
 * 1. GitHub API Models (models/github):
 *    - Types from GitHub webhook events (@octokit/webhooks-types)
 *    - Represents data structures received from GitHub
 *    - Examples: IssuesEvent, PullRequestEvent, Issue, PullRequest
 *
 * 2. Internal Configuration Models (models/internal):
 *    - User-defined configuration structure (.github/gh-labeler.yaml)
 *    - Defines automation rules and actions
 *    - Examples: Config, Labels, Regex, Actions
 *
 * Import examples:
 *
 * // GitHub API types
 * import type { IssuesEvent, Issue } from "@/models/github";
 *
 * // Internal config types
 * import type { Config, Actions } from "@/models/internal";
 */

// GitHub API types
export * from "@/models/github";

// Internal configuration types
export * from "@/models/internal";
