import * as github from "@actions/github";
import type { WebhookPayload } from "@actions/github/lib/interfaces";
import type {
	IssuesEvent,
	PullRequestEvent,
	DiscussionEvent,
} from "@octokit/webhooks-types";
import type Config from "@/models/config";
import type GHActionConfig from "@/models/ghActionConfig";
import type Issue from "@/models/config/issues";
import type Actions from "@/models/config/actions";
import type { ThreadType } from "@/types/common";
import { parse } from "yaml";
import _ from "lodash";
import actionSchema from "@/schemas/action";

export interface BaseHandler {
	performActions(
		payload: WebhookPayload,
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
		payload: WebhookPayload,
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
		if (event === "unlabeled") {
			label = `-${label}`;
		}
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
		const isRemoval = label.startsWith("-");
		const cleanLabel = isRemoval ? label.substring(1) : label;
		
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
		}

		if (!labelConfig) {
			return undefined;
		}

		// Merge root-level actions with thread-specific actions
		// Thread-specific actions should override root-level ones
		const mergedConfig = { ...labelConfig };
		const threadActions = labelConfig[threadKey];
		
		if (threadActions) {
			// Deep merge thread-specific actions
			Object.assign(mergedConfig, threadActions);
		}

		return mergedConfig;
	}

	protected async getActionConfig(): Promise<GHActionConfig> {
		return Promise.resolve(this.actionConfig as GHActionConfig);
	}

	protected async ensureUnlock(
		issue: Issue,
		lock: { active: boolean; reason?: string | null },
		action: () => Promise<void>,
	): Promise<void> {
		if (lock.active) {
			if (!lock.hasOwnProperty("reason")) {
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

			if (lock.reason) {
				issue = {
					...issue,
					lock_reason: lock.reason!,
					headers: {
						Accept: "application/vnd.github.sailor-v-preview+json",
					},
				};
			}
			await this.client.rest.issues.lock(issue);

			if (actionError) {
				throw actionError;
			}
		} else {
			await action();
		}
	}
}
