import Joi, { StringSchema, Extension, type ObjectSchema } from "joi";

// Define a Joi extension for 'processOnly'
const extendedJoi: typeof Joi = Joi.extend({
	type: "processOnly",
	base: Joi.string(),
	coerce: {
		from: "string",
		method(value: string) {
			value = value.trim();
			if (["issues", "prs"].includes(value)) {
				value = value.slice(0, -1);
			}

			return { value };
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

	"process-only": (extendedJoi as any)
		.processOnly()
		.valid("issue", "pr", "")
		.default(""),
});

// Export the schema
export default configSchema;
