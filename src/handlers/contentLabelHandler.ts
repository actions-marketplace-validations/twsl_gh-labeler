import * as core from "@actions/core";
import type { DiscussionEvent, IssuesEvent, PullRequestEvent } from "@octokit/webhooks-types";
import type Config from "@/models/internal/config";
import type ContentRule from "@/models/internal/config/contentRule";
import type GHActionConfig from "@/models/internal/ghActionConfig";
import type { ThreadType } from "@/types/common";
import { AbstractHandler } from "./baseHandler";

export class ContentLabelHandler extends AbstractHandler {
	getThreadType(): ThreadType {
		return this.threadType;
	}

	private threadType: ThreadType;

	constructor(config: Config, actionConfig: GHActionConfig, threadType: ThreadType) {
		super(config, actionConfig);
		this.threadType = threadType;
	}

	async performContentScanning(
		threadData: IssuesEvent["issue"] | PullRequestEvent["pull_request"] | DiscussionEvent["discussion"],
	): Promise<void> {
		const contentRules = await this.getContentRules();
		if (!contentRules || contentRules.length === 0) {
			core.debug("No content rules found");
			return;
		}

		const scanTitle = this.config.scanTitle !== false;
		const scanBody = this.config.scanBody !== false;

		const textToScan = [scanTitle ? threadData.title : "", scanBody ? threadData.body || "" : ""].join("\n");

		const currentLabels =
			"labels" in threadData && threadData.labels
				? threadData.labels
						.map((label: { name?: string | null }) => label.name)
						.filter((labelName): labelName is string => Boolean(labelName))
				: [];
		const labelsToAdd: string[] = [];

		for (const rule of contentRules) {
			const flags = rule.caseSensitive ? "g" : "gi";
			let regex: RegExp;

			try {
				regex = new RegExp(rule.pattern, flags);
			} catch (error) {
				core.warning(`Skipping invalid regex pattern "${rule.pattern}": ${error}`);
				continue;
			}

			if (regex.test(textToScan) && !currentLabels.includes(rule.label)) {
				labelsToAdd.push(rule.label);
			}
		}

		if (labelsToAdd.length > 0) {
			core.info(`Adding content-based labels: ${labelsToAdd.join(", ")}`);

			if (this.threadType === "discussion") {
				const labelQuery = `
					query($owner: String!, $name: String!, $labels: String!) {
						repository(owner: $owner, name: $name) {
							labels(first: 100, query: $labels) {
								nodes {
									id
									name
								}
							}
						}
					}
				`;

				const labelData = (await this.client.graphql(labelQuery, {
					owner: this.owner,
					name: this.repo,
					labels: labelsToAdd.join(" "),
				})) as {
					repository?: {
						labels?: {
							nodes?: Array<{ id: string; name: string }>;
						};
					};
				};

				const labelIds = (labelData.repository?.labels?.nodes || [])
					.filter((label) => labelsToAdd.includes(label.name))
					.map((label) => label.id);

				if (labelIds.length === 0) {
					core.warning(`No matching discussion labels were found for: ${labelsToAdd.join(", ")}`);
					return;
				}

				const mutation = `
					mutation($discussionId: ID!, $labelIds: [ID!]!) {
						addLabelsToLabelable(input: {labelableId: $discussionId, labelIds: $labelIds}) {
							labelable {
								... on Discussion {
									id
								}
							}
						}
					}
				`;

				await this.client.graphql(mutation, {
					discussionId: threadData.node_id,
					labelIds,
				});
				return;
			}

			await this.client.rest.issues.addLabels({
				owner: this.owner,
				repo: this.repo,
				issue_number: threadData.number,
				labels: labelsToAdd,
			});
		}
	}

	private async getContentRules(): Promise<ContentRule[]> {
		const regexConfig = this.config.regex || {};

		// Convert regex patterns to content rules
		const contentRules: ContentRule[] = [];

		for (const [pattern, actions] of Object.entries(regexConfig)) {
			// Check if actions has labels with add property
			if (actions && typeof actions === "object" && "labels" in actions) {
				const labelsConfig = (actions as any).labels;
				if (labelsConfig && typeof labelsConfig === "object" && "add" in labelsConfig) {
					const labelsToAdd = labelsConfig.add;
					const caseSensitive = (actions as any).caseSensitive || false;
					if (Array.isArray(labelsToAdd) && labelsToAdd.length > 0) {
						// Create a rule for each label to add
						for (const label of labelsToAdd) {
							contentRules.push({
								pattern,
								label: label as string,
								caseSensitive,
							});
						}
					}
				}
			}
		}

		return contentRules;
	}

	// This method is required by the abstract class but not used
	// for content scanning operations
	async performActions(
		_payload: any,
		threadData: IssuesEvent["issue"] | PullRequestEvent["pull_request"] | DiscussionEvent["discussion"],
	): Promise<void> {
		await this.performContentScanning(threadData);
	}
}
