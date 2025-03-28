import * as core from "@actions/core";
import * as github from "@actions/github";

import type Config from "@/models/config";
import type ThreadData from "@/models/threadData";
import { IssueHandler } from "@/handlers/issueHandler";
import { PullRequestHandler } from "@/handlers/pullRequestHandler";
import { DiscussionHandler } from "@/handlers/discussionHandler";
import { BaseHandler } from "@/handlers/baseHandler";

class App {
	private config: Config;
	private handlers: Map<string, BaseHandler>;

	constructor(config: Config) {
		this.config = config;

		// Initialize handlers
		this.handlers = new Map();
		this.handlers.set("issue", new IssueHandler(config));
		this.handlers.set("pr", new PullRequestHandler(config));
		this.handlers.set("discussion", new DiscussionHandler(config));
	}

	async performActions(): Promise<void> {
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		const payload = github.context.payload as any; // Payload needs dynamic typing

		// Determine thread type
		let threadType: "issue" | "pr" | "discussion";
		if (payload.issue) {
			threadType = "issue";
		} else if (payload.pull_request) {
			threadType = "pr";
		} else if (payload.discussion) {
			threadType = "discussion";
		} else {
			core.debug("Unknown thread type, no actions performed");
			return;
		}

		// Check if we should process this type
		const process = this.config["process-only"];
		if (process && process !== threadType) {
			core.debug(`Skipping ${threadType} as process-only is set to ${process}`);
			return;
		}

		// Get the appropriate handler
		const handler = this.handlers.get(threadType);
		if (!handler) {
			core.debug(`No handler found for thread type: ${threadType}`);
			return;
		}

		// Get thread data and execute handler actions
		const threadData = (payload.issue ||
			payload.pull_request ||
			payload.discussion) as ThreadData;
		await handler.performActions(payload, threadData);
	}
}

export default App;
