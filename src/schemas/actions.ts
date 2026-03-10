import Joi, { type ObjectSchema } from "joi";
import commentsSchema from "@/schemas/comments";
import labelsPropertySchema from "@/schemas/labelsProperty";
import issuesSchema from "@/schemas/issues";
import prsSchema from "@/schemas/prs";
import discussionsSchema from "@/schemas/discussions";

const actionsSchema: ObjectSchema = Joi.object({
  comments: commentsSchema,
  labels: labelsPropertySchema,
  issues: issuesSchema,
  prs: prsSchema,
  discussions: discussionsSchema,
  lock: Joi.boolean(),
  unlock: Joi.boolean(),
  lock_reason: Joi.string().valid(
    "resolved",
    "off-topic",
    "too heated",
    "spam",
  ),
}).unknown(true);

export default actionsSchema;
