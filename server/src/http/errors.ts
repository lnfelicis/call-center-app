export type HttpErrorBody = { message: string } | { code: string; message: string };

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: HttpErrorBody,
  ) {
    super(body.message);
    this.name = "HttpError";
  }
}
