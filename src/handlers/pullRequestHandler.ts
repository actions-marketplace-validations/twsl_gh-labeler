import * as core from "@actions/core";
import * as github from "@actions/github";
import _ from "lodash";
import { AbstractHandler } from "./baseHandler";
import type Issue from "@/models/issue";
import type ThreadData from "@/models/threadData";
import type LockInfo from "@/models/lockInfo";

export class PullRequestHandler extends AbstractHandler {
	getThreadType(): "issue" | "pr" | "discussion" {
		return "pr";
	}

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	async performActions(payload: any, threadData: ThreadData): Promise<void> {
		const actions = await this.getLabelActions(
			payload.label.name,
			payload.action,
			this.getThreadType(),
		);

		if (!actions) {
			core.debug("No actions found for pull request");
			return;
		}

		const issue: Issue = {
			owner: this.owner,
			repo: this.repo,
			issue_number: threadData.number,
		};

		if (actions.comment) {
			core.debug("Commenting on PR");
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
				core.debug("Labeling PR");
				await this.client.rest.issues.addLabels({
					...issue,
					labels: newLabels,
				});
			}
		}

		if (actions.reviewers && actions.reviewers.length > 0) {
			core.debug("Assigning reviewers to PR");
			const author = threadData.user.login;
			let reviewers = _.without(actions.reviewers, author);
			reviewers = _.sampleSize(
				reviewers,
				actions["number-of-reviewers"] || reviewers.length,
			);
			await this.addReviewers(reviewers, threadData.number);
		}

		if (actions.unlabel) {
			const currentLabels = threadData.labels.map((label) => label.name);
			const removedLabels = _.intersection(currentLabels, actions.unlabel);

			for (const label of removedLabels) {
				core.debug("Unlabeling PR");
				await this.client.rest.issues.removeLabel({
					...issue,
					name: label,
				});
			}
		}

		if (actions.reopen && threadData.state === "closed" && !threadData.merged) {
			core.debug("Reopening PR");
			await this.client.rest.issues.update({ ...issue, state: "open" });
		}

		if (actions.close && threadData.state === "open") {
			core.debug("Closing PR");
			await this.client.rest.issues.update({ ...issue, state: "closed" });
		}

		if (actions.lock && !threadData.locked) {
			core.debug("Locking PR");
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
			core.debug("Unlocking PR");
			await this.client.rest.issues.unlock(issue);
		}
	}

	private async addReviewers(
		reviewers: string[],
		pullNumber: number,
	): Promise<void> {
		if (reviewers.length === 0) return;

		await this.client.rest.pulls.requestReviewers({
			owner: this.owner,
			repo: this.repo,
			pull_number: pullNumber,
			reviewers,
		});
	}
}
