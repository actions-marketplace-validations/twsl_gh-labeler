import Joi, { type ObjectSchema } from "joi";
import actionsSchema from "@/schemas/actions";

const labelsSchema: ObjectSchema = Joi.object({
	add: Joi.alternatives().try(
		Joi.array().items(Joi.string().trim()),
		Joi.object().pattern(Joi.string(), actionsSchema),
	),
	remove: Joi.alternatives().try(
		Joi.array().items(Joi.string().trim()),
		Joi.object().pattern(Joi.string(), actionsSchema),
	),
	default: Joi.object().pattern(Joi.string(), actionsSchema),
});

export default labelsSchema;
