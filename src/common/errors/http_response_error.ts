export default class HTTPResponseError extends Error {
  public response: any;
  constructor(response) {
    super(`HTTP Error Response: ${response.status} ${response.statusText}`);
    this.response = response;
  }
}
