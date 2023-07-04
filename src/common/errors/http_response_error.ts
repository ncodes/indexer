export default class HTTPResponseError extends Error {
  public response: any;
  constructor(response) {
    super(`HTTP Error Response: ${response.status} ${response.statusText}`);
    this.response = response;
  }
}

export const checkFetchStatus = (response) => {
  if (response.ok) {
    return response;
  } else {
    throw new HTTPResponseError(response);
  }
};
