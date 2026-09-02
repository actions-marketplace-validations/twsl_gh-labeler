import { beforeEach, describe, expect, it, jest, mock } from "bun:test";
import type Config from "@/models/internal/config";
import type GHActionConfig from "@/models/internal/ghActionConfig";

mock.module("@actions/core", () => ({
	debug: jest.fn(),
	info: jest.fn(),
	warning: jest.fn(),
	setFailed: jest.fn(),
}));

mock.module("@actions/github", () => ({
	getOctokit: jest.fn(),
	context: { repo: { owner: "test-owner", repo: "test-repo" }, payload: {} },
}));

const { DiscussionHandler } = await import("@/handlers/discussionHandler");
const github = await import("@actions/github");

type MockClient = {
	rest: { issues: Record<string, jest.Mock> };
	graphql: jest.Mock;
};

const payload = (action = "labeled", label = "discussion-label") => ({
	action,
	label: { name: label },
});

const thread = {
	number: 7,
	node_id: "discussion-node",
	title: "A discussion",
	body: "Discussion body",
	html_url: "https://example.test/discussion/7",
	user: { login: "author" },
} as any;

describe("DiscussionHandler", () => {
	let client: MockClient;
	const actionConfig: GHActionConfig = { "github-token": "token", "config-path": "config.yml" };

	beforeEach(() => {
		client = {
			rest: { issues: { create: jest.fn() } },
			graphql: jest.fn(),
		};
		(github.getOctokit as jest.Mock).mockReturnValue(client);
	});

	it("performs comments, labels, category, close, and issue creation", async () => {
		client.graphql
			.mockResolvedValueOnce({})
			.mockResolvedValueOnce({ repository: { labels: { nodes: [{ id: "label-id", name: "triage" }] } } })
			.mockResolvedValueOnce({})
			.mockResolvedValueOnce({ repository: { labels: { nodes: [{ id: "old-id", name: "old" }] } } })
			.mockResolvedValueOnce({})
			.mockResolvedValueOnce({ repository: { discussionCategories: { nodes: [{ id: "cat-id", name: "Ideas" }] } } })
			.mockResolvedValueOnce({})
			.mockResolvedValueOnce({});

		const config: Config = {
			labels: {
				add: {
					"discussion-label": {
						discussions: {
							comments: ["Hello {issue-author}"],
							labels: { add: ["triage"], remove: ["old"] },
							category: "Ideas",
							close: true,
							close_reason: "resolved",
							create_issue: true,
						},
					},
				},
			},
		};

		await new DiscussionHandler(config, actionConfig).performActions(payload(), thread);

		expect(client.graphql).toHaveBeenCalledTimes(8);
		expect(client.rest.issues.create).toHaveBeenCalledWith({
			owner: "test-owner",
			repo: "test-repo",
			title: thread.title,
			body: `Created from discussion: ${thread.html_url}\n\n${thread.body}`,
		});
	});

	it("accepts object label configurations and handles a missing category", async () => {
		client.graphql
			.mockResolvedValueOnce({ repository: { labels: { nodes: [{ id: "label-id", name: "triage" }] } } })
			.mockResolvedValueOnce({})
			.mockResolvedValueOnce({ repository: { labels: { nodes: [] } } })
			.mockResolvedValueOnce({ repository: { discussionCategories: { nodes: [] } } });

		const config: Config = {
			labels: {
				add: {
					label: {
						discussions: {
							labels: { add: { triage: {}, ignored: {} }, remove: { old: {} } },
							category: "Missing",
						},
					},
				},
			},
		};

		await expect(
			new DiscussionHandler(config, actionConfig).performActions(payload("labeled", "label"), thread),
		).rejects.toThrow('Category "Missing" not found in repository');
		expect(client.graphql).toHaveBeenCalledTimes(4);
	});

	it("returns when no actions are configured", async () => {
		await new DiscussionHandler({ labels: { add: {} } } as Config, actionConfig).performActions(payload(), thread);
		expect(client.graphql).not.toHaveBeenCalled();
	});

	it("reports API failures without rejecting", async () => {
		client.graphql.mockRejectedValue(new Error("graphql failed"));
		client.rest.issues.create.mockRejectedValue(new Error("rest failed"));
		const config: Config = {
			labels: {
				add: {
					label: {
						discussions: {
							comments: ["comment"],
							labels: { add: ["triage"], remove: ["old"] },
							category: "Ideas",
							close: true,
							create_issue: true,
						},
					},
				},
			},
		};

		await expect(
			new DiscussionHandler(config, actionConfig).performActions(payload("labeled", "label"), thread),
		).rejects.toThrow("Failed to comment on discussion");
	});

	it("reports label removal, close, and issue creation failures", async () => {
		client.graphql
			.mockResolvedValueOnce({ repository: { labels: { nodes: [{ id: "old-id", name: "old" }] } } })
			.mockRejectedValueOnce(new Error("remove failed"));
		client.rest.issues.create.mockRejectedValue(new Error("create failed"));

		await expect(
			new DiscussionHandler(
				{
					labels: {
						add: {
							label: {
								discussions: {
									labels: { remove: ["old"] },
									close: true,
									create_issue: true,
								},
							},
						},
					},
				} as Config,
				actionConfig,
			).performActions(payload("labeled", "label"), thread),
		).rejects.toThrow("Failed to remove labels from discussion");
	});

	it("reports close failures", async () => {
		client.graphql.mockRejectedValue(new Error("close failed"));

		await expect(
			new DiscussionHandler(
				{ labels: { add: { label: { discussions: { close: true } } } } } as Config,
				actionConfig,
			).performActions(payload("labeled", "label"), thread),
		).rejects.toThrow("Failed to close discussion");
	});

	it("reports label addition failures", async () => {
		client.graphql
			.mockResolvedValueOnce({ repository: { labels: { nodes: [{ id: "label-id", name: "triage" }] } } })
			.mockRejectedValueOnce(new Error("add failed"));

		await expect(
			new DiscussionHandler(
				{ labels: { add: { label: { discussions: { labels: { add: ["triage"] } } } } } } as Config,
				actionConfig,
			).performActions(payload("labeled", "label"), thread),
		).rejects.toThrow("Failed to add labels to discussion");
	});

	it("reports issue creation failures", async () => {
		client.rest.issues.create.mockRejectedValue(new Error("create failed"));

		await expect(
			new DiscussionHandler(
				{ labels: { add: { label: { discussions: { create_issue: true } } } } } as Config,
				actionConfig,
			).performActions(payload("labeled", "label"), thread),
		).rejects.toThrow("Failed to create issue from discussion");
	});
});
