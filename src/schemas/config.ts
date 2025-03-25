import Joi, { type ObjectSchema } from "joi";

// Define a Joi extension for 'processOnly'
const extendedJoi: typeof Joi = Joi.extend({
	type: "processOnly",
	base: Joi.string(),
	coerce: {
		from: "string",
		method(value: string) {
			const trimmed = value.trim();
			let new_value = "";
			if (["issues", "prs"].includes(trimmed)) {
				new_value = trimmed.slice(0, -1);
			} else {
				new_value = trimmed;
			}

			return { value: new_value };
		},
	},
}) as typeof Joi;

// Define the configuration schema
const configSchema: ObjectSchema = Joi.object({
	"github-token": Joi.string().trim().max(100),

	"config-path": Joi.string()
		.trim()
		.max(200)
		.default(".github/label-actions.yml"),

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	"process-only": (extendedJoi as any)
		.processOnly()
		.valid("issue", "pr", "")
		.default(""),
});

// Export the schema
export default configSchema;
