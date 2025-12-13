import * as core from "@actions/core";
import * as github from "@actions/github";
import * as fs from "node:fs"; // Import fs for file operations
import { parse } from "yaml";
import { IssueHandler } from "@/handlers/issueHandler";
import { PullRequestHandler } from "@/handlers/pullRequestHandler";
import { DiscussionHandler } from "@/handlers/discussionHandler";
import { ContentLabelHandler } from "@/handlers/contentLabelHandler";
import { RegexHandler } from "@/handlers/regexHandler";
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
			let contentHandler: ContentLabelHandler;
			const regexHandler = new RegexHandler(config, actionConfig);
			let threadData:
				| IssuesEvent["issue"]
				| PullRequestEvent["pull_request"]
				| DiscussionEvent["discussion"];
			let threadType: "issue" | "pr" | "discussion";

			if ("issue" in payload && payload.issue) {
				contentHandler = new ContentLabelHandler(config, actionConfig, "issue");
				threadData = payload.issue;
				threadType = "issue";
			} else if ("pull_request" in payload && payload.pull_request) {
				contentHandler = new ContentLabelHandler(config, actionConfig, "pr");
				threadData = payload.pull_request;
				threadType = "pr";
			} else if ("discussion" in payload && payload.discussion) {
				contentHandler = new ContentLabelHandler(
					config,
					actionConfig,
					"discussion",
				);
				threadData = payload.discussion;
				threadType = "discussion";
			} else {
				core.info("No issue, pull request or discussion found in payload");
				return;
			}

			core.info(
				`Scanning content of ${contentHandler.getThreadType()} #${threadData.number}`,
			);

			// Perform content scanning using the ContentLabelHandler
			await contentHandler.performContentScanning(threadData);

			// Also perform regex-based scanning and actions
			core.info(
				`Processing regex rules for ${threadType} #${threadData.number}`,
			);
			await regexHandler.performRegexScanning(threadData, threadType);

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
				await handler.performActions(
					payload,
					threadData as IssuesEvent["issue"],
				);
			} else if ("pull_request" in payload && payload.pull_request) {
				handler = new PullRequestHandler(config, actionConfig);
				threadData = payload.pull_request;
				await handler.performActions(
					payload,
					threadData as PullRequestEvent["pull_request"],
				);
			} else if ("discussion" in payload && payload.discussion) {
				handler = new DiscussionHandler(config, actionConfig);
				threadData = payload.discussion;
				await handler.performActions(
					payload,
					threadData as DiscussionEvent["discussion"],
				);
			} else {
				core.info("No issue, pull request or discussion found in payload");
				return;
			}

			// Remove the generic call that was causing type issues
		}
	} catch (error) {
		if (error instanceof Error) core.setFailed(error.message);
	}
}
