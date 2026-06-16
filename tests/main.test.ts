import type * as fsType from "node:fs";
import type * as coreType from "@actions/core";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

type ActionConfigInput = Record<string, unknown>;
type ValidationError = {
	details: Array<{
		path: Array<string | number>;
		message: string;
	}>;
};
type ValidationResult = {
	error: ValidationError | undefined;
	value: unknown;
};
type GetInputImplementation = (name: string, options?: coreType.InputOptions) => string;

const getInputMock = jest.fn((_name: string, _options?: coreType.InputOptions) => "");

const core = {
	debug: jest.fn((_message: string | Error) => undefined),
	error: jest.fn((_message: string | Error) => undefined),
	getInput: getInputMock,
	info: jest.fn((_message: string) => undefined),
	setFailed: jest.fn((_message: string | Error) => undefined),
	setOutput: jest.fn((_name: string, _value: unknown) => undefined),
	warning: jest.fn((_message: string | Error) => undefined),
};

const github = {
	context: {
		payload: {},
		repo: {
			owner: "test-owner",
			repo: "test-repo",
		},
		issue: {
			owner: "test-owner",
			repo: "test-repo",
			number: 123,
		},
	},
	getOctokit: jest.fn(),
};

const fs = {
	existsSync: jest.fn<typeof fsType.existsSync>(),
	readFileSync: jest.fn<typeof fsType.readFileSync>(),
};

const yaml = {
	parse: jest.fn(),
};

const mockContentLabelHandlerInstance = {
	getThreadType: jest.fn(),
	performActions: jest.fn(),
	performContentScanning: jest.fn(),
};

const mockIssueHandlerInstance = {
	getThreadType: jest.fn(),
	performActions: jest.fn(),
};

const mockPullRequestHandlerInstance = {
	getThreadType: jest.fn(),
	performActions: jest.fn(),
};

const mockDiscussionHandlerInstance = {
	getThreadType: jest.fn(),
	performActions: jest.fn(),
};

const ContentLabelHandler = jest.fn().mockImplementation(() => mockContentLabelHandlerInstance);
const IssueHandler = jest.fn().mockImplementation(() => mockIssueHandlerInstance);
const PullRequestHandler = jest.fn().mockImplementation(() => mockPullRequestHandlerInstance);
const DiscussionHandler = jest.fn().mockImplementation(() => mockDiscussionHandlerInstance);

const mockValidationSuccess = {
	error: undefined,
	value: {
		"github-token": "test-token",
		"config-path": "./example/config.yaml",
		process: ["issue", "pr", "discussion"],
	},
};

const mockValidationError = {
	error: {
		details: [
			{
				path: ["github-token"],
				message: "github-token is required",
			},
		],
	},
	value: undefined,
};

const mockSchemaValidate = jest.fn(
	(input: ActionConfigInput): ValidationResult => ({
		error: undefined,
		value: {
			...input,
			"config-path": input["config-path"] || ".github/gh-labeler.yaml",
			process: Array.isArray(input.process) && input.process.length > 0 ? input.process : ["issue", "pr", "discussion"],
		},
	}),
);

const validateMock = jest.fn((input: ActionConfigInput, _options?: { abortEarly?: boolean }) =>
	mockSchemaValidate(input),
);

const validation = {
	mockValidationSuccess,
	mockValidationError,
	mockSchemaValidate,
	default: {
		validate: validateMock,
	},
};

const mockRegexHandlerInstance = {
	performRegexScanning: jest.fn(),
};

const RegexHandler = jest.fn().mockImplementation(() => mockRegexHandlerInstance);

const mockGetInput = (implementation: GetInputImplementation) => {
	getInputMock.mockImplementation(implementation);
};

const mockValidateActionConfig = (implementation: (input: ActionConfigInput) => ValidationResult) => {
	validateMock.mockImplementation((input) => implementation(input));
};

// Mock all external dependencies BEFORE importing the main module
jest.unstable_mockModule("@actions/core", () => core);
jest.unstable_mockModule("@actions/github", () => github);
jest.unstable_mockModule("node:fs", () => fs);
jest.unstable_mockModule("yaml", () => yaml);
jest.unstable_mockModule("@/handlers/issueHandler", () => ({
	IssueHandler,
}));
jest.unstable_mockModule("@/handlers/pullRequestHandler", () => ({
	PullRequestHandler,
}));
jest.unstable_mockModule("@/handlers/discussionHandler", () => ({
	DiscussionHandler,
}));
jest.unstable_mockModule("@/handlers/contentLabelHandler", () => ({
	ContentLabelHandler,
}));
jest.unstable_mockModule("@/handlers/regexHandler", () => ({
	RegexHandler,
}));
jest.unstable_mockModule("@/schemas/ghActionConfig", () => validation);

// Import the main module AFTER setting up mocks
const { run } = await import("../src/main");

const handlers = {
	ContentLabelHandler,
	DiscussionHandler,
	IssueHandler,
	PullRequestHandler,
	mockContentLabelHandlerInstance,
	mockDiscussionHandlerInstance,
	mockIssueHandlerInstance,
	mockPullRequestHandlerInstance,
};

const setupDefaultMocks = () => {
	mockGetInput((name) => {
		switch (name) {
			case "github-token":
				return "test-token";
			default:
				return "";
		}
	});
	fs.existsSync.mockReturnValue(true);
	fs.readFileSync.mockReturnValue(JSON.stringify(sampleConfig));
	yaml.parse.mockReturnValue(sampleConfig);
	mockValidateActionConfig((input) => validation.mockSchemaValidate(input));

	mockContentLabelHandlerInstance.getThreadType.mockReturnValue("issue");
	mockIssueHandlerInstance.getThreadType.mockReturnValue("issue");
	mockPullRequestHandlerInstance.getThreadType.mockReturnValue("pull_request");
	mockDiscussionHandlerInstance.getThreadType.mockReturnValue("discussion");

	ContentLabelHandler.mockImplementation(() => mockContentLabelHandlerInstance);
	IssueHandler.mockImplementation(() => mockIssueHandlerInstance);
	PullRequestHandler.mockImplementation(() => mockPullRequestHandlerInstance);
	DiscussionHandler.mockImplementation(() => mockDiscussionHandlerInstance);
	RegexHandler.mockImplementation(() => mockRegexHandlerInstance);
};

const resetMocks = () => {
	jest.clearAllMocks();
};

const { sampleConfig, configWithContentRules } = await import("./fixtures/config");
const { createIssuePayload, createPullRequestPayload, createDiscussionPayload } = await import("./fixtures/payloads");
const { createComplexIssuePayload, createComplexPRPayload, createComplexDiscussionPayload } = await import(
	"./fixtures/complexPayloads"
);
const { configWithSpecialCharacters, largeConfig, configWithEmptyActions, configWithComplexActions } = await import(
	"./fixtures/configScenarios"
);
const { testInputConfigs } = await import("./fixtures/testHelpers");

describe("main.ts", () => {
	beforeEach(async () => {
		jest.clearAllMocks();
		await setupDefaultMocks();
	});

	afterEach(() => {
		resetMocks();
	});

	describe("run function", () => {
		describe("action configuration validation", () => {
			it("should validate action configuration with basic inputs", async () => {
				// Arrange
				mockGetInput((name) => {
					switch (name) {
						case "github-token":
							return "test-token";
						case "config-path":
							return "./example/config.yaml";
						case "process":
							return "";
						default:
							return "";
					}
				});

				validation.default.validate.mockReturnValue(validation.mockValidationSuccess);
				github.context.payload = {};

				// Act
				await run();

				// Assert
				expect(validation.default.validate).toHaveBeenCalledWith(
					{
						"github-token": "test-token",
						"config-path": "./example/config.yaml",
						process: undefined,
					},
					{ abortEarly: false },
				);
			});

			it("should validate action configuration with process input", async () => {
				// Arrange
				mockGetInput((name) => {
					switch (name) {
						case "github-token":
							return "test-token";
						case "config-path":
							return "./example/config.yaml";
						case "process":
							return "issues, pr, discussions";
						default:
							return "";
					}
				});

				validation.default.validate.mockReturnValue(validation.mockValidationSuccess);
				github.context.payload = {};

				// Act
				await run();

				// Assert
				expect(validation.default.validate).toHaveBeenCalledWith(
					{
						"github-token": "test-token",
						"config-path": "./example/config.yaml",
						process: ["issues", "pr", "discussions"],
					},
					{ abortEarly: false },
				);
			});

			it("should handle validation errors", async () => {
				// Arrange
				core.getInput.mockReturnValue("");
				validation.default.validate.mockReturnValueOnce(validation.mockValidationError as any);

				// Act
				await run();

				// Assert
				expect(core.setFailed).toHaveBeenCalledWith(
					"Invalid action configuration:\ngithub-token: github-token is required",
				);
			});

			it("should handle complex validation errors", async () => {
				// Arrange
				core.getInput.mockReturnValue("");
				const complexError = {
					error: {
						details: [
							{
								path: ["github-token"],
								message: "github-token is required",
							},
							{
								path: ["config-path"],
								message: "config-path must be a valid path",
							},
							{
								path: ["process", 0],
								message: "process[0] must be one of [issues, pr, discussions]",
							},
						],
					},
					value: undefined,
				};
				validation.default.validate.mockReturnValueOnce(complexError as any);
				await run();

				// Assert
				expect(core.setFailed).toHaveBeenCalledWith(
					"Invalid action configuration:\n" +
						"github-token: github-token is required\n" +
						"config-path: config-path must be a valid path\n" +
						"process.0: process[0] must be one of [issues, pr, discussions]",
				);
			});
		});

		describe("config loading", () => {
			beforeEach(() => {
				validation.default.validate.mockReturnValue(validation.mockValidationSuccess);
			});

			it("should load configuration file successfully", async () => {
				// Arrange
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockReturnValue(JSON.stringify(sampleConfig));
				github.context.payload = {};

				// Act
				await run();

				// Assert
				expect(fs.existsSync).toHaveBeenCalledWith("./example/config.yaml");
				expect(fs.readFileSync).toHaveBeenCalledWith("./example/config.yaml", "utf8");
			});

			it("should handle missing config file", async () => {
				// Arrange
				fs.existsSync.mockReturnValue(false);
				github.context.payload = {};

				// Act
				await run();

				// Assert
				expect(core.setFailed).toHaveBeenCalledWith("Configuration file not found at path: ./example/config.yaml");
			});

			it("should handle config file read errors", async () => {
				// Arrange
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockImplementation(() => {
					throw new Error("Permission denied");
				});
				github.context.payload = {};

				// Act
				await run();

				// Assert
				expect(core.setFailed).toHaveBeenCalledWith(
					"Failed to load or parse configuration file at ./example/config.yaml: Error: Permission denied",
				);
			});

			it("should handle invalid JSON in config file", async () => {
				// Arrange
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockReturnValue("invalid json content");
				(yaml.parse as jest.Mock).mockImplementation(() => {
					throw new Error("Invalid YAML format");
				});
				github.context.payload = {};

				// Act
				await run();

				// Assert
				expect(core.setFailed).toHaveBeenCalledWith(
					expect.stringContaining("Failed to load or parse configuration file at ./example/config.yaml:"),
				);
			});
		});

		describe("content scanning workflow", () => {
			beforeEach(() => {
				validation.default.validate.mockReturnValue(validation.mockValidationSuccess);
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockReturnValue(JSON.stringify(configWithContentRules));
				(yaml.parse as jest.Mock).mockReturnValue(configWithContentRules);
			});

			it("should handle issue opened event", async () => {
				// Arrange
				mockGetInput((name) => {
					switch (name) {
						case "github-token":
							return "test-token";
						case "config-path":
							return "./config.yaml";
						default:
							return "";
					}
				});
				const issuePayload = createIssuePayload("opened");
				github.context.payload = issuePayload;
				handlers.mockContentLabelHandlerInstance.getThreadType.mockReturnValue("issue");

				// Act
				await run();

				// Assert
				expect(handlers.ContentLabelHandler).toHaveBeenCalledWith(
					configWithContentRules,
					expect.objectContaining({ "github-token": "test-token" }),
					"issue",
				);
				expect(core.info).toHaveBeenCalledWith("Scanning content of issue #123");
				expect(handlers.mockContentLabelHandlerInstance.performContentScanning).toHaveBeenCalledWith(
					issuePayload.issue,
				);
			});

			it("should handle issue edited event", async () => {
				// Arrange
				const issuePayload = createIssuePayload("edited");
				github.context.payload = issuePayload;
				handlers.mockContentLabelHandlerInstance.getThreadType.mockReturnValue("issue");

				// Act
				await run();

				// Assert
				expect(handlers.ContentLabelHandler).toHaveBeenCalledWith(
					configWithContentRules,
					expect.objectContaining({ "github-token": "test-token" }),
					"issue",
				);
				expect(core.info).toHaveBeenCalledWith("Scanning content of issue #123");
				expect(handlers.mockContentLabelHandlerInstance.performContentScanning).toHaveBeenCalledWith(
					issuePayload.issue,
				);
			});

			it("should handle pull request opened event", async () => {
				// Arrange
				const prPayload = createPullRequestPayload("opened");
				github.context.payload = prPayload;
				handlers.mockContentLabelHandlerInstance.getThreadType.mockReturnValue("pull_request");

				// Act
				await run();

				// Assert
				expect(handlers.ContentLabelHandler).toHaveBeenCalledWith(
					configWithContentRules,
					expect.objectContaining({ "github-token": "test-token" }),
					"pr",
				);
				expect(core.info).toHaveBeenCalledWith("Scanning content of pull_request #456");
				expect(handlers.mockContentLabelHandlerInstance.performContentScanning).toHaveBeenCalledWith(
					prPayload.pull_request,
				);
			});

			it("should handle pull request edited event", async () => {
				// Arrange
				const prPayload = createPullRequestPayload("edited");
				github.context.payload = prPayload;
				handlers.mockContentLabelHandlerInstance.getThreadType.mockReturnValue("pull_request");

				// Act
				await run();

				// Assert
				expect(handlers.ContentLabelHandler).toHaveBeenCalledWith(
					configWithContentRules,
					expect.objectContaining({ "github-token": "test-token" }),
					"pr",
				);
				expect(handlers.mockContentLabelHandlerInstance.performContentScanning).toHaveBeenCalledWith(
					prPayload.pull_request,
				);
			});

			it("should handle discussion opened event", async () => {
				// Arrange
				const discussionPayload = createDiscussionPayload("opened");
				github.context.payload = discussionPayload;
				handlers.mockContentLabelHandlerInstance.getThreadType.mockReturnValue("discussion");

				// Act
				await run();

				// Assert
				expect(handlers.ContentLabelHandler).toHaveBeenCalledWith(
					configWithContentRules,
					expect.objectContaining({ "github-token": "test-token" }),
					"discussion",
				);
				expect(core.info).toHaveBeenCalledWith("Scanning content of discussion #789");
				expect(handlers.mockContentLabelHandlerInstance.performContentScanning).toHaveBeenCalledWith(
					discussionPayload.discussion,
				);
			});

			it("should handle missing thread data in content scanning", async () => {
				// Arrange
				github.context.payload = {
					action: "opened",
					// No issue, pull_request, or discussion
				};

				// Act
				await run();

				// Assert
				expect(core.info).toHaveBeenCalledWith("No issue, pull request or discussion found in payload");
				expect(handlers.ContentLabelHandler).not.toHaveBeenCalled();
			});

			it("should return when thread data disappears after content payload detection", async () => {
				const payload: Record<string, unknown> = { action: "opened" };
				Object.defineProperty(payload, "issue", {
					configurable: true,
					get: () => {
						delete payload.issue;
						return { number: 123 };
					},
				});
				github.context.payload = payload;

				await run();

				expect(handlers.ContentLabelHandler).not.toHaveBeenCalled();
				expect(mockRegexHandlerInstance.performRegexScanning).not.toHaveBeenCalled();
			});
		});

		describe("label-based action workflow", () => {
			beforeEach(() => {
				validation.default.validate.mockReturnValue(validation.mockValidationSuccess);
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockReturnValue(JSON.stringify(sampleConfig));
			});

			it("should handle issue labeled event", async () => {
				// Arrange
				const issuePayload = createIssuePayload("labeled", undefined, {
					name: "bug",
				});
				github.context.payload = issuePayload;
				handlers.mockIssueHandlerInstance.getThreadType.mockReturnValue("issue");

				// Act
				await run();

				// Assert
				expect(handlers.IssueHandler).toHaveBeenCalledWith(
					sampleConfig,
					expect.objectContaining({ "github-token": "test-token" }),
				);
				expect(core.info).toHaveBeenCalledWith("Processing issue #123");
				expect(handlers.mockIssueHandlerInstance.performActions).toHaveBeenCalledWith(issuePayload, issuePayload.issue);
			});

			it("should handle issue unlabeled event", async () => {
				// Arrange
				const issuePayload = createIssuePayload("unlabeled", undefined, {
					name: "bug",
				});
				github.context.payload = issuePayload;
				handlers.mockIssueHandlerInstance.getThreadType.mockReturnValue("issue");

				// Act
				await run();

				// Assert
				expect(handlers.IssueHandler).toHaveBeenCalledWith(
					sampleConfig,
					expect.objectContaining({ "github-token": "test-token" }),
				);
				expect(handlers.mockIssueHandlerInstance.performActions).toHaveBeenCalledWith(issuePayload, issuePayload.issue);
			});

			it("should handle pull request labeled event", async () => {
				// Arrange
				const prPayload = createPullRequestPayload("labeled", undefined, {
					name: "enhancement",
				});
				github.context.payload = prPayload;
				handlers.mockPullRequestHandlerInstance.getThreadType.mockReturnValue("pull_request");

				// Act
				await run();

				// Assert
				expect(handlers.PullRequestHandler).toHaveBeenCalledWith(
					sampleConfig,
					expect.objectContaining({ "github-token": "test-token" }),
				);
				expect(core.info).toHaveBeenCalledWith("Processing pull request #456");
				expect(handlers.mockPullRequestHandlerInstance.performActions).toHaveBeenCalledWith(
					prPayload,
					prPayload.pull_request,
				);
			});

			it("should handle pull request unlabeled event", async () => {
				// Arrange
				const prPayload = createPullRequestPayload("unlabeled", undefined, {
					name: "enhancement",
				});
				github.context.payload = prPayload;
				handlers.mockPullRequestHandlerInstance.getThreadType.mockReturnValue("pull_request");

				// Act
				await run();

				// Assert
				expect(handlers.PullRequestHandler).toHaveBeenCalledWith(
					sampleConfig,
					expect.objectContaining({ "github-token": "test-token" }),
				);
				expect(handlers.mockPullRequestHandlerInstance.performActions).toHaveBeenCalledWith(
					prPayload,
					prPayload.pull_request,
				);
			});

			it("should handle discussion labeled event", async () => {
				// Arrange
				const discussionPayload = createDiscussionPayload("labeled", undefined, {
					name: "question",
				});
				github.context.payload = discussionPayload;
				handlers.mockDiscussionHandlerInstance.getThreadType.mockReturnValue("discussion");

				// Act
				await run();

				// Assert
				expect(handlers.DiscussionHandler).toHaveBeenCalledWith(
					sampleConfig,
					expect.objectContaining({ "github-token": "test-token" }),
				);
				expect(core.info).toHaveBeenCalledWith("Processing discussion #789");
				expect(handlers.mockDiscussionHandlerInstance.performActions).toHaveBeenCalledWith(
					discussionPayload,
					discussionPayload.discussion,
				);
			});

			it("should handle missing thread data in label-based actions", async () => {
				// Arrange
				github.context.payload = {
					action: "labeled",
					label: { name: "bug" },
					// No issue, pull_request, or discussion
				};

				// Act
				await run();

				// Assert
				expect(core.info).toHaveBeenCalledWith("No issue, pull request or discussion found in payload");
				expect(handlers.IssueHandler).not.toHaveBeenCalled();
				expect(handlers.PullRequestHandler).not.toHaveBeenCalled();
				expect(handlers.DiscussionHandler).not.toHaveBeenCalled();
			});
		});

		describe("workflow priority and exclusion", () => {
			beforeEach(() => {
				validation.default.validate.mockReturnValue(validation.mockValidationSuccess);
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockReturnValue(JSON.stringify(configWithContentRules));
				(yaml.parse as jest.Mock).mockReturnValue(configWithContentRules);
			});

			it("should process content events when no process filter is configured", async () => {
				validation.default.validate.mockReturnValueOnce({
					error: undefined,
					value: {
						"github-token": "test-token",
						"config-path": "./example/config.yaml",
						process: undefined,
					},
				});
				const issuePayload = createIssuePayload("opened");
				github.context.payload = issuePayload;
				handlers.mockContentLabelHandlerInstance.getThreadType.mockReturnValue("issue");

				await run();

				expect(handlers.ContentLabelHandler).toHaveBeenCalledWith(
					configWithContentRules,
					expect.objectContaining({ process: undefined }),
					"issue",
				);
				expect(handlers.mockContentLabelHandlerInstance.performContentScanning).toHaveBeenCalledWith(
					issuePayload.issue,
				);
			});

			it("should skip issue content processing excluded by process input", async () => {
				validation.default.validate.mockReturnValueOnce({
					error: undefined,
					value: {
						"github-token": "test-token",
						"config-path": "./example/config.yaml",
						process: ["pr", "discussion"],
					},
				});
				github.context.payload = createIssuePayload("opened");

				await run();

				expect(core.info).toHaveBeenCalledWith(
					"Skipping issue content processing because it is excluded by the process input",
				);
				expect(handlers.ContentLabelHandler).not.toHaveBeenCalled();
			});

			it("should skip pull request content processing excluded by process input", async () => {
				validation.default.validate.mockReturnValueOnce({
					error: undefined,
					value: {
						"github-token": "test-token",
						"config-path": "./example/config.yaml",
						process: ["issue", "discussion"],
					},
				});
				github.context.payload = createPullRequestPayload("opened");

				await run();

				expect(core.info).toHaveBeenCalledWith(
					"Skipping pull request content processing because it is excluded by the process input",
				);
				expect(handlers.ContentLabelHandler).not.toHaveBeenCalled();
			});

			it("should skip discussion content processing excluded by process input", async () => {
				validation.default.validate.mockReturnValueOnce({
					error: undefined,
					value: {
						"github-token": "test-token",
						"config-path": "./example/config.yaml",
						process: ["issue", "pr"],
					},
				});
				github.context.payload = createDiscussionPayload("opened");

				await run();

				expect(core.info).toHaveBeenCalledWith(
					"Skipping discussion content processing because it is excluded by the process input",
				);
				expect(handlers.ContentLabelHandler).not.toHaveBeenCalled();
			});

			it("should skip issue label processing excluded by process input", async () => {
				validation.default.validate.mockReturnValueOnce({
					error: undefined,
					value: {
						"github-token": "test-token",
						"config-path": "./example/config.yaml",
						process: ["pr", "discussion"],
					},
				});
				github.context.payload = createIssuePayload("labeled", undefined, { name: "bug" });

				await run();

				expect(core.info).toHaveBeenCalledWith(
					"Skipping issue label processing because it is excluded by the process input",
				);
				expect(handlers.IssueHandler).not.toHaveBeenCalled();
			});

			it("should skip pull request label processing excluded by process input", async () => {
				validation.default.validate.mockReturnValueOnce({
					error: undefined,
					value: {
						"github-token": "test-token",
						"config-path": "./example/config.yaml",
						process: ["issue", "discussion"],
					},
				});
				github.context.payload = createPullRequestPayload("labeled", undefined, { name: "enhancement" });

				await run();

				expect(core.info).toHaveBeenCalledWith(
					"Skipping pull request label processing because it is excluded by the process input",
				);
				expect(handlers.PullRequestHandler).not.toHaveBeenCalled();
			});

			it("should skip discussion label processing excluded by process input", async () => {
				validation.default.validate.mockReturnValueOnce({
					error: undefined,
					value: {
						"github-token": "test-token",
						"config-path": "./example/config.yaml",
						process: ["issue", "pr"],
					},
				});
				github.context.payload = createDiscussionPayload("labeled", undefined, { name: "question" });

				await run();

				expect(core.info).toHaveBeenCalledWith(
					"Skipping discussion label processing because it is excluded by the process input",
				);
				expect(handlers.DiscussionHandler).not.toHaveBeenCalled();
			});

			it("should prioritize content scanning over label-based actions", async () => {
				// Arrange - payload that matches both content scanning and label-based actions
				const issuePayload = createIssuePayload("opened", undefined, {
					name: "bug",
				});
				// Add label to make it eligible for label-based actions too
				(issuePayload as { label?: { name: string } }).label = { name: "bug" };
				github.context.payload = issuePayload;
				handlers.mockContentLabelHandlerInstance.getThreadType.mockReturnValue("issue");

				// Act
				await run();

				// Assert
				expect(handlers.ContentLabelHandler).toHaveBeenCalledWith(
					configWithContentRules,
					expect.objectContaining({ "github-token": "test-token" }),
					"issue",
				);
				expect(handlers.mockContentLabelHandlerInstance.performContentScanning).toHaveBeenCalledWith(
					issuePayload.issue,
				);
				// Should not call label-based handler methods (IssueHandler is created by RegexHandler so constructor will be called)
				expect(handlers.mockIssueHandlerInstance.performActions).not.toHaveBeenCalled();
			});

			it("should skip both workflows for unsupported actions", async () => {
				// Arrange
				const issuePayload = createIssuePayload("closed");
				github.context.payload = issuePayload;

				// Act
				await run();

				// Assert
				expect(handlers.ContentLabelHandler).not.toHaveBeenCalled();
				expect(handlers.IssueHandler).not.toHaveBeenCalled();
				expect(handlers.PullRequestHandler).not.toHaveBeenCalled();
				expect(handlers.DiscussionHandler).not.toHaveBeenCalled();
			});
		});

		describe("error handling", () => {
			beforeEach(() => {
				validation.default.validate.mockReturnValue(validation.mockValidationSuccess);
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockReturnValue(JSON.stringify(sampleConfig));
			});

			it("should handle errors in content scanning", async () => {
				// Arrange
				const issuePayload = createIssuePayload("opened");
				github.context.payload = issuePayload;
				(handlers.mockContentLabelHandlerInstance.performContentScanning as jest.MockedFunction<any>).mockRejectedValue(
					new Error("Content scanning failed"),
				);

				// Act
				await run();

				// Assert
				expect(core.setFailed).toHaveBeenCalledWith("Content scanning failed");
			});

			it("should handle errors in label-based actions", async () => {
				// Arrange
				const issuePayload = createIssuePayload("labeled", undefined, {
					name: "bug",
				});
				github.context.payload = issuePayload;
				(handlers.mockIssueHandlerInstance.performActions as jest.MockedFunction<any>).mockRejectedValue(
					new Error("Action execution failed"),
				);

				// Act
				await run();

				// Assert
				expect(core.setFailed).toHaveBeenCalledWith("Action execution failed");
			});

			it("should handle handler instantiation errors", async () => {
				// Arrange
				const issuePayload = createIssuePayload("opened");
				github.context.payload = issuePayload;
				handlers.ContentLabelHandler.mockImplementation(() => {
					throw new Error("Handler instantiation failed");
				});

				// Act
				await run();

				// Assert
				expect(core.setFailed).toHaveBeenCalledWith("Handler instantiation failed");
			});

			it("should handle non-Error exceptions", async () => {
				// Arrange
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockReturnValue(JSON.stringify(sampleConfig));
				(yaml.parse as jest.Mock).mockReturnValue(sampleConfig);
				const issuePayload = createIssuePayload("opened");
				github.context.payload = issuePayload;
				handlers.mockContentLabelHandlerInstance.getThreadType.mockReturnValue("issue");
				(handlers.mockContentLabelHandlerInstance.performContentScanning as jest.MockedFunction<any>).mockRejectedValue(
					"String error",
				);

				// Act
				await run();

				// Assert
				// Should convert non-Error exceptions to strings and call setFailed
				expect(core.setFailed).toHaveBeenCalledWith("String error");
			});
		});

		describe("edge cases", () => {
			beforeEach(() => {
				validation.default.validate.mockReturnValue(validation.mockValidationSuccess);
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockReturnValue(JSON.stringify(sampleConfig));
			});

			it("should handle empty payload", async () => {
				// Arrange
				github.context.payload = {};

				// Act
				await run();

				// Assert
				expect(handlers.ContentLabelHandler).not.toHaveBeenCalled();
				expect(handlers.IssueHandler).not.toHaveBeenCalled();
				expect(handlers.PullRequestHandler).not.toHaveBeenCalled();
				expect(handlers.DiscussionHandler).not.toHaveBeenCalled();
			});

			it("should handle payload with action but no thread data", async () => {
				// Arrange
				github.context.payload = {
					action: "opened",
					// Missing issue/pull_request/discussion
				};

				// Act
				await run();

				// Assert
				expect(core.info).toHaveBeenCalledWith("No issue, pull request or discussion found in payload");
			});

			it("should handle label events without label data", async () => {
				// Arrange
				const issuePayload = createIssuePayload("labeled");
				const payloadWithoutLabel = { ...issuePayload };
				(payloadWithoutLabel as { label?: unknown }).label = undefined; // Remove label data
				github.context.payload = payloadWithoutLabel;

				// Act
				await run();

				// Assert
				expect(handlers.IssueHandler).not.toHaveBeenCalled();
			});

			it("should handle trimmed process input correctly", async () => {
				// Arrange
				mockGetInput((name) => {
					switch (name) {
						case "github-token":
							return "test-token";
						case "config-path":
							return "./example/config.yaml";
						case "process":
							return " issues , pr , discussions ";
						default:
							return "";
					}
				});

				validation.default.validate.mockReturnValue(validation.mockValidationSuccess);
				github.context.payload = {};

				// Act
				await run();

				// Assert
				expect(validation.default.validate).toHaveBeenCalledWith(
					{
						"github-token": "test-token",
						"config-path": "./example/config.yaml",
						process: ["issues", "pr", "discussions"],
					},
					{ abortEarly: false },
				);
			});
		});

		describe("advanced configuration scenarios", () => {
			beforeEach(() => {
				validation.default.validate.mockReturnValue(validation.mockValidationSuccess);
				fs.existsSync.mockReturnValue(true);
				(yaml.parse as jest.Mock).mockReturnValue(sampleConfig);
			});

			it("should handle config with special characters in labels", async () => {
				// Arrange
				fs.readFileSync.mockReturnValue(JSON.stringify(configWithSpecialCharacters));
				(yaml.parse as jest.Mock).mockReturnValue(configWithSpecialCharacters);
				const issuePayload = createIssuePayload("labeled", undefined, {
					name: "🐛-bug",
				});
				github.context.payload = issuePayload;
				handlers.mockIssueHandlerInstance.getThreadType.mockReturnValue("issue");

				// Act
				await run();

				// Assert
				expect(handlers.IssueHandler).toHaveBeenCalledWith(
					configWithSpecialCharacters,
					expect.objectContaining({ "github-token": "test-token" }),
				);
				expect(handlers.mockIssueHandlerInstance.performActions).toHaveBeenCalledWith(issuePayload, issuePayload.issue);
			});

			it("should handle large configuration files efficiently", async () => {
				// Arrange
				fs.readFileSync.mockReturnValue(JSON.stringify(largeConfig));
				(yaml.parse as jest.Mock).mockReturnValue(largeConfig);
				const issuePayload = createIssuePayload("labeled", undefined, {
					name: "label-500",
				});
				github.context.payload = issuePayload;
				handlers.mockIssueHandlerInstance.getThreadType.mockReturnValue("issue");

				// Act
				await run();

				// Assert
				expect(handlers.IssueHandler).toHaveBeenCalledWith(
					largeConfig,
					expect.objectContaining({ "github-token": "test-token" }),
				);
				expect(handlers.mockIssueHandlerInstance.performActions).toHaveBeenCalledWith(issuePayload, issuePayload.issue);
			});

			it("should handle config with empty actions", async () => {
				// Arrange
				fs.readFileSync.mockReturnValue(JSON.stringify(configWithEmptyActions));
				(yaml.parse as jest.Mock).mockReturnValue(configWithEmptyActions);
				const issuePayload = createIssuePayload("labeled", undefined, {
					name: "empty-action",
				});
				github.context.payload = issuePayload;
				handlers.mockIssueHandlerInstance.getThreadType.mockReturnValue("issue");

				// Act
				await run();

				// Assert
				expect(handlers.IssueHandler).toHaveBeenCalledWith(
					configWithEmptyActions,
					expect.objectContaining({ "github-token": "test-token" }),
				);
				expect(handlers.mockIssueHandlerInstance.performActions).toHaveBeenCalledWith(issuePayload, issuePayload.issue);
			});

			it("should handle config with complex multi-actions", async () => {
				// Arrange
				fs.readFileSync.mockReturnValue(JSON.stringify(configWithComplexActions));
				(yaml.parse as jest.Mock).mockReturnValue(configWithComplexActions);
				const issuePayload = createIssuePayload("labeled", undefined, {
					name: "multi-action",
				});
				github.context.payload = issuePayload;
				handlers.mockIssueHandlerInstance.getThreadType.mockReturnValue("issue");

				// Act
				await run();

				// Assert
				expect(handlers.IssueHandler).toHaveBeenCalledWith(
					configWithComplexActions,
					expect.objectContaining({ "github-token": "test-token" }),
				);
				expect(handlers.mockIssueHandlerInstance.performActions).toHaveBeenCalledWith(issuePayload, issuePayload.issue);
			});
		});

		describe("complex payload scenarios", () => {
			beforeEach(() => {
				validation.default.validate.mockReturnValue(validation.mockValidationSuccess);
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockReturnValue(JSON.stringify(sampleConfig));
				(yaml.parse as jest.Mock).mockReturnValue(sampleConfig);
			});

			it("should handle complex issue payloads with multiple labels", async () => {
				// Arrange
				const complexIssuePayload = createComplexIssuePayload("opened");
				github.context.payload = complexIssuePayload;
				handlers.mockContentLabelHandlerInstance.getThreadType.mockReturnValue("issue");

				// Act
				await run();

				// Assert
				expect(handlers.ContentLabelHandler).toHaveBeenCalledWith(
					sampleConfig,
					expect.objectContaining({ "github-token": "test-token" }),
					"issue",
				);
				expect(core.info).toHaveBeenCalledWith("Scanning content of issue #123");
				expect(handlers.mockContentLabelHandlerInstance.performContentScanning).toHaveBeenCalledWith(
					complexIssuePayload.issue,
				);
			});

			it("should handle complex PR payloads with reviewers and assignees", async () => {
				// Arrange
				const complexPRPayload = createComplexPRPayload("opened");
				github.context.payload = complexPRPayload;
				handlers.mockContentLabelHandlerInstance.getThreadType.mockReturnValue("pull_request");

				// Act
				await run();

				// Assert
				expect(handlers.ContentLabelHandler).toHaveBeenCalledWith(
					sampleConfig,
					expect.objectContaining({ "github-token": "test-token" }),
					"pr",
				);
				expect(core.info).toHaveBeenCalledWith("Scanning content of pull_request #456");
				expect(handlers.mockContentLabelHandlerInstance.performContentScanning).toHaveBeenCalledWith(
					complexPRPayload.pull_request,
				);
			});

			it("should handle complex discussion payloads with categories", async () => {
				// Arrange
				const complexDiscussionPayload = createComplexDiscussionPayload("opened");
				github.context.payload = complexDiscussionPayload;
				handlers.mockContentLabelHandlerInstance.getThreadType.mockReturnValue("discussion");

				// Act
				await run();

				// Assert
				expect(handlers.ContentLabelHandler).toHaveBeenCalledWith(
					sampleConfig,
					expect.objectContaining({ "github-token": "test-token" }),
					"discussion",
				);
				expect(core.info).toHaveBeenCalledWith("Scanning content of discussion #789");
				expect(handlers.mockContentLabelHandlerInstance.performContentScanning).toHaveBeenCalledWith(
					complexDiscussionPayload.discussion,
				);
			});

			it("should handle complex labeled events with existing labels", async () => {
				// Arrange
				const complexIssuePayload = createComplexIssuePayload("labeled", {
					labels: [
						{ name: "bug", color: "d73a4a" },
						{ name: "performance", color: "fef2c0" },
						{ name: "critical", color: "ff0000" },
					],
				});
				(complexIssuePayload as { label?: { name: string; color: string } }).label = {
					name: "critical",
					color: "ff0000",
				};
				github.context.payload = complexIssuePayload;
				handlers.mockIssueHandlerInstance.getThreadType.mockReturnValue("issue");

				// Act
				await run();

				// Assert
				expect(handlers.IssueHandler).toHaveBeenCalledWith(
					sampleConfig,
					expect.objectContaining({ "github-token": "test-token" }),
				);
				expect(core.info).toHaveBeenCalledWith("Processing issue #123");
				expect(handlers.mockIssueHandlerInstance.performActions).toHaveBeenCalledWith(
					complexIssuePayload,
					complexIssuePayload.issue,
				);
			});
		});

		describe("input configuration variations", () => {
			beforeEach(() => {
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockReturnValue(JSON.stringify(sampleConfig));
				github.context.payload = {};
			});

			it("should handle basic input configuration", async () => {
				// Arrange
				mockGetInput(testInputConfigs.basic);
				validation.default.validate.mockReturnValue({
					error: undefined,
					value: {
						"github-token": "test-token",
						"config-path": "./config.yaml",
						process: undefined,
					},
				});

				// Act
				await run();

				// Assert
				expect(validation.default.validate).toHaveBeenCalledWith(
					{
						"github-token": "test-token",
						"config-path": "./config.yaml",
						process: undefined,
					},
					{ abortEarly: false },
				);
			});

			it("should handle input configuration with process filter", async () => {
				// Arrange
				mockGetInput(testInputConfigs.withProcess);
				validation.default.validate.mockReturnValue({
					error: undefined,
					value: {
						"github-token": "test-token",
						"config-path": "./example/config.yaml",
						process: ["issues", "pr"],
					},
				});

				// Act
				await run();

				// Assert
				expect(validation.default.validate).toHaveBeenCalledWith(
					{
						"github-token": "test-token",
						"config-path": "./example/config.yaml",
						process: ["issues", "pr"],
					},
					{ abortEarly: false },
				);
			});

			it("should handle complex process input with spaces", async () => {
				// Arrange
				mockGetInput(testInputConfigs.withComplexProcess);
				validation.default.validate.mockReturnValue({
					error: undefined,
					value: {
						"github-token": "test-token",
						"config-path": "./config.yaml",
						process: ["issues", "pr", "discussions"],
					},
				});

				// Act
				await run();

				// Assert
				expect(validation.default.validate).toHaveBeenCalledWith(
					{
						"github-token": "test-token",
						"config-path": "./config.yaml",
						process: ["issues", "pr", "discussions"],
					},
					{ abortEarly: false },
				);
			});

			it("should handle empty process input", async () => {
				// Arrange
				mockGetInput(testInputConfigs.emptyProcess);
				validation.default.validate.mockReturnValue({
					error: undefined,
					value: {
						"github-token": "test-token",
						"config-path": "./config.yaml",
						process: undefined,
					},
				});

				// Act
				await run();

				// Assert
				expect(validation.default.validate).toHaveBeenCalledWith(
					{
						"github-token": "test-token",
						"config-path": "./config.yaml",
						process: undefined,
					},
					{ abortEarly: false },
				);
			});
		});

		describe("file system edge cases", () => {
			beforeEach(() => {
				validation.default.validate.mockReturnValue(validation.mockValidationSuccess);
			});

			it("should handle file system permission errors", async () => {
				// Arrange
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockImplementation(() => {
					const error = new Error("EACCES: permission denied");
					(error as any).code = "EACCES";
					throw error;
				});
				github.context.payload = {};

				// Act
				await run();

				// Assert
				expect(core.setFailed).toHaveBeenCalledWith(
					"Failed to load or parse configuration file at ./example/config.yaml: Error: EACCES: permission denied",
				);
			});

			it("should handle file not found with custom path", async () => {
				// Arrange
				mockGetInput((name) => {
					switch (name) {
						case "github-token":
							return "test-token";
						case "config-path":
							return "/custom/path/config.yaml";
						default:
							return "";
					}
				});
				validation.default.validate.mockReturnValue({
					error: undefined,
					value: {
						"github-token": "test-token",
						"config-path": "/custom/path/config.yaml",
						process: undefined,
					},
				});
				fs.existsSync.mockReturnValue(false);
				github.context.payload = {};

				// Act
				await run();

				// Assert
				expect(core.setFailed).toHaveBeenCalledWith("Configuration file not found at path: /custom/path/config.yaml");
			});

			it("should handle empty config file", async () => {
				// Arrange
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockReturnValue("");
				(yaml.parse as jest.Mock).mockImplementation(() => {
					throw new Error("Cannot parse empty file");
				});
				github.context.payload = {};

				// Act
				await run();

				// Assert
				expect(core.setFailed).toHaveBeenCalledWith(
					expect.stringContaining("Failed to load or parse configuration file at ./example/config.yaml:"),
				);
			});

			it("should handle corrupted JSON config file", async () => {
				// Arrange
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockReturnValue('{"incomplete": json, "syntax');
				(yaml.parse as jest.Mock).mockImplementation(() => {
					throw new Error("YAML parse error: unexpected token");
				});
				github.context.payload = {};

				// Act
				await run();

				// Assert
				expect(core.setFailed).toHaveBeenCalledWith(
					expect.stringContaining("Failed to load or parse configuration file at ./example/config.yaml:"),
				);
			});
		});

		describe("handler error scenarios", () => {
			beforeEach(() => {
				validation.default.validate.mockReturnValue(validation.mockValidationSuccess);
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockReturnValue(JSON.stringify(sampleConfig));
				(yaml.parse as jest.Mock).mockReturnValue(sampleConfig);

				// Reset handler mocks to defaults using mockImplementation
				handlers.ContentLabelHandler.mockImplementation(() => handlers.mockContentLabelHandlerInstance);
				handlers.IssueHandler.mockImplementation(() => handlers.mockIssueHandlerInstance);
				handlers.PullRequestHandler.mockImplementation(() => handlers.mockPullRequestHandlerInstance);
				handlers.DiscussionHandler.mockImplementation(() => handlers.mockDiscussionHandlerInstance);
			});

			it("should handle ContentLabelHandler constructor failure", async () => {
				// Arrange
				const issuePayload = createIssuePayload("opened");
				github.context.payload = issuePayload;
				handlers.ContentLabelHandler.mockImplementation(() => {
					throw new Error("Failed to initialize ContentLabelHandler");
				});

				// Act
				await run();

				// Assert
				expect(core.setFailed).toHaveBeenCalledWith("Failed to initialize ContentLabelHandler");
			});

			it("should handle multiple handler failures gracefully", async () => {
				// Arrange
				const issuePayload = createIssuePayload("labeled", undefined, {
					name: "bug",
				});
				github.context.payload = issuePayload;
				handlers.IssueHandler.mockImplementation(() => {
					throw new Error("Handler initialization failed");
				});

				// Act
				await run();

				// Assert
				expect(core.setFailed).toHaveBeenCalledWith("Handler initialization failed");
			});

			it("should handle async handler method failures", async () => {
				// Arrange
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockReturnValue(JSON.stringify(sampleConfig));
				(yaml.parse as jest.Mock).mockReturnValue(sampleConfig);
				const prPayload = createPullRequestPayload("opened");
				github.context.payload = prPayload;
				handlers.mockContentLabelHandlerInstance.getThreadType.mockReturnValue("pr");
				(handlers.mockContentLabelHandlerInstance.performContentScanning as jest.MockedFunction<any>).mockRejectedValue(
					new Error("Async operation failed"),
				);

				// Act
				await run();

				// Assert
				expect(core.setFailed).toHaveBeenCalledWith("Async operation failed");
			});

			it("should handle timeout scenarios in handler methods", async () => {
				// Arrange
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockReturnValue(JSON.stringify(sampleConfig));
				(yaml.parse as jest.Mock).mockReturnValue(sampleConfig);
				const discussionPayload = createDiscussionPayload("opened");
				github.context.payload = discussionPayload;
				handlers.mockContentLabelHandlerInstance.getThreadType.mockReturnValue("discussion");
				(handlers.mockContentLabelHandlerInstance.performContentScanning as jest.MockedFunction<any>).mockRejectedValue(
					new Error("Operation timed out"),
				);

				// Act
				await run();

				// Assert
				expect(core.setFailed).toHaveBeenCalledWith("Operation timed out");
			});
		});

		describe("payload validation edge cases", () => {
			beforeEach(() => {
				validation.default.validate.mockReturnValue(validation.mockValidationSuccess);
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockReturnValue(JSON.stringify(sampleConfig));
				(yaml.parse as jest.Mock).mockReturnValue(sampleConfig);
			});

			it("should handle payload with null action", async () => {
				// Arrange
				github.context.payload = {
					action: undefined,
					issue: { number: 123 },
				} as any;

				// Act
				await run();

				// Assert
				expect(handlers.ContentLabelHandler).not.toHaveBeenCalled();
				expect(handlers.IssueHandler).not.toHaveBeenCalled();
			});

			it("should handle payload with undefined thread data properties", async () => {
				// Arrange
				github.context.payload = {
					action: "opened",
					issue: undefined,
					pull_request: undefined,
					discussion: undefined,
				};

				// Act
				await run();

				// Assert
				expect(core.info).toHaveBeenCalledWith("No issue, pull request or discussion found in payload");
			});

			it("should handle payload with invalid action types", async () => {
				// Arrange
				github.context.payload = {
					action: "invalid_action",
					issue: { number: 123 },
				};

				// Act
				await run();

				// Assert
				expect(handlers.ContentLabelHandler).not.toHaveBeenCalled();
				expect(handlers.IssueHandler).not.toHaveBeenCalled();
			});

			it("should handle payload with missing number property", async () => {
				// Arrange
				const issuePayload = createIssuePayload("opened");
				const modifiedPayload = {
					...issuePayload,
					issue: { ...issuePayload.issue, number: undefined },
				};
				github.context.payload = modifiedPayload;
				handlers.mockContentLabelHandlerInstance.getThreadType.mockReturnValue("issue");

				// Act
				await run();

				// Assert
				expect(handlers.ContentLabelHandler).toHaveBeenCalled();
				expect(core.info).toHaveBeenCalledWith("Scanning content of issue #undefined");
			});
		});

		describe("concurrency and performance scenarios", () => {
			beforeEach(() => {
				validation.default.validate.mockReturnValue(validation.mockValidationSuccess);
				fs.existsSync.mockReturnValue(true);
				fs.readFileSync.mockReturnValue(JSON.stringify(sampleConfig));
				(yaml.parse as jest.Mock).mockReturnValue(sampleConfig);
			});

			it("should handle rapid successive handler calls", async () => {
				// Arrange
				const issuePayload = createIssuePayload("opened");
				github.context.payload = issuePayload;
				handlers.mockContentLabelHandlerInstance.getThreadType.mockReturnValue("issue");
				(handlers.mockContentLabelHandlerInstance.performContentScanning as jest.MockedFunction<any>).mockResolvedValue(
					void 0,
				);

				// Act
				await Promise.all([run(), run(), run()]);

				// Assert
				expect(handlers.ContentLabelHandler).toHaveBeenCalledTimes(3);
				expect(handlers.mockContentLabelHandlerInstance.performContentScanning).toHaveBeenCalledTimes(3);
			});

			it("should handle large config loading performance", async () => {
				// Arrange
				fs.readFileSync.mockReturnValue(JSON.stringify(largeConfig));
				(yaml.parse as jest.Mock).mockReturnValue(largeConfig);

				const startTime = Date.now();

				// Act
				await run();

				// Assert
				const executionTime = Date.now() - startTime;
				expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
				expect(handlers.ContentLabelHandler).toHaveBeenCalledWith(
					largeConfig,
					expect.objectContaining({ "github-token": "test-token" }),
					"issue",
				);
			});

			it("should handle memory constraints with large payloads", async () => {
				// Arrange
				const largePayload = createComplexIssuePayload("opened", {
					body: "x".repeat(100000), // Large body content
				});
				github.context.payload = largePayload;
				handlers.mockContentLabelHandlerInstance.getThreadType.mockReturnValue("issue");

				// Act
				await run();

				// Assert
				expect(handlers.ContentLabelHandler).toHaveBeenCalled();
				expect(handlers.mockContentLabelHandlerInstance.performContentScanning).toHaveBeenCalledWith(
					largePayload.issue,
				);
			});
		});
	});
});
