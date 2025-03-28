import * as core from "@actions/core";
import * as github from "@actions/github";
import { IssueHandler } from "./handlers/issueHandler";
import { PullRequestHandler } from "./handlers/pullRequestHandler";
import { DiscussionHandler } from "./handlers/discussionHandler";
import { ContentLabelHandler } from "./handlers/contentLabelHandler";
import type Config from "./models/ghConfig";

export async function run(): Promise<void> {
	try {
		const config: Config = {
			"github-token": core.getInput("github-token"),
			"config-path": core.getInput("config-path"),
		};

		const context = github.context;
		const payload = context.payload;

		// Handle content scanning for newly created or edited items
		if (
			["issues", "pull_request", "discussion"].some(
				(type) =>
					payload[type] && ["opened", "edited"].includes(payload.action),
			)
		) {
			let handler: ContentLabelHandler;
			let threadData;

			if (payload.issue) {
				handler = new ContentLabelHandler(config, "issue");
				threadData = payload.issue;
			} else if (payload.pull_request) {
				handler = new ContentLabelHandler(config, "pr");
				threadData = payload.pull_request;
			} else if (payload.discussion) {
				handler = new ContentLabelHandler(config, "discussion");
				threadData = payload.discussion;
			} else {
				core.info("No issue, pull request or discussion found in payload");
				return;
			}

			core.info(
				`Scanning content of ${handler.getThreadType()} #${threadData.number}`,
			);
			await handler.performContentScanning(threadData);
			return;
		}

		// Continue with existing label-based action handling
		if (payload.label && ["labeled", "unlabeled"].includes(payload.action)) {
			let handler;
			let threadData;

			if (payload.issue) {
				handler = new IssueHandler(config);
				threadData = payload.issue;
			} else if (payload.pull_request) {
				handler = new PullRequestHandler(config);
				threadData = payload.pull_request;
			} else if (payload.discussion) {
				handler = new DiscussionHandler(config);
				threadData = payload.discussion;
			} else {
				core.info("No issue, pull request or discussion found in payload");
				return;
			}

			core.info(`Processing ${handler.getThreadType()} #${threadData.number}`);
			await handler.performActions(payload, threadData);
		}
	} catch (error) {
		if (error instanceof Error) core.setFailed(error.message);
	}
}

run();
