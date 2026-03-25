export class AuthRequiredError extends Error {
  constructor(message = 'Not connected. Use connect_account to sign in to your MyAlberta account.') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export class SessionExpiredError extends Error {
  constructor(message = 'Session expired. Use connect_account to sign in again.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export class ApiError extends Error {
  public statusCode: number;

  constructor(statusCode: number, message?: string) {
    const defaultMessages: Record<number, string> = {
      401: 'Session expired. Use connect_account to sign in again.',
      500: 'My Health Records is currently unavailable. Try again later.',
    };
    super(message ?? defaultMessages[statusCode] ?? `API error: ${statusCode}`);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

export class NetworkError extends Error {
  constructor(message = 'Could not reach My Health Records. Check your internet connection.') {
    super(message);
    this.name = 'NetworkError';
  }
}
