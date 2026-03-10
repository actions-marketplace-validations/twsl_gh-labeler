import Joi from "joi";

const commentsSchema = Joi.array()
  .items(Joi.string().trim().max(65536))
  .allow(null);

export default commentsSchema;
