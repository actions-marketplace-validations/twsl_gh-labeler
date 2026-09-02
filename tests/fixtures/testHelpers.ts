import { jest } from "bun:test";
import type { DiscussionEvent, IssuesEvent, PullRequestEvent } from "@octokit/webhooks-types";

// Common test input configurations
export const testInputConfigs = {
	basic: (name: string) => {
		switch (name) {
			case "github-token":
				return "test-token";
			case "config-path":
				return "./config.yaml";
			default:
				return "";
		}
	},
	withProcess: (name: string) => {
		switch (name) {
			case "github-token":
				return "test-token";
			case "config-path":
				return "./example/config.yaml";
			case "process":
				return "issues,pr";
			default:
				return "";
		}
	},
	withComplexProcess: (name: string) => {
		switch (name) {
			case "process":
				return "issues, pr , discussions";
			case "github-token":
				return "test-token";
			case "config-path":
				return "./config.yaml";
			default:
				return "";
		}
	},
	emptyProcess: (name: string) => {
		switch (name) {
			case "process":
				return "";
			case "github-token":
				return "test-token";
			case "config-path":
				return "./config.yaml";
			default:
				return "";
		}
	},
	malformedProcess: (name: string) => {
		switch (name) {
			case "process":
				return ",,invalid,,";
			case "github-token":
				return "test-token";
			case "config-path":
				return "./config.yaml";
			default:
				return "";
		}
	},
	missingToken: (name: string) => {
		switch (name) {
			case "github-token":
				return "";
			case "config-path":
				return "./example/config.yaml";
			default:
				return "";
		}
	},
	longValues: (name: string) => {
		const longToken = "a".repeat(1000);
		const longPath = `${"path/".repeat(100)}config.yaml`;
		switch (name) {
			case "github-token":
				return longToken;
			case "config-path":
				return longPath;
			default:
				return "";
		}
	},
};

// Setup and teardown functions for unified tests
export const setupDefaultMocks = async () => {
	const core = await import("./core");
	const fs = await import("./fs");
	const handlers = await import("./handlers");
	const validation = await import("./validation");
	const { sampleConfig } = await import("./config");
	const yaml = await import("yaml");

	// Setup default mocks
	core.getInput.mockImplementation((name: string) => {
		switch (name) {
			case "github-token":
				return "test-token";
			case "config-path":
				return "";
			case "process":
				return "";
			default:
				return "";
		}
	});
	fs.existsSync.mockReturnValue(true);
	fs.readFileSync.mockReturnValue(JSON.stringify(sampleConfig));
	(yaml.parse as jest.Mock).mockReturnValue(sampleConfig);

	// Setup smart validation mock
	validation.default.validate.mockImplementation((input: Record<string, unknown>) => {
		return validation.mockSchemaValidate(input);
	});

	// Setup default handler mocks
	handlers.mockContentLabelHandlerInstance.getThreadType.mockReturnValue("issue");
	handlers.mockIssueHandlerInstance.getThreadType.mockReturnValue("issue");
	handlers.mockPullRequestHandlerInstance.getThreadType.mockReturnValue("pull_request");
	handlers.mockDiscussionHandlerInstance.getThreadType.mockReturnValue("discussion");

	// Reset handler constructor mocks to return instances (not throw)
	handlers.ContentLabelHandler.mockImplementation(() => handlers.mockContentLabelHandlerInstance);
	handlers.IssueHandler.mockImplementation(() => handlers.mockIssueHandlerInstance);
	handlers.PullRequestHandler.mockImplementation(() => handlers.mockPullRequestHandlerInstance);
	handlers.DiscussionHandler.mockImplementation(() => handlers.mockDiscussionHandlerInstance);
};

export const resetMocks = async () => {
	const handlers = await import("./handlers");
	handlers.clearAllHandlerMocks();
	jest.clearAllMocks();
};

// Test scenario generators
export const createTestScenario = (type: "success" | "error", scenario: Record<string, unknown>) => {
	return {
		...scenario,
		type,
	};
};

// Common expectations helpers
export const expectValidationCalled = (
	validation: { default: { validate: jest.Mock } },
	expectedConfig: Record<string, unknown>,
) => {
	expect(validation.default.validate).toHaveBeenCalledWith(expectedConfig, {
		abortEarly: false,
	});
};

export const expectHandlerCalled = (handler: jest.Mock, config: Record<string, unknown>, ...args: unknown[]) => {
	expect(handler).toHaveBeenCalledWith(config, ...args);
};

export const expectContentScanning = (
	handlers: {
		mockContentLabelHandlerInstance: { performContentScanning: jest.Mock };
	},
	issue: IssuesEvent["issue"] | PullRequestEvent["pull_request"] | DiscussionEvent["discussion"],
) => {
	expect(handlers.mockContentLabelHandlerInstance.performContentScanning).toHaveBeenCalledWith(issue);
};

export const expectLabelAction = (
	handlers: {
		mockIssueHandlerInstance?: { performActions: jest.Mock };
		mockPullRequestHandlerInstance?: { performActions: jest.Mock };
		mockDiscussionHandlerInstance?: { performActions: jest.Mock };
	},
	payload: IssuesEvent | PullRequestEvent | DiscussionEvent,
	threadData: IssuesEvent["issue"] | PullRequestEvent["pull_request"] | DiscussionEvent["discussion"],
) => {
	expect(handlers.mockIssueHandlerInstance?.performActions).toHaveBeenCalledWith(payload, threadData);
};

// Error simulation helpers
export const simulateFileSystemError = (
	fs: { existsSync: jest.Mock; readFileSync: jest.Mock },
	errorType: "permission" | "notfound" | "parse",
) => {
	switch (errorType) {
		case "permission":
			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockImplementation(() => {
				const error = new Error("EACCES: permission denied");
				(error as any).code = "EACCES";
				throw error;
			});
			break;
		case "notfound":
			fs.existsSync.mockReturnValue(false);
			break;
		case "parse":
			fs.existsSync.mockReturnValue(true);
			fs.readFileSync.mockReturnValue("invalid json content");
			break;
	}
};

export const simulateHandlerError = (
	handlers: {
		IssueHandler?: jest.Mock;
		PullRequestHandler?: jest.Mock;
		DiscussionHandler?: jest.Mock;
		ContentLabelHandler?: jest.Mock;
		mockContentLabelHandlerInstance?: { performContentScanning: jest.Mock };
	},
	errorType: "instantiation" | "execution",
	message: string,
) => {
	switch (errorType) {
		case "instantiation":
			handlers.ContentLabelHandler?.mockImplementation(() => {
				throw new Error(message);
			});
			break;
		case "execution":
			handlers.mockContentLabelHandlerInstance?.performContentScanning.mockRejectedValueOnce(
				new Error(message) as never,
			);
			break;
	}
};

// Complex validation error generator
export const createComplexValidationError = () => ({
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
});

// Performance testing helpers
export const measureExecutionTime = async (fn: () => Promise<void>) => {
	const startTime = Date.now();
	await fn();
	return Date.now() - startTime;
};

export const createLargePayload = (type: "issue" | "pr" | "discussion", size = 10000) => {
	const largeBody = "x".repeat(size);
	return {
		action: "opened",
		[type === "pr" ? "pull_request" : type]: {
			number: 123,
			title: "Large Content",
			body: largeBody,
		},
	};
};

// Async operation helpers
export const createTimeoutPromise = (timeout: number, shouldReject = true) => {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			if (shouldReject) {
				reject(new Error("Operation timeout"));
			} else {
				resolve(undefined);
			}
		}, timeout);
	});
};

export const createCancellableOperation = () => {
	let cancelSignal = false;

	const operation = () =>
		new Promise((resolve, reject) => {
			setTimeout(() => {
				if (cancelSignal) {
					reject(new Error("Operation cancelled"));
				} else {
					resolve(undefined);
				}
			}, 50);
		});

	const cancel = () => {
		cancelSignal = true;
	};

	return { operation, cancel };
};
