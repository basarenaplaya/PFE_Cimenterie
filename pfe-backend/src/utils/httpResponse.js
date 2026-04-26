function sendSuccess(res, { status = 200, data = {}, meta = undefined, message = undefined } = {}) {
  const payload = {
    success: true,
    data,
  };

  if (message) {
    payload.message = message;
  }

  if (meta) {
    payload.meta = meta;
  }

  return res.status(status).json(payload);
}

module.exports = {
  sendSuccess,
};
