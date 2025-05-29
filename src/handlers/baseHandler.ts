import * as github from "@actions/github";
import type Config from "@/models/config";
import type Issue from "@/models/config/issues";
import type LockInfo from "@/models/lockInfo";
import type Actions from "@/models/config/actions";
import type ThreadData from "@/models/threadData";

import * as yaml from "js-yaml";
import _ from "lodash";
import actionSchema from "@/schemas/action";

export interface BaseHandler {
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	performActions(payload: any, threadData: ThreadData): Promise<void>;
}

export abstract class AbstractHandler implements BaseHandler {
	protected config: Config;
	protected client: ReturnType<typeof github.getOctokit>;
	protected owner: string;
	protected repo: string;

	constructor(config: Config) {
		this.config = config;
		this.client = github.getOctokit(config["github-token"]);
		this.owner = github.context.repo.owner;
		this.repo = github.context.repo.repo;
	}

	abstract getThreadType(): "issue" | "pr" | "discussion";

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	abstract performActions(payload: any, threadData: ThreadData): Promise<void>;

	protected async getLabelActions(
		label: string,
		event: string,
		threadType: "issue" | "pr" | "discussion",
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

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	protected async getActionConfig(): Promise<Record<string, any>> {
		const configData = await this.getContent();
		const input = yaml.load(Buffer.from(configData, "base64").toString());
		if (!input) {
			throw new Error(`Empty configuration file (${this.configPath})`);
		}
		return actionSchema.validate(input);
	}

	protected async getContent(): Promise<string> {
		try {
			const response = await this.client.rest.repos.getContent({
				...github.context.repo,
				path: this.configPath,
			});
			return response.data.content as string;
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} catch (err: any) {
			throw err.status === 404
				? new Error(`Missing configuration file (${this.configPath})`)
				: err;
		}
	}

	protected async ensureUnlock(
		issue: Issue,
		lock: LockInfo,
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

	protected get configPath(): string {
		return this.config["config-path"];
	}
}
