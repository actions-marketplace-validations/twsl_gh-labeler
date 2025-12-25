import { jest } from "@jest/globals";

export const mockValidationSuccess = {
	error: undefined,
	value: {
		"github-token": "test-token",
		"config-path": "./example/config.yaml",
		process: ["issue", "pr", "discussion"],
	},
};

export const createMockValidationSuccess = (overrides?: Partial<{
	"github-token": string;
	"config-path": string;
	process: Array<"issue" | "pr" | "discussion">;
}>) => ({
	error: undefined,
	value: {
		"github-token": "test-token",
		"config-path": ".github/gh-labeler.yaml",
		process: ["issue", "pr", "discussion"] as Array<"issue" | "pr" | "discussion">,
		...overrides,
	},
});

export const mockValidationError = {
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

// Create a smart mock that applies schema defaults
export const mockSchemaValidate = jest.fn((input: any, _options?: any) => {
	// Apply schema defaults for undefined/empty values
	const result = {
		...input,
		"config-path": input["config-path"] || ".github/gh-labeler.yaml",
		process: input.process && input.process.length > 0 ? input.process : ["issue", "pr", "discussion"],
	};
	
	return {
		error: undefined,
		value: result,
	};
});

// Default export for the schema mock
export default {
	validate: mockSchemaValidate,
};
