import Joi, { type ObjectSchema } from "joi";

const labelsPropertySchema: ObjectSchema = Joi.object({
	add: Joi.array().items(Joi.string().trim().max(50)),
	remove: Joi.array().items(Joi.string().trim().max(50)),
});

export default labelsPropertySchema;
