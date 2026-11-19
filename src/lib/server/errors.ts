export type DomainErrorCode = 'NOT_FOUND' | 'CONFLICT' | 'BAD_REQUEST' | 'FORBIDDEN';

/** Error de negocio con un mensaje apto para mostrarse al usuario. */
export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
