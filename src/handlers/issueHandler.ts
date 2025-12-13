import * as core from "@actions/core";
import type { IssuesEvent } from "@octokit/webhooks-types";
import _ from "lodash";
import { AbstractHandler } from "./baseHandler";
import type { ThreadType } from "@/types/common";
import type Issues from "@/models/config/issues";

export class IssueHandler extends AbstractHandler {
	getThreadType(): ThreadType {
		return "issue";
	}

	async performActions(
		payload: any,
		threadData: IssuesEvent["issue"],
	): Promise<void> {
		const actions = await this.getLabelActions(
			payload.label.name,
			payload.action,
			this.getThreadType(),
		);

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
					const commentBody = comment.replace(
						/{issue-author}/g,
						threadData.user.login,
					);

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
			const currentLabels = threadData.labels.map((label) => label.name);
			const newLabels = _.difference(labelsToAdd, currentLabels);

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
			const currentLabels = threadData.labels.map((label) => label.name);
			const removedLabels = _.intersection(currentLabels, labelsToRemove);

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
			core.debug(
				`Adding assignees to issue: ${issueActions.assignees.add.join(", ")}`,
			);
			await this.client.rest.issues.addAssignees({
				...issue,
				assignees: issueActions.assignees.add,
			});
		}

		// Handle assignees - remove
		if (
			issueActions.assignees?.remove &&
			issueActions.assignees.remove.length > 0
		) {
			core.debug(
				`Removing assignees from issue: ${issueActions.assignees.remove.join(", ")}`,
			);
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

		// Handle lock
		if (issueActions.lock && !threadData.locked) {
			core.debug("Locking issue");
			await this.client.rest.issues.lock(issue);
		}

		// Handle pin
		if (issueActions.pin !== undefined) {
			if (issueActions.pin && !threadData.locked) {
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
					core.warning(`Failed to pin issue: ${error}`);
				}
			}
		}

		// Handle convert_to_discussion
		if (issueActions.convert_to_discussion) {
			core.debug("Converting issue to discussion");
			// Note: This requires GraphQL API and a category ID
			core.warning(
				"Issue to discussion conversion requires a category ID - not fully implemented",
			);
		}

		// Handle milestones - add
		if (issueActions.milestones?.add && issueActions.milestones.add.length > 0) {
			core.debug("Adding milestone to issue");
			// GitHub API only supports one milestone per issue
			const milestoneTitle = issueActions.milestones.add[0];

			try {
				// First, get the milestone number by title
				const { data: milestones } =
					await this.client.rest.issues.listMilestones({
						owner: this.owner,
						repo: this.repo,
					});

				const milestone = milestones.find((m) => m.title === milestoneTitle);
				if (milestone) {
					await this.client.rest.issues.update({
						...issue,
						milestone: milestone.number,
					});
				} else {
					core.warning(`Milestone "${milestoneTitle}" not found`);
				}
			} catch (error) {
				core.warning(`Failed to add milestone: ${error}`);
			}
		}

		// Handle milestones - remove
		if (
			issueActions.milestones?.remove &&
			issueActions.milestones.remove.length > 0
		) {
			core.debug("Removing milestone from issue");
			await this.client.rest.issues.update({
				...issue,
				milestone: null as any,
			});
		}

		// Handle projects - add/remove would require GraphQL API (ProjectsV2)
		if (issueActions.projects?.add || issueActions.projects?.remove) {
			core.debug(
				"Project management requires GraphQL API - not fully implemented",
			);
		}
	}
}
