import { jest } from "@jest/globals";
import type Joi from "joi";

export const mockValidationSuccess = {
	error: undefined,
	value: {
		"github-token": "test-token",
		"config-path": "./example/config.yaml",
		process: ["issues", "pr", "discussions"],
	},
};

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

export const mockSchemaValidate = jest.fn();

// Default export for the schema mock
export default {
	validate: mockSchemaValidate,
};
