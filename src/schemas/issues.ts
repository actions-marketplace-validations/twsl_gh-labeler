import Joi, { type ObjectSchema } from "joi";
import commentsSchema from "@/schemas/comments";
import assigneesSchema from "@/schemas/assignees";
import reviewersSchema from "@/schemas/reviewers";
import labelsPropertySchema from "@/schemas/labelsProperty";

const issuesSchema: ObjectSchema = Joi.object({
	comments: commentsSchema,
	assignees: assigneesSchema,
	reviewers: reviewersSchema,
	close: Joi.boolean(),
	close_reason: Joi.string().valid("not-planned", "duplicate"),
	reopen: Joi.boolean(),
	lock: Joi.boolean(),
	unlock: Joi.boolean(),
	lock_reason: Joi.string().valid("resolved", "off-topic", "too heated", "spam"),
	convert_to_discussion: Joi.boolean(),
	pin: Joi.boolean(),
	unpin: Joi.boolean(),
	milestones: Joi.object({
		add: Joi.array().items(Joi.string().trim()),
		remove: Joi.array().items(Joi.string().trim()),
	}),
	projects: Joi.object({
		add: Joi.array().items(Joi.string().trim()),
		remove: Joi.array().items(Joi.string().trim()),
	}),
	labels: labelsPropertySchema,
}).unknown(true);

export default issuesSchema;
