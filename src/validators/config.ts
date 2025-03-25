import configSchema from "@/schemas/config";
import type Config from "@/models/config";

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
class ConfigValidator {
	static get schemaKeys(): string[] {
		return Object.keys(configSchema.describe().keys);
	}

	static async validate(input: unknown): Promise<Config> {
		const validatedConfig = await configSchema.validateAsync(input, {
			abortEarly: false,
		});
		return validatedConfig as Config;
	}
}

export default ConfigValidator;
