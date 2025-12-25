import * as core from "@actions/core";
import type {
	IssuesEvent,
	PullRequestEvent,
	DiscussionEvent,
} from "@octokit/webhooks-types";
import { AbstractHandler } from "./baseHandler";
import type { ThreadType } from "@/types/common";

import type GHActionConfig from "@/models/ghActionConfig";

interface ContentRule {
	pattern: string;
	label: string;
	caseSensitive?: boolean;
}

export class ContentLabelHandler extends AbstractHandler {
	getThreadType(): ThreadType {
		return this.threadType;
	}

	private threadType: ThreadType;

	constructor(
		config: any,
		actionConfig: GHActionConfig,
		threadType: ThreadType,
	) {
		super(config, actionConfig);
		this.threadType = threadType;
	}

	async performContentScanning(
		threadData:
			| IssuesEvent["issue"]
			| PullRequestEvent["pull_request"]
			| DiscussionEvent["discussion"],
	): Promise<void> {
		const contentRules = await this.getContentRules();
		if (!contentRules || contentRules.length === 0) {
			core.debug("No content rules found");
			return;
		}

		const scanTitle = this.config["scan-title"] !== false;
		const scanBody = this.config["scan-body"] !== false;

		const textToScan = [
			scanTitle ? threadData.title : "",
			scanBody ? threadData.body || "" : "",
		].join("\n");

		const currentLabels = threadData.labels.map((label) => label.name);
		const labelsToAdd: string[] = [];

		for (const rule of contentRules) {
			const flags = rule.caseSensitive ? "g" : "gi";
			const regex = new RegExp(rule.pattern, flags);

			if (regex.test(textToScan) && !currentLabels.includes(rule.label)) {
				labelsToAdd.push(rule.label);
			}
		}

		if (labelsToAdd.length > 0) {
			core.info(`Adding content-based labels: ${labelsToAdd.join(", ")}`);

			const issueParams = {
				owner: this.owner,
				repo: this.repo,
				issue_number: threadData.number,
			};

			await this.client.rest.issues.addLabels({
				...issueParams,
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
				if (
					labelsConfig &&
					typeof labelsConfig === "object" &&
					"add" in labelsConfig
				) {
					const labelsToAdd = labelsConfig.add;
					if (Array.isArray(labelsToAdd) && labelsToAdd.length > 0) {
						// Create a rule for each label to add
						for (const label of labelsToAdd) {
							contentRules.push({
								pattern,
								label: label as string,
								caseSensitive: false, // Default to case insensitive
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
		threadData:
			| IssuesEvent["issue"]
			| PullRequestEvent["pull_request"]
			| DiscussionEvent["discussion"],
	): Promise<void> {
		await this.performContentScanning(threadData);
	}
}
