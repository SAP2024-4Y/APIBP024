export type DomainErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID_TOKEN'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'EVENT_NOT_FOUND'
  | 'VENUE_NOT_FOUND'
  | 'TICKET_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'BOOKING_CONFLICT'
  | 'EVENT_SOLD_OUT'
  | 'EVENT_CANCELLED'
  | 'TICKET_ALREADY_CANCELLED'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface DomainErrorDetail {
  httpStatus: number;
  message: string;
}

export const DOMAIN_ERRORS: Record<DomainErrorCode, DomainErrorDetail> = {
  AUTH_REQUIRED:            { httpStatus: 401, message: 'Authentication required.' },
  AUTH_INVALID_TOKEN:       { httpStatus: 401, message: 'Token is invalid or has expired.' },
  AUTH_INVALID_CREDENTIALS: { httpStatus: 401, message: 'Invalid username or password.' },
  FORBIDDEN:                { httpStatus: 403, message: 'You do not have permission to perform this action.' },
  EVENT_NOT_FOUND:          { httpStatus: 404, message: 'Event not found.' },
  VENUE_NOT_FOUND:          { httpStatus: 404, message: 'Venue not found.' },
  TICKET_NOT_FOUND:         { httpStatus: 404, message: 'Ticket not found.' },
  USER_NOT_FOUND:           { httpStatus: 404, message: 'User not found.' },
  BOOKING_CONFLICT:         { httpStatus: 409, message: 'A booking conflict was detected.' },
  EVENT_SOLD_OUT:           { httpStatus: 409, message: 'This event has no available seats.' },
  EVENT_CANCELLED:          { httpStatus: 409, message: 'Cannot book a ticket for a cancelled event.' },
  TICKET_ALREADY_CANCELLED: { httpStatus: 409, message: 'This ticket has already been cancelled.' },
  VALIDATION_ERROR:         { httpStatus: 422, message: 'Request validation failed.' },
  RATE_LIMITED:             { httpStatus: 429, message: 'Too many requests. Please slow down.' },
  INTERNAL_ERROR:           { httpStatus: 500, message: 'An unexpected internal error occurred.' },
};

export class AppError extends Error {
  public readonly code: DomainErrorCode;
  public readonly httpStatus: number;
  public readonly details?: unknown;

  constructor(code: DomainErrorCode, details?: unknown) {
    const info = DOMAIN_ERRORS[code];
    super(info.message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = info.httpStatus;
    this.details = details;
  }
}
