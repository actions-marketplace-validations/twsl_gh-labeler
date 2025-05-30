import * as core from "@actions/core";
import type {
	IssuesEvent,
	PullRequestEvent,
	DiscussionEvent,
} from "@octokit/webhooks-types";
import _ from "lodash";
import { AbstractHandler } from "./baseHandler";
import type ContentRule from "@/models/config/contentRule";
import type Issue from "@/models/config/issue";
import type { ThreadType } from "@/types/common";

import type GHActionConfig from "@/models/ghActionConfig";

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

		const issue: Issue = {
			owner: this.owner,
			repo: this.repo,
			issue_number: threadData.number,
		};

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
			await this.client.rest.issues.addLabels({
				...issue,
				labels: labelsToAdd,
			});
		}
	}

	private async getContentRules(): Promise<ContentRule[]> {
		const actionConfig = await this.getActionConfig();
		const contentConfig = actionConfig["content-labeling"] || {};

		let rulesKey = "rules";
		if (this.threadType === "issue") rulesKey = "issues";
		else if (this.threadType === "pr") rulesKey = "prs";
		else if (this.threadType === "discussion") rulesKey = "discussions";

		return contentConfig[rulesKey] || [];
	}

	// This method is required by the abstract class but not used
	// for content scanning operations
	async performActions(
		payload: any,
		threadData:
			| IssuesEvent["issue"]
			| PullRequestEvent["pull_request"]
			| DiscussionEvent["discussion"],
	): Promise<void> {
		await this.performContentScanning(threadData);
	}
}
