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

		const actionConfig = await this.getActionConfig();
		const action = actionConfig[label];
		if (action) {
			const threadActions = action[threadKey];
			if (threadActions) {
				Object.assign(action, threadActions);
			}
			return action;
		}
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
