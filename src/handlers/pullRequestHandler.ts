import * as core from "@actions/core";
import type { PullRequestEvent } from "@octokit/webhooks-types";
import { AbstractHandler } from "@/handlers/baseHandler";
import type PRs from "@/models/internal/config/prs";
import type { ThreadType } from "@/types/common";

type PullRequestReviewAction = "APPROVE" | "REQUEST_CHANGES";
type RequestedReviewer = PullRequestEvent["pull_request"]["requested_reviewers"][number];
type RequestedUserReviewer = RequestedReviewer & { login: string };

function isRequestedUserReviewer(reviewer: RequestedReviewer): reviewer is RequestedUserReviewer {
	return "login" in reviewer && typeof reviewer.login === "string";
}

function difference<T>(left: T[], right: T[]): T[] {
	return left.filter((item) => !right.includes(item));
}

function intersection<T>(left: T[], right: T[]): T[] {
	return left.filter((item) => right.includes(item));
}

function without<T>(items: T[], excluded: T): T[] {
	return items.filter((item) => item !== excluded);
}

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
			const newLabels = difference(labelsToAdd, currentLabels);

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
			const removedLabels = intersection(currentLabels, labelsToRemove);

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
			const reviewers = without(prActions.reviewers.add, author);

			if (reviewers.length > 0) {
				await this.addReviewers(reviewers, threadData.number);
			}
		}

		// Handle reviewers - remove
		if (prActions.reviewers?.remove && prActions.reviewers.remove.length > 0) {
			core.debug(`Removing reviewers from PR: ${prActions.reviewers.remove.join(", ")}`);
			await this.removeReviewers(
				this.resolveReviewersToRemove(prActions.reviewers.remove, threadData),
				threadData.number,
			);
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

		// Handle reopen
		if (prActions.reopen && threadData.state === "closed") {
			core.debug("Reopening PR");
			await this.client.rest.pulls.update({
				owner: this.owner,
				repo: this.repo,
				pull_number: threadData.number,
				state: "open",
			});
		}

		// Handle draft status
		if (prActions.draft !== undefined && prActions.draft !== threadData.draft) {
			core.debug(`Updating PR draft state to ${prActions.draft}`);
			await this.updateDraftState(threadData.node_id, prActions.draft);
		}

		// Handle review decisions
		if (prActions.request_changes) {
			await this.createReview(threadData.number, "REQUEST_CHANGES");
		}

		if (prActions.approve) {
			await this.createReview(threadData.number, "APPROVE");
		}

		// Handle lock
		if (prActions.lock && !threadData.locked) {
			core.debug("Locking PR");
			await this.client.rest.issues.lock(
				prActions.lock_reason ? { ...issue, lock_reason: prActions.lock_reason } : issue,
			);
		}

		// Handle unlock
		if (prActions.unlock && threadData.locked) {
			core.debug("Unlocking PR");
			await this.client.rest.issues.unlock(issue);
		}
	}

	private resolveReviewersToRemove(reviewers: string[], threadData: PullRequestEvent["pull_request"]): string[] {
		if (!reviewers.includes("allReviewers")) {
			return reviewers;
		}

		const requestedReviewers = (threadData.requested_reviewers || [])
			.filter(isRequestedUserReviewer)
			.map((reviewer) => reviewer.login);

		return [...new Set([...without(reviewers, "allReviewers"), ...requestedReviewers])];
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
			this.failAction("Failed to add reviewers", error);
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
			this.failAction("Failed to remove reviewers", error);
		}
	}

	private async createReview(pullNumber: number, event: PullRequestReviewAction): Promise<void> {
		try {
			await this.client.rest.pulls.createReview({
				owner: this.owner,
				repo: this.repo,
				pull_number: pullNumber,
				event,
			});
		} catch (error) {
			this.failAction(`Failed to create ${event.toLowerCase()} review`, error);
		}
	}

	private async updateDraftState(pullRequestId: string, draft: boolean): Promise<void> {
		const mutation = draft
			? `
				mutation($pullRequestId: ID!) {
					convertPullRequestToDraft(input: {pullRequestId: $pullRequestId}) {
						pullRequest {
							id
						}
					}
				}
			`
			: `
				mutation($pullRequestId: ID!) {
					markPullRequestReadyForReview(input: {pullRequestId: $pullRequestId}) {
						pullRequest {
							id
						}
					}
				}
			`;

		try {
			await this.client.graphql(mutation, { pullRequestId });
		} catch (error) {
			this.failAction(`Failed to update PR draft state to ${draft}`, error);
		}
	}
}
