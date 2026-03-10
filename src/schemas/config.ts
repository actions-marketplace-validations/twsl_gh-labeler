import Joi, { type ObjectSchema } from "joi";
import actionsSchema from "@/schemas/actions";
import labelsSchema from "@/schemas/labels";
import issuesSchema from "@/schemas/issues";
import prsSchema from "@/schemas/prs";
import discussionsSchema from "@/schemas/discussions";

const configSchema: ObjectSchema = Joi.object({
  // Regex patterns with actions
  regex: Joi.object().pattern(Joi.string(), actionsSchema),

  // Case sensitivity and scan options for regex
  caseSensitive: Joi.boolean(),
  scanTitle: Joi.boolean(),
  scanBody: Joi.boolean(),

  // Labels configuration
  labels: labelsSchema,

  // Top-level issues, prs, discussions
  issues: issuesSchema,
  prs: prsSchema,
  discussions: discussionsSchema,
}).min(1);

export default configSchema;
