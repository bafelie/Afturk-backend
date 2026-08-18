// Wraps async route handlers so thrown errors reach errorHandler middleware
// instead of crashing the process or needing try/catch in every controller.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
