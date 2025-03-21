import actionSchema from "@/schemas/action";
import { ValidationError, AnySchema } from "joi";

export default class ActionValidator {
	/**
	 * Validates the input against the action schema.
	 * @param input - The input object to be validated.
	 * @returns A promise that resolves to the validated configuration.
	 * @throws ValidationError if the input does not conform to the schema.
	 */
	static async validate(input: unknown): Promise<Record<string, any>> {
		try {
			const validatedConfig = await actionSchema.validateAsync(input, {
				abortEarly: false, // Collect all errors instead of aborting on the first one
			});
			return validatedConfig;
		} catch (error) {
			if (error instanceof ValidationError) {
				// Add type guard for Joi validation errors if necessary
				throw error;
			}
			throw new Error("An unexpected error occurred during schema validation");
		}
	}
}
