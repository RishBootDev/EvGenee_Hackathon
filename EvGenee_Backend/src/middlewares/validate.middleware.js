const { validationResult } = require('express-validator');


const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map((err) => ({
            field: err.path,
            message: err.msg,
            value: err.value,
        }));

        return res.status(422).json({
            success: false,
            message: 'Validation failed',
            errors: formattedErrors,
        });
    }

    next();
};

module.exports = { handleValidationErrors };
