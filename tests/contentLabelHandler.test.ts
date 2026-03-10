import { beforeEach, describe, expect, it, jest } from "@jest/globals";

// Mock dependencies BEFORE importing
jest.unstable_mockModule("@actions/core", () => ({
	debug: jest.fn(),
	info: jest.fn(),
	warning: jest.fn(),
	setFailed: jest.fn(),
}));

jest.unstable_mockModule("@actions/github", () => ({
	getOctokit: jest.fn(() => ({
		rest: {
			issues: {
				addLabels: jest.fn(),
			},
		},
		graphql: jest.fn(),
	})),
	context: {
		repo: {
			owner: "test-owner",
			repo: "test-repo",
		},
		payload: {},
	},
}));

// Now import after mocking
const { ContentLabelHandler } = await import("../src/handlers/contentLabelHandler");
const core = await import("@actions/core");
const github = await import("@actions/github");

import type Config from "../src/models/internal/config";
import type GHActionConfig from "../src/models/internal/ghActionConfig";

describe("ContentLabelHandler", () => {
	let mockOctokit: {
		rest: {
			issues: Record<string, jest.Mock>;
		};
	};
	let mockConfig: Config;
	let mockActionConfig: GHActionConfig;

	beforeEach(() => {
		jest.clearAllMocks();

		mockOctokit = {
			rest: {
				issues: {
					addLabels: jest.fn(),
				},
			},
			graphql: jest.fn(),
		};

		(github.getOctokit as any).mockReturnValue(mockOctokit);

		mockActionConfig = {
			"github-token": "test-token",
			"config-path": "test-config.yml",
		};
	});

	describe("performContentScanning", () => {
		it("should scan title and body for regex patterns", async () => {
			mockConfig = {
				regex: {
					"\\bbug\\b": {
						labels: {
							add: ["bug"],
						},
					},
				},
			} as Config;

			const handler = new ContentLabelHandler(mockConfig, mockActionConfig, "issue");

			const threadData = {
				number: 1,
				title: "Found a bug in the application",
				body: "This needs to be fixed",
				labels: [],
			};

			await handler.performContentScanning(threadData as any);

			expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				labels: ["bug"],
			});
		});

		it("should handle case-insensitive matching by default", async () => {
			mockConfig = {
				regex: {
					"\\bBUG\\b": {
						labels: {
							add: ["bug"],
						},
					},
				},
			} as Config;

			const handler = new ContentLabelHandler(mockConfig, mockActionConfig, "issue");

			const threadData = {
				number: 1,
				title: "Found a bug in the application",
				body: "",
				labels: [],
			};

			await handler.performContentScanning(threadData as any);

			expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				labels: ["bug"],
			});
		});

		it("should respect case-sensitive flag", async () => {
			mockConfig = {
				caseSensitive: true,
				regex: {
					"\\bBUG\\b": {
						labels: {
							add: ["bug"],
						},
						caseSensitive: true,
					},
				},
			} as Config;

			const handler = new ContentLabelHandler(mockConfig, mockActionConfig, "issue");

			const threadData = {
				number: 1,
				title: "Found a bug in the application",
				body: "",
				labels: [],
			};

			await handler.performContentScanning(threadData as any);

			// Should not match because of case sensitivity
			expect(mockOctokit.rest.issues.addLabels).not.toHaveBeenCalled();
		});

		it("should add multiple labels for multiple pattern matches", async () => {
			mockConfig = {
				regex: {
					"\\bbug\\b": {
						labels: {
							add: ["bug"],
						},
					},
					"\\bcrash\\b": {
						labels: {
							add: ["crash"],
						},
					},
				},
			} as Config;

			const handler = new ContentLabelHandler(mockConfig, mockActionConfig, "issue");

			const threadData = {
				number: 1,
				title: "Application crash bug",
				body: "The app crashes when clicking the button",
				labels: [],
			};

			await handler.performContentScanning(threadData as any);

			expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				labels: expect.arrayContaining(["bug", "crash"]),
			});
		});

		it("should not add labels that already exist", async () => {
			mockConfig = {
				regex: {
					"\\bbug\\b": {
						labels: {
							add: ["bug"],
						},
					},
				},
			} as Config;

			const handler = new ContentLabelHandler(mockConfig, mockActionConfig, "issue");

			const threadData = {
				number: 1,
				title: "Found a bug",
				body: "",
				labels: [{ name: "bug" }],
			};

			await handler.performContentScanning(threadData as any);

			expect(mockOctokit.rest.issues.addLabels).not.toHaveBeenCalled();
		});

		it("should skip scanning when no content rules exist", async () => {
			mockConfig = {} as Config;

			const handler = new ContentLabelHandler(mockConfig, mockActionConfig, "issue");

			const threadData = {
				number: 1,
				title: "Test issue",
				body: "Test body",
				labels: [],
			};

			await handler.performContentScanning(threadData as any);

			expect(mockOctokit.rest.issues.addLabels).not.toHaveBeenCalled();
			expect(core.debug).toHaveBeenCalledWith("No content rules found");
		});

		it("should handle empty regex config", async () => {
			mockConfig = {
				regex: {},
			} as Config;

			const handler = new ContentLabelHandler(mockConfig, mockActionConfig, "issue");

			const threadData = {
				number: 1,
				title: "Test issue",
				body: "Test body",
				labels: [],
			};

			await handler.performContentScanning(threadData as any);

			expect(mockOctokit.rest.issues.addLabels).not.toHaveBeenCalled();
		});

		it("should handle null body gracefully", async () => {
			mockConfig = {
				regex: {
					"\\bbug\\b": {
						labels: {
							add: ["bug"],
						},
					},
				},
			} as Config;

			const handler = new ContentLabelHandler(mockConfig, mockActionConfig, "issue");

			const threadData = {
				number: 1,
				title: "Found a bug",
				body: null,
				labels: [],
			};

			await handler.performContentScanning(threadData as any);

			expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				labels: ["bug"],
			});
		});

		it("should respect scanTitle configuration", async () => {
			mockConfig = {
				scanTitle: false,
				regex: {
					"\\bbug\\b": {
						labels: {
							add: ["bug"],
						},
					},
				},
			} as Config;

			const handler = new ContentLabelHandler(mockConfig, mockActionConfig, "issue");

			const threadData = {
				number: 1,
				title: "Found a bug",
				body: "Normal content",
				labels: [],
			};

			await handler.performContentScanning(threadData as any);

			// Should not match because title scanning is disabled
			expect(mockOctokit.rest.issues.addLabels).not.toHaveBeenCalled();
		});

		it("should respect scanBody configuration", async () => {
			mockConfig = {
				scanBody: false,
				regex: {
					"\\bbug\\b": {
						labels: {
							add: ["bug"],
						},
					},
				},
			} as Config;

			const handler = new ContentLabelHandler(mockConfig, mockActionConfig, "issue");

			const threadData = {
				number: 1,
				title: "Normal title",
				body: "Found a bug in the body",
				labels: [],
			};

			await handler.performContentScanning(threadData as any);

			// Should not match because body scanning is disabled
			expect(mockOctokit.rest.issues.addLabels).not.toHaveBeenCalled();
		});

		it("should work with pull request thread type", async () => {
			mockConfig = {
				regex: {
					"\\bWIP\\b": {
						labels: {
							add: ["work-in-progress"],
						},
					},
				},
			} as Config;

			const handler = new ContentLabelHandler(mockConfig, mockActionConfig, "pr");

			const threadData = {
				number: 42,
				title: "WIP: New feature",
				body: "Still in progress",
				labels: [],
			};

			await handler.performContentScanning(threadData as any);

			expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 42,
				labels: ["work-in-progress"],
			});
		});

		it("should work with discussion thread type", async () => {
			mockConfig = {
				regex: {
					"\\bquestion\\b": {
						labels: {
							add: ["Q&A"],
						},
					},
				},
			} as Config;

			const handler = new ContentLabelHandler(mockConfig, mockActionConfig, "discussion");

			const threadData = {
				number: 5,
				node_id: "discussion-node-id",
				title: "I have a question about the API",
				body: "How do I use this feature?",
			};

			mockOctokit.graphql
				.mockResolvedValueOnce({
					repository: {
						labels: {
							nodes: [{ id: "label-1", name: "Q&A" }],
						},
					},
				})
				.mockResolvedValueOnce({});

			await handler.performContentScanning(threadData as any);

			expect(mockOctokit.rest.issues.addLabels).not.toHaveBeenCalled();
			expect(mockOctokit.graphql).toHaveBeenNthCalledWith(
				1,
				expect.stringContaining("query($owner: String!, $name: String!, $labels: String!)"),
				{
					owner: "test-owner",
					name: "test-repo",
					labels: "Q&A",
				},
			);
			expect(mockOctokit.graphql).toHaveBeenNthCalledWith(2, expect.stringContaining("addLabelsToLabelable"), {
				discussionId: "discussion-node-id",
				labelIds: ["label-1"],
			});
		});

		it("should handle complex regex patterns", async () => {
			mockConfig = {
				regex: {
					"\\b(urgent|critical|emergency)\\b": {
						labels: {
							add: ["priority-high"],
						},
					},
				},
			} as Config;

			const handler = new ContentLabelHandler(mockConfig, mockActionConfig, "issue");

			const threadData = {
				number: 1,
				title: "URGENT: Server down",
				body: "This is critical",
				labels: [],
			};

			await handler.performContentScanning(threadData as any);

			expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				labels: ["priority-high"],
			});
		});

		it("should handle patterns with special characters", async () => {
			mockConfig = {
				regex: {
					"\\[BUG\\]": {
						labels: {
							add: ["bug"],
						},
					},
				},
			} as Config;

			const handler = new ContentLabelHandler(mockConfig, mockActionConfig, "issue");

			const threadData = {
				number: 1,
				title: "[BUG] Something broke",
				body: "",
				labels: [],
			};

			await handler.performContentScanning(threadData as any);

			expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith({
				owner: "test-owner",
				repo: "test-repo",
				issue_number: 1,
				labels: ["bug"],
			});
		});
	});

	describe("getThreadType", () => {
		it("should return the correct thread type for issue", () => {
			mockConfig = {} as Config;
			const handler = new ContentLabelHandler(mockConfig, mockActionConfig, "issue");

			expect(handler.getThreadType()).toBe("issue");
		});

		it("should return the correct thread type for PR", () => {
			mockConfig = {} as Config;
			const handler = new ContentLabelHandler(mockConfig, mockActionConfig, "pr");

			expect(handler.getThreadType()).toBe("pr");
		});

		it("should return the correct thread type for discussion", () => {
			mockConfig = {} as Config;
			const handler = new ContentLabelHandler(mockConfig, mockActionConfig, "discussion");

			expect(handler.getThreadType()).toBe("discussion");
		});
	});
});
