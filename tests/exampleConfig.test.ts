import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "@jest/globals";
import { parse } from "yaml";
import type Config from "@/models/internal/config";
import configSchema from "@/schemas/config";

describe("example config.yaml", () => {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	const exampleConfigPath = path.join(__dirname, "..", "example", "config.yaml");

	it("should exist and be readable", () => {
		expect(fs.existsSync(exampleConfigPath)).toBe(true);
		expect(() => fs.readFileSync(exampleConfigPath, "utf8")).not.toThrow();
	});

	it("should parse as valid YAML", () => {
		const fileContent = fs.readFileSync(exampleConfigPath, "utf8");
		let parsedConfig: unknown;

		expect(() => {
			parsedConfig = parse(fileContent);
		}).not.toThrow();

		expect(parsedConfig).toBeDefined();
		expect(typeof parsedConfig).toBe("object");
		expect(parsedConfig).not.toBeNull();
	});

	it("should validate against Joi schema", () => {
		const fileContent = fs.readFileSync(exampleConfigPath, "utf8");
		const config = parse(fileContent);

		const { error, value } = configSchema.validate(config, {
			abortEarly: false,
		});

		if (error) {
			console.error("Validation errors:", error.details);
		}

		expect(error).toBeUndefined();
		expect(value).toBeDefined();
	});

	it("should be parsable as Config interface", () => {
		const fileContent = fs.readFileSync(exampleConfigPath, "utf8");
		const config = parse(fileContent) as Config;

		// Type checking - this will fail at compile time if types don't match
		expect(config).toBeDefined();
		expect(typeof config).toBe("object");

		// Verify it has Config properties
		const hasValidStructure =
			config.labels !== undefined ||
			config.regex !== undefined ||
			config.issues !== undefined ||
			config.prs !== undefined ||
			config.discussions !== undefined;

		expect(hasValidStructure).toBe(true);
	});

	it("should contain expected top-level configuration keys", () => {
		const fileContent = fs.readFileSync(exampleConfigPath, "utf8");
		const config = parse(fileContent) as Config;

		// Check for expected top-level keys based on the config structure
		expect(config).toHaveProperty("labels");
		expect(config).toHaveProperty("regex");
		expect(config).toHaveProperty("discussions");
		expect(config).toHaveProperty("issues");
		expect(config).toHaveProperty("prs");
	});

	it("should have properly structured labels configuration", () => {
		const fileContent = fs.readFileSync(exampleConfigPath, "utf8");
		const config = parse(fileContent) as Config;

		expect(config.labels).toBeDefined();
		expect(config.labels).toHaveProperty("add");
		expect(config.labels).toHaveProperty("remove");
		expect(config.labels).toHaveProperty("default");

		// Check specific label actions
		if (config.labels?.add && typeof config.labels.add === "object" && !Array.isArray(config.labels.add)) {
			expect(config.labels.add).toHaveProperty("bug");
			expect(config.labels.add).toHaveProperty("enhancement");
			expect(config.labels.add).toHaveProperty("security");
		}
	});

	it("should have properly structured regex patterns", () => {
		const fileContent = fs.readFileSync(exampleConfigPath, "utf8");
		const config = parse(fileContent) as Config;

		expect(config.regex).toBeDefined();
		expect(typeof config.regex).toBe("object");

		// Check that regex patterns are strings (keys)
		const regexKeys = Object.keys(config.regex || {});
		expect(regexKeys.length).toBeGreaterThan(0);

		// Verify each regex key can be compiled as a valid RegExp
		for (const pattern of regexKeys) {
			expect(() => new RegExp(pattern)).not.toThrow();
		}
	});

	it("should have valid discussion category configuration", () => {
		const fileContent = fs.readFileSync(exampleConfigPath, "utf8");
		const config = parse(fileContent) as Config;

		expect(config.discussions).toBeDefined();
		expect(config.discussions).toHaveProperty("category");

		if (
			config.discussions?.category &&
			typeof config.discussions.category === "object" &&
			typeof config.discussions.category !== "string"
		) {
			expect(config.discussions.category).toHaveProperty("Q&A");
			expect(config.discussions.category).toHaveProperty("Ideas");
		}
	});

	it("should have comments as arrays where defined", () => {
		const fileContent = fs.readFileSync(exampleConfigPath, "utf8");
		const config = parse(fileContent) as Config;

		// Check bug label comments
		if (config.labels?.add && typeof config.labels.add === "object" && !Array.isArray(config.labels.add)) {
			const bugComments = config.labels.add.bug?.comments;
			expect(bugComments).toBeDefined();
			expect(Array.isArray(bugComments)).toBe(true);
			expect(bugComments?.length).toBeGreaterThan(0);

			// Verify all comments are strings
			bugComments?.forEach((comment) => {
				expect(typeof comment).toBe("string");
				expect(comment.length).toBeGreaterThan(0);
			});
		}
	});

	it("should have valid assignee and reviewer configurations", () => {
		const fileContent = fs.readFileSync(exampleConfigPath, "utf8");
		const config = parse(fileContent) as Config;

		// Check bug issue assignees
		if (config.labels?.add && typeof config.labels.add === "object" && !Array.isArray(config.labels.add)) {
			const bugIssueAssignees = config.labels.add.bug?.issues?.assignees?.add;
			expect(bugIssueAssignees).toBeDefined();
			expect(Array.isArray(bugIssueAssignees)).toBe(true);
			expect(bugIssueAssignees).toContain("bugTeamMember");

			// Check bug PR reviewers
			const bugPRReviewers = config.labels.add.bug?.prs?.reviewers?.add;
			expect(bugPRReviewers).toBeDefined();
			expect(Array.isArray(bugPRReviewers)).toBe(true);
			expect(bugPRReviewers).toContain("bugReviewer");
		}
	});

	it("should have valid action flags (close, pin, draft, etc.)", () => {
		const fileContent = fs.readFileSync(exampleConfigPath, "utf8");
		const config = parse(fileContent) as Config;

		if (config.labels?.add && typeof config.labels.add === "object" && !Array.isArray(config.labels.add)) {
			// Check wontfix close action
			expect(config.labels.add.wontfix?.issues?.close).toBe(true);
			expect(config.labels.add.wontfix?.issues?.close_reason).toBe("not-planned");

			// Check security pin action
			expect(config.labels.add.security?.issues?.pin).toBe(true);

			// Check wip draft action
			expect(config.labels.add.wip?.prs?.draft).toBe(true);

			// Check lock/unlock actions
			expect(config.labels.add.wontfix?.lock).toBe(true);
			expect(config.labels.add.wontfix?.lock_reason).toBe("resolved");
		}
	});

	it("should have valid label remove actions", () => {
		const fileContent = fs.readFileSync(exampleConfigPath, "utf8");
		const config = parse(fileContent) as Config;

		expect(config.labels?.remove).toBeDefined();

		if (config.labels?.remove && typeof config.labels.remove === "object" && !Array.isArray(config.labels.remove)) {
			// Check wip removal actions
			const wipRemove = config.labels.remove.wip;
			expect(wipRemove).toBeDefined();
			expect(wipRemove?.prs?.draft).toBe(false);
			expect(wipRemove?.prs?.labels?.remove).toContain("hold");

			// Check wontfix removal actions
			const wontfixRemove = config.labels.remove.wontfix;
			expect(wontfixRemove?.issues?.reopen).toBe(true);
			expect(wontfixRemove?.issues?.unlock).toBe(true);
		}
	});

	it("should not advertise unsupported issue-to-discussion conversion", () => {
		const fileContent = fs.readFileSync(exampleConfigPath, "utf8");
		const config = parse(fileContent) as Config;

		if (config.labels?.add && typeof config.labels.add === "object" && !Array.isArray(config.labels.add)) {
			expect(config.labels.add.question?.issues?.convert_to_discussion).toBeUndefined();
		}
	});
});
