import * as core from "@actions/core";
import * as github from "@actions/github";
import type {
  DiscussionEvent,
  IssuesEvent,
  PullRequestEvent,
} from "@octokit/webhooks-types";
import type Config from "@/models/internal/config";
import type Actions from "@/models/internal/config/actions";
import type GHActionConfig from "@/models/internal/ghActionConfig";
import type { ThreadType } from "@/types/common";

type HandlerPayload = IssuesEvent | PullRequestEvent | DiscussionEvent;

export class ActionFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionFailure";
  }
}

export interface BaseHandler {
  performActions(
    payload: HandlerPayload,
    threadData:
      | IssuesEvent["issue"]
      | PullRequestEvent["pull_request"]
      | DiscussionEvent["discussion"],
  ): Promise<void>;
}

export abstract class AbstractHandler implements BaseHandler {
  protected config: Config;
  protected actionConfig: GHActionConfig;
  protected client: ReturnType<typeof github.getOctokit>;
  protected owner: string;
  protected repo: string;

  constructor(config: Config, actionConfig: GHActionConfig) {
    this.config = config;
    this.actionConfig = actionConfig;
    this.client = github.getOctokit(actionConfig["github-token"]);
    this.owner = github.context.repo.owner;
    this.repo = github.context.repo.repo;
  }

  abstract getThreadType(): ThreadType;

  abstract performActions(
    payload: HandlerPayload,
    threadData:
      | IssuesEvent["issue"]
      | PullRequestEvent["pull_request"]
      | DiscussionEvent["discussion"],
  ): Promise<void>;

  protected async getLabelActions(
    label: string,
    event: string,
    threadType: ThreadType,
  ): Promise<Actions | undefined> {
    const labelName = event === "unlabeled" ? `-${label}` : label;
    const threadKey =
      threadType === "issue"
        ? "issues"
        : threadType === "pr"
          ? "prs"
          : "discussions";

    // Get the config which should have labels.add, labels.remove, and labels.default
    const labels = this.config.labels;
    if (!labels) {
      return undefined;
    }

    // Determine if we're adding or removing a label
    const isRemoval = labelName.startsWith("-");
    const cleanLabel = isRemoval ? labelName.substring(1) : labelName;

    // Get the appropriate label config
    let labelConfig: Actions | undefined;

    if (isRemoval && labels.remove) {
      // For label removal, check labels.remove
      if (typeof labels.remove === "object" && !Array.isArray(labels.remove)) {
        labelConfig = labels.remove[cleanLabel];
      }
    } else if (!isRemoval && labels.add) {
      // For label addition, check labels.add
      if (typeof labels.add === "object" && !Array.isArray(labels.add)) {
        labelConfig = labels.add[cleanLabel];
      }
    }

    // If no specific config found, check default
    if (!labelConfig && labels.default) {
      labelConfig = labels.default[cleanLabel];
      // Check for wildcard default if no specific default found
      if (!labelConfig && labels.default["*"]) {
        labelConfig = labels.default["*"];
      }
    }

    if (!labelConfig) {
      return undefined;
    }

    // Merge root-level actions with thread-specific actions
    // Thread-specific actions should override root-level ones
    const mergedConfig = JSON.parse(JSON.stringify(labelConfig)) as Actions;
    const threadActions = labelConfig[threadKey];
    const mergedConfigRecord = mergedConfig as Record<string, unknown>;

    if (threadActions) {
      for (const [key, value] of Object.entries(threadActions)) {
        const existingValue = mergedConfigRecord[key];

        if (
          value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          existingValue &&
          typeof existingValue === "object" &&
          !Array.isArray(existingValue)
        ) {
          mergedConfigRecord[key] = {
            ...existingValue,
            ...value,
          };
          continue;
        }

        mergedConfigRecord[key] = value;
      }
    }

    return mergedConfig;
  }

  protected async getActionConfig(): Promise<GHActionConfig> {
    return Promise.resolve(this.actionConfig as GHActionConfig);
  }

  protected async ensureUnlock(
    issue: { owner: string; repo: string; issue_number: number },
    lock: { active: boolean; reason?: string | null },
    action: () => Promise<void>,
  ): Promise<void> {
    if (lock.active) {
      if (!("reason" in lock)) {
        const { data: issueData } = await this.client.rest.issues.get({
          ...issue,
          headers: {
            Accept: "application/vnd.github.sailor-v-preview+json",
          },
        });
        lock.reason = issueData.active_lock_reason;
      }
      await this.client.rest.issues.unlock(issue);

      let actionError: any;
      try {
        await action();
      } catch (err) {
        actionError = err;
      }

      const lockParams = lock.reason
        ? {
            ...issue,
            lock_reason: lock.reason as
              | "resolved"
              | "off-topic"
              | "too heated"
              | "spam",
            headers: {
              Accept: "application/vnd.github.sailor-v-preview+json",
            },
          }
        : issue;
      await this.client.rest.issues.lock(lockParams);

      if (actionError) {
        throw actionError;
      }
    } else {
      await action();
    }
  }

  protected failAction(message: string, error?: unknown): never {
    const suffix = error
      ? `: ${error instanceof Error ? error.message : String(error)}`
      : "";
    const failure = new ActionFailure(`${message}${suffix}`);
    core.setFailed(failure.message);
    throw failure;
  }
}
