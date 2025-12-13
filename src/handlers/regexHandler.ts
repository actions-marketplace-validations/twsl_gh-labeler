import * as core from "@actions/core";
import type {
	IssuesEvent,
	PullRequestEvent,
	DiscussionEvent,
} from "@octokit/webhooks-types";
import _ from "lodash";
import { AbstractHandler } from "@/handlers/baseHandler";
import { IssueHandler } from "@/handlers/issueHandler";
import { PullRequestHandler } from "@/handlers/pullRequestHandler";
import { DiscussionHandler } from "@/handlers/discussionHandler";
import type { ThreadType } from "@/types/common";
import type GHActionConfig from "@/models/ghActionConfig";
import type Config from "@/models/config";

export class RegexHandler extends AbstractHandler {
	private issueHandler: IssueHandler;
	private pullRequestHandler: PullRequestHandler;
	private discussionHandler: DiscussionHandler;

	constructor(config: Config, actionConfig: GHActionConfig) {
		super(config, actionConfig);
		this.issueHandler = new IssueHandler(config, actionConfig);
		this.pullRequestHandler = new PullRequestHandler(config, actionConfig);
		this.discussionHandler = new DiscussionHandler(config, actionConfig);
	}

	getThreadType(): ThreadType {
		// This handler works with all thread types
		return "issue"; // Default, but will be overridden by context
	}

	async performActions(
		payload: any,
		threadData:
			| IssuesEvent["issue"]
			| PullRequestEvent["pull_request"]
			| DiscussionEvent["discussion"],
	): Promise<void> {
		// Determine thread type from the payload
		let threadType: ThreadType;
		if ("issue" in payload && payload.issue) {
			threadType = "issue";
		} else if ("pull_request" in payload && payload.pull_request) {
			threadType = "pr";
		} else if ("discussion" in payload && payload.discussion) {
			threadType = "discussion";
		} else {
			core.debug("Unable to determine thread type from payload");
			return;
		}

		// Check if there are regex patterns that match the content
		const matchingLabels = await this.findMatchingRegexLabels(
			threadData,
			threadType,
		);

		if (matchingLabels.length === 0) {
			core.debug("No regex patterns matched the content");
			return;
		}

		// Process each matching label by delegating to the appropriate handler
		for (const label of matchingLabels) {
			core.info(`Processing regex-matched label: ${label}`);

			// Create a synthetic payload for the label action
			const syntheticPayload = {
				...payload,
				action: "labeled",
				label: { name: label },
			};

			// Delegate to the appropriate handler based on thread type
			try {
				switch (threadType) {
					case "issue":
						await this.issueHandler.performActions(
							syntheticPayload,
							threadData as IssuesEvent["issue"],
						);
						break;
					case "pr":
						await this.pullRequestHandler.performActions(
							syntheticPayload,
							threadData as PullRequestEvent["pull_request"],
						);
						break;
					case "discussion":
						await this.discussionHandler.performActions(
							syntheticPayload,
							threadData as DiscussionEvent["discussion"],
						);
						break;
					default:
						core.warning(`Unknown thread type: ${threadType}`);
				}
			} catch (error) {
				core.error(`Error processing regex-matched label ${label}: ${error}`);
			}
		}
	}

	private async findMatchingRegexLabels(
		threadData:
			| IssuesEvent["issue"]
			| PullRequestEvent["pull_request"]
			| DiscussionEvent["discussion"],
		threadType: ThreadType,
	): Promise<string[]> {
		const regexConfig = this.config.regex;
		if (!regexConfig || Object.keys(regexConfig).length === 0) {
			core.debug("No regex configuration found");
			return [];
		}

		const scanTitle = (this.config as any)["scan-title"] !== false;
		const scanBody = (this.config as any)["scan-body"] !== false;

		const textToScan = [
			scanTitle ? threadData.title : "",
			scanBody ? threadData.body || "" : "",
		].join("\n");

		// Handle labels property - discussions might not have labels
		const currentLabels =
			"labels" in threadData && threadData.labels
				? threadData.labels.map((label: any) => label.name)
				: [];
		const matchingLabels: string[] = [];

		// Check each regex pattern
		for (const [pattern, actions] of Object.entries(regexConfig)) {
			if (!actions || typeof actions !== "object") {
				continue;
			} // Create regex with case sensitivity option
			const caseSensitive = (this.config as any).caseSensitive || false;
			const flags = caseSensitive ? "g" : "gi";
			const regex = new RegExp(pattern, flags);

			if (regex.test(textToScan)) {
				core.debug(`Regex pattern "${pattern}" matched content`);

				// Check if this action applies to the current thread type
				const threadKey =
					threadType === "issue"
						? "issues"
						: threadType === "pr"
							? "prs"
							: "discussions";
				const threadSpecificActions = (actions as any)[threadKey];

				// Use thread-specific actions if available, otherwise use general actions
				const applicableActions = threadSpecificActions || actions;

				if (applicableActions && typeof applicableActions === "object") {
					// Check if there are labels to add
					if ("labels" in applicableActions) {
						const labelsConfig = (applicableActions as any).labels;
						if (
							labelsConfig &&
							typeof labelsConfig === "object" &&
							"add" in labelsConfig
						) {
							const labelsToAdd = labelsConfig.add;
							if (Array.isArray(labelsToAdd)) {
								for (const label of labelsToAdd) {
									if (
										typeof label === "string" &&
										!currentLabels.includes(label)
									) {
										matchingLabels.push(label);
									}
								}
							}
						}
					}

					// If no specific labels config, treat the pattern name as a potential label
					// This allows for backward compatibility with simple regex configs
					if (
						!("labels" in applicableActions) &&
						!currentLabels.includes(pattern)
					) {
						matchingLabels.push(pattern);
					}
				}
			}
		}

		return [...new Set(matchingLabels)]; // Remove duplicates
	}

	/**
	 * Scan content and add labels based on regex patterns
	 * This method provides an alternative interface similar to ContentLabelHandler
	 */
	async performRegexScanning(
		threadData:
			| IssuesEvent["issue"]
			| PullRequestEvent["pull_request"]
			| DiscussionEvent["discussion"],
		threadType: ThreadType,
	): Promise<void> {
		const matchingLabels = await this.findMatchingRegexLabels(
			threadData,
			threadType,
		);

		if (matchingLabels.length > 0) {
			core.info(`Adding regex-based labels: ${matchingLabels.join(", ")}`);

			const issue = {
				owner: this.owner,
				repo: this.repo,
				issue_number: threadData.number,
			};

			await this.client.rest.issues.addLabels({
				...issue,
				labels: matchingLabels,
			});
		}
	}
}
