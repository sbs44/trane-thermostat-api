/**
 * HTTP utility functions for API communication
 * Provides common HTTP operations and response handling
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import {
  ApiError,
  HttpError,
  NetworkError,
  TimeoutError,
  AuthenticationError,
  ErrorFactory
} from './errors';
import { HTTP_STATUS, API_HEADERS } from '../types/constants';

export interface HttpClientOptions {
  baseURL: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

export interface ETagCacheEntry {
  etag: string;
  data: any;
  timestamp: number;
}

export interface HttpResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  etag?: string;
}

export class HttpClient {
  private axiosInstance: AxiosInstance;
  private etagCache: Map<string, ETagCacheEntry> = new Map();
  private readonly retryAttempts: number;
  private readonly retryDelay: number;

  constructor(options: HttpClientOptions) {
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;

    this.axiosInstance = axios.create({
      baseURL: options.baseURL,
      timeout: options.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'trane-thermostat-api/1.0.0',
        ...options.headers
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for logging and headers
    this.axiosInstance.interceptors.request.use(
      (config) => {
        return config;
      },
      (error) => {
        return Promise.reject(this.handleError(error));
      }
    );

    // Response interceptor for error handling and caching
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.handleSuccessResponse(response);
        return response;
      },
      (error) => {
        return Promise.reject(this.handleError(error));
      }
    );
  }

  private handleSuccessResponse(response: AxiosResponse): void {
    // Cache ETag responses
    const etag = response.headers['etag'];
    if (etag && response.config.url) {
      this.etagCache.set(response.config.url, {
        etag,
        data: response.data,
        timestamp: Date.now()
      });
    }
  }

  private handleError(error: any): ApiError {
    if (axios.isAxiosError(error)) {
      return this.handleAxiosError(error);
    }

    if (error instanceof Error) {
      return new NetworkError(`Network error: ${error.message}`, error);
    }

    return new ApiError('Unknown error occurred');
  }

  private handleAxiosError(error: AxiosError): ApiError {
    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      const timeout = error.config?.timeout || 30000;
      return new TimeoutError(`Request timed out after ${timeout}ms`, timeout);
    }

    // Handle network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new NetworkError(`Network error: ${error.message}`, error);
    }

    // Handle HTTP error responses
    if (error.response) {
      const { status, data } = error.response;

      // Handle authentication errors
      if (status === HTTP_STATUS.UNAUTHORIZED) {
        return new AuthenticationError('Authentication failed or session expired');
      }

      // Create appropriate HTTP error
      return ErrorFactory.createHttpError(status, error.message, data);
    }

    // Handle request errors (no response received)
    return new NetworkError(`Request failed: ${error.message}`, error);
  }

  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<HttpResponse<T>> {
    return this.makeRequest<T>('GET', url, undefined, config);
  }

  public async post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<HttpResponse<T>> {
    return this.makeRequest<T>('POST', url, data, config);
  }

  public async put<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<HttpResponse<T>> {
    return this.makeRequest<T>('PUT', url, data, config);
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<HttpResponse<T>> {
    return this.makeRequest<T>('DELETE', url, undefined, config);
  }

  public async getWithETag<T>(url: string, config?: AxiosRequestConfig): Promise<{
    data: T;
    status: number;
    headers: Record<string, string>;
    fromCache: boolean;
  }> {
    const cacheEntry = this.etagCache.get(url);
    const requestConfig = { ...config };

    // Add If-None-Match header if we have a cached ETag
    if (cacheEntry) {
      requestConfig.headers = {
        ...requestConfig.headers,
        [API_HEADERS.IF_NONE_MATCH]: cacheEntry.etag
      };
    }

    try {
      const response = await this.get<T>(url, requestConfig);
      return {
        data: response.data,
        status: response.status,
        headers: response.headers,
        fromCache: false
      };
    } catch (error) {
      // Handle 304 Not Modified
      if (error instanceof HttpError && error.statusCode === HTTP_STATUS.NOT_MODIFIED && cacheEntry) {
        return {
          data: cacheEntry.data,
          status: HTTP_STATUS.NOT_MODIFIED,
          headers: {},
          fromCache: true
        };
      }
      throw error;
    }
  }

  private async makeRequest<T>(
    method: string,
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<HttpResponse<T>> {
    const requestConfig: AxiosRequestConfig = {
      method,
      url,
      data,
      ...config
    };

    let lastError: ApiError;

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.axiosInstance.request<T>(requestConfig);

        return {
          data: response.data,
          status: response.status,
          headers: response.headers as Record<string, string>,
          etag: response.headers['etag']
        };
      } catch (error) {
        lastError = this.handleError(error);

        // Don't retry on authentication errors or client errors (4xx)
        if (
          lastError instanceof AuthenticationError ||
          (lastError instanceof HttpError && lastError.statusCode && lastError.statusCode < 500)
        ) {
          throw lastError;
        }

        // Don't retry on last attempt
        if (attempt === this.retryAttempts) {
          throw lastError;
        }

        // Wait before retrying
        await this.delay(this.calculateRetryDelay(attempt));
      }
    }

    throw lastError!;
  }

  private calculateRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.retryDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000;
    return Math.min(baseDelay + jitter, 30000); // Cap at 30 seconds
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public setAuthHeaders(apiKey: string, mobileId: string, brand: string): void {
    this.axiosInstance.defaults.headers[API_HEADERS.API_KEY] = apiKey;
    this.axiosInstance.defaults.headers[API_HEADERS.MOBILE_ID] = mobileId;
    this.axiosInstance.defaults.headers[API_HEADERS.ASSOCIATED_BRAND] = brand;
    this.axiosInstance.defaults.headers[API_HEADERS.APP_VERSION] = '6.0.0';
  }

  public clearAuthHeaders(): void {
    delete this.axiosInstance.defaults.headers[API_HEADERS.API_KEY];
    delete this.axiosInstance.defaults.headers[API_HEADERS.MOBILE_ID];
    delete this.axiosInstance.defaults.headers[API_HEADERS.ASSOCIATED_BRAND];
  }

  public clearETagCache(): void {
    this.etagCache.clear();
  }

  public removeFromETagCache(url: string): void {
    this.etagCache.delete(url);
  }

  public updateBaseURL(baseURL: string): void {
    this.axiosInstance.defaults.baseURL = baseURL;
  }

  public getBaseURL(): string | undefined {
    return this.axiosInstance.defaults.baseURL;
  }
}

// Utility functions for common HTTP operations
export class HttpUtils {
  /**
   * Builds query string from object
   */
  public static buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  /**
   * Joins URL parts safely
   */
  public static joinUrls(...parts: string[]): string {
    return parts
      .map((part, index) => {
        // Remove leading slash from all but the first part
        if (index > 0 && part.startsWith('/')) {
          part = part.slice(1);
        }
        // Remove trailing slash from all but the last part
        if (index < parts.length - 1 && part.endsWith('/')) {
          part = part.slice(0, -1);
        }
        return part;
      })
      .filter(part => part.length > 0)
      .join('/');
  }

  /**
   * Validates URL format
   */
  public static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extracts error message from response
   */
  public static extractErrorMessage(response: any): string {
    if (typeof response === 'string') {
      return response;
    }

    if (response?.message) {
      return response.message;
    }

    if (response?.error) {
      if (typeof response.error === 'string') {
        return response.error;
      }
      if (response.error.message) {
        return response.error.message;
      }
    }

    if (response?.errors && Array.isArray(response.errors) && response.errors.length > 0) {
      return response.errors[0].message || response.errors[0];
    }

    return 'Unknown error occurred';
  }

  /**
   * Creates form data from object
   */
  public static createFormData(data: Record<string, any>): FormData {
    const formData = new FormData();

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (value instanceof File || value instanceof Blob) {
          formData.append(key, value);
        } else if (typeof value === 'object') {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      }
    });

    return formData;
  }

  /**
   * Safely parses JSON response
   */
  public static safeJsonParse<T>(data: any, fallback?: T): T | undefined {
    if (typeof data === 'object' && data !== null) {
      return data as T;
    }

    if (typeof data === 'string') {
      try {
        return JSON.parse(data) as T;
      } catch {
        return fallback;
      }
    }

    return fallback;
  }
}

// Default HTTP client instance factory
export function createHttpClient(options: HttpClientOptions): HttpClient {
  return new HttpClient(options);
}
