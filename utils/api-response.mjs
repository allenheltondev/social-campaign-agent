export const formatResponse = (statusCode, body) => {
  const response = {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  };

  if (statusCode === 204 && body === undefined) {
    return response;
  }

  if (body !== undefined && body !== null) {
    response.body = typeof body === 'string' ? body : JSON.stringify(body);
  } else if (body === null || body === undefined) {
    return response;
  }

  return response;
};
