/**
 * Custom error classes for the Nexia library
 * Provides structured error handling with specific error types
 */

// Base error class for all Nexia-related errors
export class NexiaError extends Error {
  public code: string;
  public readonly timestamp: Date;

  constructor(message: string, code: string = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'NexiaError';
    this.code = code;
    this.timestamp = new Date();

    // Maintain proper stack trace for V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NexiaError);
    }
  }
}

// Authentication and authorization errors
export class AuthenticationError extends NexiaError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

// Rate limiting error for login attempts
export class RateLimitError extends AuthenticationError {
  public readonly retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
    this.code = 'RATE_LIMIT';
    this.retryAfter = retryAfter;
  }
}

// Session expired error
export class SessionExpiredError extends AuthenticationError {
  constructor(message: string = 'Session has expired') {
    super(message);
    this.name = 'SessionExpiredError';
    this.code = 'SESSION_EXPIRED';
  }
}

// Parameter validation errors
export class ValidationError extends NexiaError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(message: string, field?: string, value?: unknown) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

// Temperature validation specific error
export class TemperatureValidationError extends ValidationError {
  public readonly unit?: string;
  public readonly limits?: { min: number; max: number };

  constructor(
    message: string,
    field?: string,
    value?: number,
    unit?: string,
    limits?: { min: number; max: number }
  ) {
    super(message, field, value);
    this.name = 'TemperatureValidationError';
    this.code = 'TEMP_VALIDATION';
    this.unit = unit;
    this.limits = limits;
  }
}

// Deadband validation error
export class DeadbandValidationError extends ValidationError {
  public readonly deadband: number;
  public readonly heatTemp: number;
  public readonly coolTemp: number;

  constructor(
    message: string,
    deadband: number,
    heatTemp: number,
    coolTemp: number
  ) {
    super(message, 'deadband', { deadband, heatTemp, coolTemp });
    this.name = 'DeadbandValidationError';
    this.code = 'DEADBAND_ERROR';
    this.deadband = deadband;
    this.heatTemp = heatTemp;
    this.coolTemp = coolTemp;
  }
}

// API communication errors
export class ApiError extends NexiaError {
  public readonly statusCode?: number;
  public readonly response?: unknown;

  constructor(message: string, statusCode?: number, response?: unknown) {
    super(message, 'API_ERROR');
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

// HTTP-specific errors
export class HttpError extends ApiError {
  constructor(message: string, statusCode: number, response?: unknown) {
    super(message, statusCode, response);
    this.name = 'HttpError';
    this.code = `HTTP_${statusCode}`;
  }
}

// Network connectivity errors
export class NetworkError extends NexiaError {
  public readonly originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

// Timeout errors
export class TimeoutError extends NetworkError {
  public readonly timeout: number;

  constructor(message: string, timeout: number) {
    super(message);
    this.name = 'TimeoutError';
    this.code = 'TIMEOUT';
    this.timeout = timeout;
  }
}

// Device not found errors
export class DeviceNotFoundError extends NexiaError {
  public readonly deviceId: string;
  public readonly deviceType: string;

  constructor(message: string, deviceId: string, deviceType: string = 'device') {
    super(message, 'DEVICE_NOT_FOUND');
    this.name = 'DeviceNotFoundError';
    this.deviceId = deviceId;
    this.deviceType = deviceType;
  }
}

// Feature not supported errors
export class FeatureNotSupportedError extends NexiaError {
  public readonly feature: string;
  public readonly deviceModel?: string;

  constructor(feature: string, deviceModel?: string) {
    const message = deviceModel
      ? `Feature '${feature}' is not supported on device model '${deviceModel}'`
      : `Feature '${feature}' is not supported`;
    super(message, 'FEATURE_NOT_SUPPORTED');
    this.name = 'FeatureNotSupportedError';
    this.feature = feature;
    this.deviceModel = deviceModel;
  }
}

// Operation not allowed errors
export class OperationNotAllowedError extends NexiaError {
  public readonly operation: string;
  public readonly reason?: string;

  constructor(operation: string, reason?: string) {
    const message = reason
      ? `Operation '${operation}' is not allowed: ${reason}`
      : `Operation '${operation}' is not allowed`;
    super(message, 'OPERATION_NOT_ALLOWED');
    this.name = 'OperationNotAllowedError';
    this.operation = operation;
    this.reason = reason;
  }
}

// Configuration errors
export class ConfigurationError extends NexiaError {
  public readonly configField?: string;

  constructor(message: string, configField?: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigurationError';
    this.configField = configField;
  }
}

// Parsing errors for API responses
export class ParseError extends NexiaError {
  public readonly data?: unknown;

  constructor(message: string, data?: unknown) {
    super(message, 'PARSE_ERROR');
    this.name = 'ParseError';
    this.data = data;
  }
}

// Error factory for common error creation
export class ErrorFactory {
  static createHttpError(statusCode: number, message?: string, response?: unknown): HttpError {
    const defaultMessage = this.getHttpStatusMessage(statusCode);
    return new HttpError(message || defaultMessage, statusCode, response);
  }

  static createValidationError(field: string, value: unknown, expected: string): ValidationError {
    const message = `Invalid value for '${field}': got ${JSON.stringify(value)}, expected ${expected}`;
    return new ValidationError(message, field, value);
  }

  static createTemperatureError(
    temperature: number,
    unit: string,
    min: number,
    max: number
  ): TemperatureValidationError {
    const message = `Temperature ${temperature}°${unit} is outside valid range (${min}°${unit} - ${max}°${unit})`;
    return new TemperatureValidationError(
      message,
      'temperature',
      temperature,
      unit,
      { min, max }
    );
  }

  static createDeadbandError(
    heatTemp: number,
    coolTemp: number,
    deadband: number,
    unit: string
  ): DeadbandValidationError {
    const diff = coolTemp - heatTemp;
    const message = `Temperature difference (${diff}°${unit}) is less than required deadband (${deadband}°${unit})`;
    return new DeadbandValidationError(message, deadband, heatTemp, coolTemp);
  }

  private static getHttpStatusMessage(statusCode: number): string {
    const statusMessages: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout'
    };

    return statusMessages[statusCode] || `HTTP Error ${statusCode}`;
  }
}

// Type guard functions
export function isNexiaError(error: unknown): error is NexiaError {
  return error instanceof NexiaError;
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

// Error handler utility
export class ErrorHandler {
  static handle(error: unknown): NexiaError {
    if (isNexiaError(error)) {
      return error;
    }

    if (error instanceof Error) {
      // Convert generic errors to NexiaError
      return new NexiaError(error.message, 'UNKNOWN_ERROR');
    }

    // Handle string errors
    if (typeof error === 'string') {
      return new NexiaError(error, 'UNKNOWN_ERROR');
    }

    // Handle unknown error types
    return new NexiaError('An unknown error occurred', 'UNKNOWN_ERROR');
  }

  static isRetryable(error: NexiaError): boolean {
    // Network errors and specific HTTP errors are generally retryable
    return (
      isNetworkError(error) ||
      (isApiError(error) && error.statusCode !== undefined && error.statusCode >= 500) ||
      error instanceof SessionExpiredError
    );
  }

  static getRetryDelay(attempt: number, baseDelay: number = 1000): number {
    // Exponential backoff with jitter
    const delay = Math.min(baseDelay * Math.pow(2, attempt), 30000);
    return delay + Math.random() * 1000;
  }
}
