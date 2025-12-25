import Joi, { type ObjectSchema } from "joi";
import commentsSchema from "@/schemas/comments";

const discussionsSchema: ObjectSchema = Joi.object({
	comments: commentsSchema,
	category: Joi.alternatives().try(
		Joi.string().trim(),
		Joi.object().pattern(
			Joi.string(),
			Joi.object({
				comments: commentsSchema,
			}).unknown(true),
		),
	),
	close: Joi.boolean(),
	reopen: Joi.boolean(),
	close_reason: Joi.string().valid("outdated", "duplicate", "resolved"),
	lock: Joi.boolean(),
	unlock: Joi.boolean(),
	lock_reason: Joi.string().valid("resolved", "off-topic", "too heated", "spam"),
	create_issue: Joi.boolean(),
}).unknown(true);

export default discussionsSchema;
