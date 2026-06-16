import * as core from "@actions/core";
import type { IssuesEvent } from "@octokit/webhooks-types";
import { AbstractHandler } from "@/handlers/baseHandler";
import type Issues from "@/models/internal/config/issues";
import type { ThreadType } from "@/types/common";

function difference<T>(left: T[], right: T[]): T[] {
	return left.filter((item) => !right.includes(item));
}

function intersection<T>(left: T[], right: T[]): T[] {
	return left.filter((item) => right.includes(item));
}

export class IssueHandler extends AbstractHandler {
	getThreadType(): ThreadType {
		return "issue";
	}

	async performActions(payload: any, threadData: IssuesEvent["issue"]): Promise<void> {
		const actions = await this.getLabelActions(payload.label.name, payload.action, this.getThreadType());

		if (!actions) {
			core.debug("No actions found for issue");
			return;
		}

		const issueActions = actions as Issues;

		const issue = {
			owner: this.owner,
			repo: this.repo,
			issue_number: threadData.number,
		};

		// Handle comments
		if (issueActions.comments && issueActions.comments.length > 0) {
			core.debug("Commenting on issue");
			const lock = {
				active: threadData.locked || false,
				reason: threadData.active_lock_reason || null,
			};

			await this.ensureUnlock(issue as any, lock, async () => {
				for (const comment of issueActions.comments || []) {
					const commentBody = comment.replace(/{issue-author}/g, threadData.user?.login || "unknown");

					await this.client.rest.issues.createComment({
						...issue,
						body: commentBody,
					});
				}
			});
		}

		// Handle labels - add
		if (issueActions.labels?.add) {
			const labelsToAdd = Array.isArray(issueActions.labels.add)
				? issueActions.labels.add
				: Object.keys(issueActions.labels.add);
			const currentLabels = threadData.labels?.map((label) => label.name) || [];
			const newLabels = difference(labelsToAdd, currentLabels);

			if (newLabels.length) {
				core.debug(`Adding labels to issue: ${newLabels.join(", ")}`);
				await this.client.rest.issues.addLabels({
					...issue,
					labels: newLabels,
				});
			}
		}

		// Handle labels - remove
		if (issueActions.labels?.remove) {
			const labelsToRemove = Array.isArray(issueActions.labels.remove)
				? issueActions.labels.remove
				: Object.keys(issueActions.labels.remove);
			const currentLabels = threadData.labels?.map((label) => label.name) || [];
			const removedLabels = intersection(currentLabels, labelsToRemove);

			for (const label of removedLabels) {
				core.debug(`Removing label from issue: ${label}`);
				await this.client.rest.issues.removeLabel({
					...issue,
					name: label,
				});
			}
		}

		// Handle assignees - add
		if (issueActions.assignees?.add && issueActions.assignees.add.length > 0) {
			core.debug(`Adding assignees to issue: ${issueActions.assignees.add.join(", ")}`);
			await this.client.rest.issues.addAssignees({
				...issue,
				assignees: issueActions.assignees.add,
			});
		}

		// Handle assignees - remove
		if (issueActions.assignees?.remove && issueActions.assignees.remove.length > 0) {
			core.debug(`Removing assignees from issue: ${issueActions.assignees.remove.join(", ")}`);
			await this.client.rest.issues.removeAssignees({
				...issue,
				assignees: issueActions.assignees.remove,
			});
		}

		// Handle close
		if (issueActions.close && threadData.state === "open") {
			core.debug("Closing issue");
			const updateParams: any = {
				...issue,
				state: "closed" as const,
			};

			// Add close_reason if specified (state_reason API)
			if (issueActions.close_reason) {
				updateParams.state_reason = issueActions.close_reason;
			}

			await this.client.rest.issues.update(updateParams);
		}

		// Handle reopen
		if (issueActions.reopen && threadData.state === "closed") {
			core.debug("Reopening issue");
			await this.client.rest.issues.update({
				...issue,
				state: "open",
			});
		}

		// Handle lock
		if (issueActions.lock && !threadData.locked) {
			core.debug("Locking issue");
			await this.client.rest.issues.lock(
				issueActions.lock_reason ? { ...issue, lock_reason: issueActions.lock_reason } : issue,
			);
		}

		// Handle unlock
		if (issueActions.unlock && threadData.locked) {
			core.debug("Unlocking issue");
			await this.client.rest.issues.unlock(issue);
		}

		// Handle pin
		if (issueActions.pin !== undefined) {
			if (issueActions.pin) {
				core.debug("Pinning issue");
				// Note: Pinning requires GraphQL API
				try {
					const mutation = `
						mutation($issueId: ID!) {
							pinIssue(input: {issueId: $issueId}) {
								issue {
									id
								}
							}
						}
					`;
					await this.client.graphql(mutation, {
						issueId: threadData.node_id,
					});
				} catch (error) {
					this.failAction("Failed to pin issue", error);
				}
			}
		}

		// Handle unpin
		if (issueActions.unpin) {
			core.debug("Unpinning issue");
			try {
				const mutation = `
					mutation($issueId: ID!) {
						unpinIssue(input: {issueId: $issueId}) {
							issue {
								id
							}
						}
					}
				`;
				await this.client.graphql(mutation, {
					issueId: threadData.node_id,
				});
			} catch (error) {
				this.failAction("Failed to unpin issue", error);
			}
		}

		// Handle convert_to_discussion
		if (issueActions.convert_to_discussion) {
			core.warning("Skipping convert_to_discussion because discussion category IDs are not configurable yet");
		}

		// Handle milestones - add
		if (issueActions.milestones?.add && issueActions.milestones.add.length > 0) {
			core.debug("Adding milestone to issue");
			// GitHub API only supports one milestone per issue
			const milestoneTitle = issueActions.milestones.add[0];

			try {
				// First, get the milestone number by title
				const { data: milestones } = await this.client.rest.issues.listMilestones({
					owner: this.owner,
					repo: this.repo,
				});

				const milestone = milestones.find((m: { title: string; number: number }) => m.title === milestoneTitle);
				if (milestone) {
					await this.client.rest.issues.update({
						...issue,
						milestone: milestone.number,
					});
				} else {
					this.failAction(`Milestone "${milestoneTitle}" not found`);
				}
			} catch (error) {
				this.failAction("Failed to add milestone", error);
			}
		}

		// Handle milestones - remove
		if (issueActions.milestones?.remove && issueActions.milestones.remove.length > 0) {
			core.debug("Removing milestone from issue");
			await this.client.rest.issues.update({
				...issue,
				milestone: null as any,
			});
		}

		// Handle projects - add/remove would require GraphQL API (ProjectsV2)
		if (issueActions.projects?.add || issueActions.projects?.remove) {
			core.debug("Project management requires GraphQL API - not fully implemented");
		}
	}
}
