/**
 * Internal Configuration Models
 *
 * These models represent the internal configuration structure for the gh-labeler action.
 * They define how users configure label automation, regex patterns, and actions.
 *
 * Key Models:
 * - Config: Main configuration structure loaded from .github/gh-labeler.yaml
 * - GHActionConfig: GitHub Action input parameters
 * - Actions: Configuration for automated actions (comments, labels, assignees, etc.)
 * - Labels: Label-based trigger configuration
 * - Regex: Regex pattern-based trigger configuration
 *
 * These are separate from GitHub API types (see models/github).
 * The internal config drives how the action responds to GitHub webhook events.
 */

export type { default as Config } from "@/models/internal/config";
export type { default as GHActionConfig } from "@/models/internal/ghActionConfig";
export type { default as Actions } from "@/models/internal/config/actions";
export type { default as Labels } from "@/models/internal/config/labels";
export type { default as Issues } from "@/models/internal/config/issues";
export type { default as PRs } from "@/models/internal/config/prs";
export type { default as Discussions } from "@/models/internal/config/discussions";
export type { default as Regex } from "@/models/internal/config/regex";
export type { default as Comments } from "@/models/internal/config/comments";
export type { default as Assignees } from "@/models/internal/config/assignees";
export type { default as Reviewers } from "@/models/internal/config/reviewers";
export type { default as Trigger } from "@/models/internal/config/trigger";
export type { default as ContentRule } from "@/models/internal/config/contentRule";
