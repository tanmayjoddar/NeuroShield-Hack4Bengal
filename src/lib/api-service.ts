// Centralized API Service for Wallet Application
// Provides consistent error handling, retry logic, and request/response processing

import {
  ApiError,
  createApiError,
  calculateRetryDelay,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
} from "./api-errors";

export interface ApiRequestConfig {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retryConfig?: Partial<RetryConfig>;
  skipRetry?: boolean;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Headers;
}

class ApiService {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private defaultTimeout: number;

  constructor(baseURL: string = "/api") {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      "Content-Type": "application/json",
    };
    this.defaultTimeout = 10000; // 10 seconds
  }

  /**
   * Makes an HTTP request with automatic retry and error handling
   */
  async request<T = any>(
    endpoint: string,
    config: ApiRequestConfig = {},
  ): Promise<ApiResponse<T>> {
    const {
      method = "GET",
      headers = {},
      body,
      timeout = this.defaultTimeout,
      retryConfig = {},
      skipRetry = false,
    } = config;

    const finalRetryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    const url = `${this.baseURL}${endpoint}`;

    const requestHeaders = {
      ...this.defaultHeaders,
      ...headers,
    };

    let lastError: ApiError | null = null;

    for (let attempt = 1; attempt <= finalRetryConfig.maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const requestInit: RequestInit = {
          method,
          headers: requestHeaders,
          signal: controller.signal,
        };

        if (body && method !== "GET") {
          requestInit.body =
            typeof body === "string" ? body : JSON.stringify(body);
        }

        const response = await fetch(url, requestInit);
        clearTimeout(timeoutId);

        // Handle non-2xx responses
        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }

          const apiError = createApiError(
            response,
            undefined,
            errorData.message,
          );

          // Don't retry if explicitly disabled or error is not retryable
          if (
            skipRetry ||
            !apiError.retryable ||
            attempt === finalRetryConfig.maxAttempts
          ) {
            throw apiError;
          }

          lastError = apiError;
          await this.delay(calculateRetryDelay(attempt, finalRetryConfig));
          continue;
        }

        // Parse successful response
        const responseText = await response.text();
        let data: T;

        try {
          data = responseText ? JSON.parse(responseText) : null;
        } catch {
          data = responseText as unknown as T;
        }

        return {
          data,
          status: response.status,
          headers: response.headers,
        };
      } catch (error) {
        const apiError =
          error instanceof Error &&
          "type" in error &&
          "retryable" in error &&
          "timestamp" in error
            ? (error as unknown as ApiError)
            : createApiError(undefined, error as Error);

        // Don't retry if explicitly disabled or error is not retryable
        if (
          skipRetry ||
          !apiError.retryable ||
          attempt === finalRetryConfig.maxAttempts
        ) {
          throw apiError;
        }

        lastError = apiError;
        await this.delay(calculateRetryDelay(attempt, finalRetryConfig));
      }
    }

    // If we get here, all retries failed
    throw lastError || createApiError();
  }

  /**
   * GET request helper
   */
  async get<T = any>(
    endpoint: string,
    config?: Omit<ApiRequestConfig, "method" | "body">,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "GET" });
  }

  /**
   * POST request helper
   */
  async post<T = any>(
    endpoint: string,
    body?: any,
    config?: Omit<ApiRequestConfig, "method">,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "POST", body });
  }

  /**
   * PUT request helper
   */
  async put<T = any>(
    endpoint: string,
    body?: any,
    config?: Omit<ApiRequestConfig, "method">,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "PUT", body });
  }

  /**
   * DELETE request helper
   */
  async delete<T = any>(
    endpoint: string,
    config?: Omit<ApiRequestConfig, "method" | "body">,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "DELETE" });
  }

  /**
   * PATCH request helper
   */
  async patch<T = any>(
    endpoint: string,
    body?: any,
    config?: Omit<ApiRequestConfig, "method">,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: "PATCH", body });
  }

  /**
   * Set default headers for all requests
   */
  setDefaultHeaders(headers: Record<string, string>): void {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
  }

  /**
   * Set authorization header
   */
  setAuthToken(token: string): void {
    this.setDefaultHeaders({ Authorization: `Bearer ${token}` });
  }

  /**
   * Remove authorization header
   */
  clearAuthToken(): void {
    delete this.defaultHeaders.Authorization;
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
