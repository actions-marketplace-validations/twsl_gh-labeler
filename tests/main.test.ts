import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

// Mock all external dependencies BEFORE importing the main module
jest.unstable_mockModule("@actions/core", () => import("./fixtures/core"));
jest.unstable_mockModule("@actions/github", () => import("./fixtures/github"));
jest.unstable_mockModule("node:fs", () => import("./fixtures/fs"));
jest.unstable_mockModule("yaml", () => ({
	parse: jest.fn(),
}));
jest.unstable_mockModule("../src/handlers/issueHandler", () =>
	import("./fixtures/handlers").then((handlers) => ({ IssueHandler: handlers.IssueHandler })),
);
jest.unstable_mockModule("../src/handlers/pullRequestHandler", () =>
	import("./fixtures/handlers").then((handlers) => ({ PullRequestHandler: handlers.PullRequestHandler })),
);
jest.unstable_mockModule("../src/handlers/discussionHandler", () =>
	import("./fixtures/handlers").then((handlers) => ({ DiscussionHandler: handlers.DiscussionHandler })),
);
jest.unstable_mockModule("../src/handlers/contentLabelHandler", () =>
	import("./fixtures/handlers").then((handlers) => ({ ContentLabelHandler: handlers.ContentLabelHandler })),
);
jest.unstable_mockModule("../src/schemas/ghActionConfig", () => import("./fixtures/validation"));

// Import the main module AFTER setting up mocks
const { run } = await import("../src/main");

// Import mocked modules
const core = await import("./fixtures/core");
const github = await import("./fixtures/github");
const fs = await import("./fixtures/fs");
const yaml = await import("yaml");
const handlers = await import("./fixtures/handlers");
const validation = await import("./fixtures/validation");
const { sampleConfig, configWithContentRules } = await import("./fixtures/config");
const { createIssuePayload, createPullRequestPayload, createDiscussionPayload } = await import("./fixtures/payloads");
const { setupDefaultMocks, resetMocks } = await import("./fixtures/testHelpers");
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
				core.getInput.mockImplementation((name: string) => {
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
				core.getInput.mockImplementation((name: string) => {
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
				core.getInput.mockImplementation((name: string) => {
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

			it("should prioritize content scanning over label-based actions", async () => {
				// Arrange - payload that matches both content scanning and label-based actions
				const issuePayload = createIssuePayload("opened", undefined, {
					name: "bug",
				});
				// Add label to make it eligible for label-based actions too
				issuePayload.label = { name: "bug" };
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
				payloadWithoutLabel.label = undefined; // Remove label data
				github.context.payload = payloadWithoutLabel;

				// Act
				await run();

				// Assert
				expect(handlers.IssueHandler).not.toHaveBeenCalled();
			});

			it("should handle trimmed process input correctly", async () => {
				// Arrange
				core.getInput.mockImplementation((name: string) => {
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
				complexIssuePayload.label = { name: "critical", color: "ff0000" };
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
				core.getInput.mockImplementation(testInputConfigs.basic);
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
				core.getInput.mockImplementation(testInputConfigs.withProcess);
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
				core.getInput.mockImplementation(testInputConfigs.withComplexProcess);
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
				core.getInput.mockImplementation(testInputConfigs.emptyProcess);
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
				core.getInput.mockImplementation((name: string) => {
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
