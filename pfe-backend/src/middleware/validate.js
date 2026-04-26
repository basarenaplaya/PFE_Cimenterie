const { HttpError } = require("../utils/httpError");

function createValidator(schema, sourceKey, targetKey) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[sourceKey], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      return next(
        new HttpError(
          400,
          "Validation failed.",
          error.details.map((detail) => detail.message)
        )
      );
    }

    req[targetKey] = value;
    return next();
  };
}

function validateBody(schema) {
  return createValidator(schema, "body", "validatedBody");
}

function validateQuery(schema) {
  return createValidator(schema, "query", "validatedQuery");
}

function validateParams(schema) {
  return createValidator(schema, "params", "validatedParams");
}

module.exports = { validateBody, validateQuery, validateParams };
