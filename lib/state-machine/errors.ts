export class DomainError extends Error {
  readonly code:
    | 'UNAUTHORIZED'
    | 'INVALID_TRANSITION'
    | 'PRECONDITION_FAILED'
    | 'NOT_FOUND'
    | 'CONFLICT';

  constructor(
    code:
      | 'UNAUTHORIZED'
      | 'INVALID_TRANSITION'
      | 'PRECONDITION_FAILED'
      | 'NOT_FOUND'
      | 'CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}
