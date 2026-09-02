import { describe, expect, it } from "bun:test";
import type Config from "@/models/internal/config";
import type Actions from "@/models/internal/config/actions";

describe("Config Inheritance", () => {
	describe("Config structure validation", () => {
		it("should support basic label actions with root-level properties", () => {
			const config: Config = {
				labels: {
					add: {
						bug: {
							comments: ["This is a bug report"],
						},
					},
				},
			};

			expect(config.labels?.add).toBeDefined();
			const bugAction = ((config.labels?.add ?? {}) as Record<string, Actions>).bug;
			expect(bugAction.comments).toEqual(["This is a bug report"]);
		});

		it("should support nested issue-specific properties", () => {
			const config: Config = {
				labels: {
					add: {
						bug: {
							comments: ["Root level comment"],
							issues: {
								assignees: {
									add: ["user1"],
								},
								close: true,
								close_reason: "not-planned",
								pin: true,
							},
						},
					},
				},
			};

			const bugAction = ((config.labels?.add ?? {}) as Record<string, Actions>).bug;
			expect(bugAction.comments).toEqual(["Root level comment"]);
			expect(bugAction.issues?.assignees?.add).toEqual(["user1"]);
			expect(bugAction.issues?.close).toBe(true);
			expect(bugAction.issues?.close_reason).toBe("not-planned");
			expect(bugAction.issues?.pin).toBe(true);
		});

		it("should support nested PR-specific properties", () => {
			const config: Config = {
				labels: {
					add: {
						"needs-review": {
							comments: ["Please review this PR"],
							prs: {
								reviewers: {
									add: ["reviewer1", "reviewer2"],
								},
								assignees: {
									add: ["assignee1"],
								},
								close: false,
								lock: false,
							},
						},
					},
				},
			};

			const action = ((config.labels?.add ?? {}) as Record<string, Actions>)["needs-review"];
			expect(action.prs?.reviewers?.add).toEqual(["reviewer1", "reviewer2"]);
			expect(action.prs?.assignees?.add).toEqual(["assignee1"]);
		});

		it("should support nested discussion-specific properties", () => {
			const config: Config = {
				labels: {
					add: {
						question: {
							discussions: {
								category: "Q&A",
								close: true,
								close_reason: "resolved",
								create_issue: false,
							},
						},
					},
				},
			};

			const action = ((config.labels?.add ?? {}) as Record<string, Actions>).question;
			expect(action.discussions?.category).toBe("Q&A");
			expect(action.discussions?.close).toBe(true);
			expect(action.discussions?.close_reason).toBe("resolved");
		});

		it("should support labels.remove configuration", () => {
			const config: Config = {
				labels: {
					remove: {
						wip: {
							comments: ["No longer WIP"],
							prs: {
								reviewers: {
									add: ["reviewer1"],
								},
							},
						},
					},
				},
			};

			expect(config.labels?.remove).toBeDefined();
			const wipAction = ((config.labels?.remove ?? {}) as Record<string, Actions>).wip;
			expect(wipAction.comments).toEqual(["No longer WIP"]);
			expect(wipAction.prs?.reviewers?.add).toEqual(["reviewer1"]);
		});

		it("should support labels.default configuration", () => {
			const config: Config = {
				labels: {
					default: {
						"*": {
							comments: ["Default comment"],
						},
					},
				},
			};

			expect(config.labels?.default).toBeDefined();
		});

		it("should support complex nested label structures", () => {
			const config: Config = {
				labels: {
					add: {
						security: {
							comments: ["Security issue detected"],
							labels: {
								add: ["high-priority", "needs-triage"],
							},
							issues: {
								assignees: {
									add: ["security-team"],
								},
								pin: true,
								labels: {
									add: ["verified"],
								},
							},
							prs: {
								reviewers: {
									add: ["security-reviewer"],
								},
								labels: {
									add: ["security-review"],
								},
							},
						},
					},
				},
			};

			const secAction = ((config.labels?.add ?? {}) as Record<string, Actions>).security;
			expect(secAction.labels?.add).toEqual(["high-priority", "needs-triage"]);
			expect(secAction.issues?.labels?.add).toEqual(["verified"]);
			expect(secAction.prs?.labels?.add).toEqual(["security-review"]);
		});
	});

	describe("Regex-based actions", () => {
		it("should support regex patterns with actions", () => {
			const config: Config = {
				regex: {
					"\\b(bug|error|crash)\\b": {
						comments: ["Detected potential bug"],
						labels: {
							add: ["potential-bug"],
						},
					},
				},
			};

			expect(config.regex).toBeDefined();
			const pattern = Object.keys(config.regex || {})[0];
			expect(pattern).toBe("\\b(bug|error|crash)\\b");
		});

		it("should support case sensitivity flag", () => {
			const config: Config = {
				caseSensitive: true,
				regex: {
					URGENT: {
						labels: {
							add: ["urgent"],
						},
					},
				},
			};

			expect(config.caseSensitive).toBe(true);
		});
	});

	describe("Property inheritance rules", () => {
		it("should allow root-level and thread-specific properties to coexist", () => {
			const config: Config = {
				labels: {
					add: {
						test: {
							comments: ["Root comment"],
							labels: {
								add: ["root-label"],
							},
							issues: {
								comments: ["Issue comment"],
								labels: {
									add: ["issue-label"],
								},
								assignees: {
									add: ["issue-assignee"],
								},
							},
						},
					},
				},
			};

			const action = ((config.labels?.add ?? {}) as Record<string, Actions>).test;
			expect(action.comments).toBeDefined();
			expect(action.labels?.add).toBeDefined();
			expect(action.issues?.comments).toBeDefined();
			expect(action.issues?.labels?.add).toBeDefined();
			expect(action.issues?.assignees?.add).toBeDefined();
		});

		it("should support multiple thread types in same action", () => {
			const config: Config = {
				labels: {
					add: {
						"multi-type": {
							comments: ["Applies to all types"],
							issues: {
								close: true,
							},
							prs: {
								close: false,
							},
							discussions: {
								category: "General",
							},
						},
					},
				},
			};

			const action = ((config.labels?.add ?? {}) as Record<string, Actions>)["multi-type"];
			expect(action.issues?.close).toBe(true);
			expect(action.prs?.close).toBe(false);
			expect(action.discussions?.category).toBe("General");
		});
	});

	describe("Edge cases", () => {
		it("should handle empty config", () => {
			const config: Config = {};
			expect(config).toBeDefined();
		});

		it("should handle labels as string arrays", () => {
			const config: Config = {
				labels: {
					add: ["label1", "label2"],
				},
			};

			expect(Array.isArray(config.labels?.add)).toBe(true);
		});

		it("should handle mixed label formats", () => {
			const config: Config = {
				labels: {
					add: {
						withActions: {
							comments: ["Has actions"],
						},
					},
					remove: ["simple-remove"],
				},
			};

			expect(config.labels?.add).toBeDefined();
			expect(config.labels?.remove).toBeDefined();
		});

		it("should support assignees and reviewers add/remove", () => {
			const config: Config = {
				labels: {
					add: {
						test: {
							issues: {
								assignees: {
									add: ["user1"],
									remove: ["user2"],
								},
							},
							prs: {
								reviewers: {
									add: ["reviewer1"],
									remove: ["reviewer2"],
								},
								assignees: {
									add: ["assignee1"],
									remove: ["assignee2"],
								},
							},
						},
					},
				},
			};

			const action = ((config.labels?.add ?? {}) as Record<string, Actions>).test;
			expect(action.issues?.assignees?.add).toEqual(["user1"]);
			expect(action.issues?.assignees?.remove).toEqual(["user2"]);
			expect(action.prs?.reviewers?.add).toEqual(["reviewer1"]);
			expect(action.prs?.reviewers?.remove).toEqual(["reviewer2"]);
		});

		it("should support milestones and projects", () => {
			const config: Config = {
				labels: {
					add: {
						milestone: {
							issues: {
								milestones: {
									add: ["v1.0"],
									remove: ["v0.9"],
								},
								projects: {
									add: ["Project A"],
									remove: ["Project B"],
								},
							},
						},
					},
				},
			};

			const action = ((config.labels?.add ?? {}) as Record<string, Actions>).milestone;
			expect(action.issues?.milestones?.add).toEqual(["v1.0"]);
			expect(action.issues?.projects?.add).toEqual(["Project A"]);
		});
	});
});
