import * as core from "@actions/core";
import * as github from "@actions/github";
import * as fs from "node:fs"; // Import fs for file operations
import { parse } from "yaml";
import { IssueHandler } from "@/handlers/issueHandler";
import { PullRequestHandler } from "@/handlers/pullRequestHandler";
import { DiscussionHandler } from "@/handlers/discussionHandler";
import { ContentLabelHandler } from "@/handlers/contentLabelHandler";
import type GHActionConfig from "@/models/ghActionConfig";
import ghActionConfigSchema from "@/schemas/ghActionConfig"; // Import the schema
import type Config from "@/models/config"; // Import type for the loaded configuration file
import type {
	DiscussionEvent,
	IssuesEvent,
	PullRequestEvent,
} from "@octokit/webhooks-types";

async function loadConfig(configPath: string): Promise<Config> {
	try {
		if (!fs.existsSync(configPath)) {
			core.setFailed(`Configuration file not found at path: ${configPath}`);
			return Promise.resolve({} as Config);
		}
		const configFileContent = fs.readFileSync(configPath, "utf8");
		return Promise.resolve(parse(configFileContent) as Config);
	} catch (e: unknown) {
		core.setFailed(
			`Failed to load or parse configuration file at ${configPath}: ${e}`,
		);
		return Promise.resolve({} as Config);
	}
}

export async function run(): Promise<void> {
	try {
		const processInput = core.getInput("process");
		const processArray = processInput
			? (processInput.split(/,|\n/).map((item) => item.trim()) as Array<
					"issue" | "pr" | "discussion"
				>)
			: undefined;

		const actionConfig: GHActionConfig = {
			"github-token": core.getInput("github-token"),
			"config-path": core.getInput("config-path"),
			process: processArray,
		};

		// Validate actionConfig against the schema
		const { error, value: validatedActionConfig } =
			ghActionConfigSchema.validate(actionConfig, { abortEarly: false });
		if (error) {
			const errorMessages = error.details
				.map((err) => `${err.path.join(".")}: ${err.message}`)
				.join("\n");
			core.setFailed(`Invalid action configuration:\n${errorMessages}`);
			return;
		}

		const config: Config = await loadConfig(
			validatedActionConfig["config-path"],
		);

		const context = github.context;
		const payload = context.payload as
			| IssuesEvent
			| PullRequestEvent
			| DiscussionEvent;

		// Handle content scanning for newly created or edited items
		if (
			["issue", "pull_request", "discussion"].some(
				(type) =>
					payload[type as keyof typeof payload] &&
					payload.action !== undefined &&
					["opened", "edited"].includes(payload.action),
			)
		) {
			let handler: ContentLabelHandler;
			let threadData:
				| IssuesEvent["issue"]
				| PullRequestEvent["pull_request"]
				| DiscussionEvent["discussion"];

			if ("issue" in payload && payload.issue) {
				handler = new ContentLabelHandler(config, actionConfig, "issue");
				threadData = payload.issue;
			} else if ("pull_request" in payload && payload.pull_request) {
				handler = new ContentLabelHandler(config, actionConfig, "pr");
				threadData = payload.pull_request;
			} else if ("discussion" in payload && payload.discussion) {
				handler = new ContentLabelHandler(config, actionConfig, "discussion");
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
		if (
			"label" in payload &&
			payload.label &&
			payload.action &&
			["labeled", "unlabeled"].includes(payload.action)
		) {
			let handler: IssueHandler | PullRequestHandler | DiscussionHandler;
			let threadData:
				| IssuesEvent["issue"]
				| PullRequestEvent["pull_request"]
				| DiscussionEvent["discussion"];

			if ("issue" in payload && payload.issue) {
				handler = new IssueHandler(config, actionConfig);
				threadData = payload.issue;
			} else if ("pull_request" in payload && payload.pull_request) {
				handler = new PullRequestHandler(config, actionConfig);
				threadData = payload.pull_request;
			} else if ("discussion" in payload && payload.discussion) {
				handler = new DiscussionHandler(config, actionConfig);
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
