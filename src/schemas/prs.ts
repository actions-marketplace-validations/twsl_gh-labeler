import Joi, { type ObjectSchema } from "joi";
import commentsSchema from "@/schemas/comments";
import reviewersSchema from "@/schemas/reviewers";
import assigneesSchema from "@/schemas/assignees";
import labelsPropertySchema from "@/schemas/labelsProperty";

const prsSchema: ObjectSchema = Joi.object({
  comments: commentsSchema,
  reviewers: reviewersSchema,
  assignees: assigneesSchema,
  close: Joi.boolean(),
  reopen: Joi.boolean(),
  lock: Joi.boolean(),
  unlock: Joi.boolean(),
  lock_reason: Joi.string().valid(
    "resolved",
    "off-topic",
    "too heated",
    "spam",
  ),
  draft: Joi.boolean(),
  request_changes: Joi.boolean(),
  approve: Joi.boolean(),
  labels: labelsPropertySchema,
}).unknown(true);

export default prsSchema;
