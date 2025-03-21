import * as core from "@actions/core";
import * as github from "@actions/github";
import * as yaml from "js-yaml";
import _ from "lodash";

import ActionValidator from "@/validators/action";
import type Config from "@/models/config";
import type ThreadData from "@/models/threadData";
import type Issue from "@/models/issue";
import type LockInfo from "@/models/lockInfo";
import type Actions from "@/models/actions";

class App {
	private config: Config;
	private client: ReturnType<typeof github.getOctokit>;
	private owner: string;
	private repo: string;

	constructor(config: Config) {
		this.config = config;
		this.client = github.getOctokit(config["github-token"]);
		this.owner = github.context.repo.owner;
		this.repo = github.context.repo.repo;
	}

	async performActions(): Promise<void> {
		const payload = github.context.payload as any; // Payload needs dynamic typing
		const threadType: "issue" | "pr" = payload.issue ? "issue" : "pr";
		const processOnly = this.config["process-only"];

		if (processOnly && processOnly !== threadType) {
			return;
		}

		const actions = await this.getLabelActions(
			payload.label.name,
			payload.action,
			threadType,
		);

		if (!actions) {
			core.debug("No actions found");
			return;
		}

		const threadData = (payload.issue || payload.pull_request) as ThreadData;
		const issue: Issue = {
			owner: this.owner,
			repo: this.repo,
			issue_number: threadData.number,
		};

		if (actions.comment) {
			core.debug("Commenting");
			const lock: LockInfo = {
				active: threadData.locked,
				reason: threadData.active_lock_reason || null,
			};

			await this.ensureUnlock(issue, lock, async () => {
				for (let commentBody of actions.comment!) {
					commentBody = commentBody.replace(
						/{issue-author}/,
						threadData.user.login,
					);

					await this.client.rest.issues.createComment({
						...issue,
						body: commentBody,
					});
				}
			});
		}

		if (actions.label) {
			const currentLabels = threadData.labels.map((label) => label.name);
			const newLabels = _.difference(actions.label, currentLabels);

			if (newLabels.length) {
				core.debug("Labeling");
				await this.client.rest.issues.addLabels({
					...issue,
					labels: newLabels,
				});
			}
		}

		if (actions.reviewers && actions.reviewers.length > 0) {
			core.debug("Assigning reviewers");
			const author = threadData.user.login;
			let reviewers = _.without(actions.reviewers, author);
			reviewers = _.sampleSize(reviewers, actions["number-of-reviewers"] || 0);
			await this.addReviewers(reviewers);
		}

		if (actions.unlabel) {
			const currentLabels = threadData.labels.map((label) => label.name);
			const removedLabels = _.intersection(currentLabels, actions.unlabel);

			for (const label of removedLabels) {
				core.debug("Unlabeling");
				await this.client.rest.issues.removeLabel({
					...issue,
					name: label,
				});
			}
		}

		if (actions.reopen && threadData.state === "closed" && !threadData.merged) {
			core.debug("Reopening");
			await this.client.rest.issues.update({ ...issue, state: "open" });
		}

		if (actions.close && threadData.state === "open") {
			core.debug("Closing");
			await this.client.rest.issues.update({ ...issue, state: "closed" });
		}

		if (actions.lock && !threadData.locked) {
			core.debug("Locking");
			const params: Issue = { ...issue };
			const lockReason = actions["lock-reason"];
			if (lockReason) {
				Object.assign(params, {
					lock_reason: lockReason,
					headers: {
						Accept: "application/vnd.github.sailor-v-preview+json",
					},
				});
			}
			await this.client.rest.issues.lock(params);
		}

		if (actions.unlock && threadData.locked) {
			core.debug("Unlocking");
			await this.client.rest.issues.unlock(issue);
		}
	}

	private async getLabelActions(
		label: string,
		event: string,
		threadType: "issue" | "pr",
	): Promise<Actions | undefined> {
		if (event === "unlabeled") {
			label = `-${label}`;
		}
		const threadKey = threadType === "issue" ? "issues" : "prs";

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

	private async getActionConfig(): Promise<Record<string, any>> {
		const configData = await this.getContent();
		const input = yaml.load(Buffer.from(configData, "base64").toString());
		if (!input) {
			throw new Error(`Empty configuration file (${this.configPath})`);
		}
		return ActionValidator.validate(input);
	}

	private async getContent(): Promise<string> {
		try {
			const response = await this.client.rest.repos.getContent({
				...github.context.repo,
				path: this.configPath,
			});
			return response.data.content as string;
		} catch (err: any) {
			throw err.status === 404
				? new Error(`Missing configuration file (${this.configPath})`)
				: err;
		}
	}

	private async ensureUnlock(
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

	private async addReviewers(reviewers: string[]): Promise<void> {
		await this.client.rest.pulls.requestReviewers({
			owner: this.owner,
			repo: this.repo,
			pull_number: github.context.issue.number,
			reviewers,
		});
	}

	private get configPath(): string {
		return this.config["config-path"];
	}
}

export default App;
