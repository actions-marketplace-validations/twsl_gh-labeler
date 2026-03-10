import Joi, { type ObjectSchema } from "joi";

const assigneesSchema: ObjectSchema = Joi.object({
	add: Joi.array().items(Joi.string().trim()),
	remove: Joi.array().items(Joi.string().trim()),
});

export default assigneesSchema;
