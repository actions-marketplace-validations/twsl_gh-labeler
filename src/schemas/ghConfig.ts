import Joi, { type ObjectSchema } from "joi";

// Define the configuration schema
const ghConfigSchema: ObjectSchema = Joi.object({
	"github-token": Joi.string().trim().max(100),

	path: Joi.string().trim().max(200).default(".github/gh-labeler.yaml"),

	process: Joi.array()
		.items(Joi.string().trim().valid("issue", "pr", "discussion"))
		.min(1)
		.max(3)
		.unique()
		.default(["issue", "pr", "discussion"]),
});

// Export the schema
export default ghConfigSchema;
