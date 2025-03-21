import configSchema from "@/schemas/config";

class ConfigValidator {
	static get schemaKeys(): string[] {
		return Object.keys(configSchema.describe().keys);
	}

	static async validate(input: unknown): Promise<unknown> {
		const validatedConfig = await configSchema.validateAsync(input, {
			abortEarly: false,
		});
		return validatedConfig;
	}
}

export default ConfigValidator;
