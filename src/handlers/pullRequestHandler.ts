import * as core from "@actions/core";
import type { PullRequestEvent } from "@octokit/webhooks-types";
import _ from "lodash";
import { AbstractHandler } from "./baseHandler";
import type { ThreadType } from "@/types/common";
import type PRs from "@/models/internal/config/prs";

export class PullRequestHandler extends AbstractHandler {
	getThreadType(): ThreadType {
		return "pr";
	}

	async performActions(payload: any, threadData: PullRequestEvent["pull_request"]): Promise<void> {
		const actions = await this.getLabelActions(payload.label.name, payload.action, this.getThreadType());

		if (!actions) {
			core.debug("No actions found for pull request");
			return;
		}

		const prActions = actions as PRs;

		const issue = {
			owner: this.owner,
			repo: this.repo,
			issue_number: threadData.number,
		};

		// Handle comments
		if (prActions.comments && prActions.comments.length > 0) {
			core.debug("Commenting on PR");
			const lock = {
				active: threadData.locked || false,
				reason: threadData.active_lock_reason || null,
			};

			await this.ensureUnlock(issue as any, lock, async () => {
				for (const comment of prActions.comments || []) {
					const commentBody = comment.replace(/{issue-author}/g, threadData.user?.login || "unknown");

					await this.client.rest.issues.createComment({
						...issue,
						body: commentBody,
					});
				}
			});
		}

		// Handle labels - add
		if (prActions.labels?.add) {
			const labelsToAdd = Array.isArray(prActions.labels.add)
				? prActions.labels.add
				: Object.keys(prActions.labels.add);
			const currentLabels = threadData.labels?.map((label) => label.name) || [];
			const newLabels = _.difference(labelsToAdd, currentLabels);

			if (newLabels.length) {
				core.debug(`Adding labels to PR: ${newLabels.join(", ")}`);
				await this.client.rest.issues.addLabels({
					...issue,
					labels: newLabels,
				});
			}
		}

		// Handle labels - remove
		if (prActions.labels?.remove) {
			const labelsToRemove = Array.isArray(prActions.labels.remove)
				? prActions.labels.remove
				: Object.keys(prActions.labels.remove);
			const currentLabels = threadData.labels?.map((label) => label.name) || [];
			const removedLabels = _.intersection(currentLabels, labelsToRemove);

			for (const label of removedLabels) {
				core.debug(`Removing label from PR: ${label}`);
				await this.client.rest.issues.removeLabel({
					...issue,
					name: label,
				});
			}
		}

		// Handle reviewers - add
		if (prActions.reviewers?.add && prActions.reviewers.add.length > 0) {
			core.debug(`Adding reviewers to PR: ${prActions.reviewers.add.join(", ")}`);
			const author = threadData.user?.login || "";
			const reviewers = _.without(prActions.reviewers.add, author);

			if (reviewers.length > 0) {
				await this.addReviewers(reviewers, threadData.number);
			}
		}

		// Handle reviewers - remove
		if (prActions.reviewers?.remove && prActions.reviewers.remove.length > 0) {
			core.debug(`Removing reviewers from PR: ${prActions.reviewers.remove.join(", ")}`);
			await this.removeReviewers(prActions.reviewers.remove, threadData.number);
		}

		// Handle assignees - add
		if (prActions.assignees?.add && prActions.assignees.add.length > 0) {
			core.debug(`Adding assignees to PR: ${prActions.assignees.add.join(", ")}`);
			await this.client.rest.issues.addAssignees({
				...issue,
				assignees: prActions.assignees.add,
			});
		}

		// Handle assignees - remove
		if (prActions.assignees?.remove && prActions.assignees.remove.length > 0) {
			core.debug(`Removing assignees from PR: ${prActions.assignees.remove.join(", ")}`);
			await this.client.rest.issues.removeAssignees({
				...issue,
				assignees: prActions.assignees.remove,
			});
		}

		// Handle close
		if (prActions.close && threadData.state === "open") {
			core.debug("Closing PR");
			await this.client.rest.pulls.update({
				owner: this.owner,
				repo: this.repo,
				pull_number: threadData.number,
				state: "closed",
			});
		}

		// Handle lock
		if (prActions.lock && !threadData.locked) {
			core.debug("Locking PR");
			await this.client.rest.issues.lock(issue);
		}
	}

	private async addReviewers(reviewers: string[], pullNumber: number): Promise<void> {
		if (reviewers.length === 0) return;

		try {
			await this.client.rest.pulls.requestReviewers({
				owner: this.owner,
				repo: this.repo,
				pull_number: pullNumber,
				reviewers,
			});
		} catch (error) {
			core.warning(`Failed to add reviewers: ${error}`);
		}
	}

	private async removeReviewers(reviewers: string[], pullNumber: number): Promise<void> {
		if (reviewers.length === 0) return;

		try {
			await this.client.rest.pulls.removeRequestedReviewers({
				owner: this.owner,
				repo: this.repo,
				pull_number: pullNumber,
				reviewers,
			});
		} catch (error) {
			core.warning(`Failed to remove reviewers: ${error}`);
		}
	}
}
