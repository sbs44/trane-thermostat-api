/**
 * Authentication manager for Trane API
 * Handles login, session management, device UUID persistence, and rate limiting
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { BrandType, API_CONSTANTS, API_ENDPOINTS } from '../types/constants';
import { AuthTokens, LoginRequest, LoginResponse, SessionResponse } from '../types/api';
import { HttpClient } from '../utils/http-utils';
import {
  AuthenticationError,
  RateLimitError,
  // SessionExpiredError,
  ConfigurationError,
  // ValidationError,
  ErrorHandler
} from '../utils/errors';

export interface AuthConfig {
  username: string;
  password: string;
  deviceName?: string;
  brand: BrandType;
  stateFile?: string;
  houseId?: number;
}

export interface AuthState {
  deviceUuid: string;
  apiKey?: string;
  mobileId?: string;
  loginAttempts: number;
  lastLoginAttempt?: number;
  sessionExpiry?: number;
}

export class AuthManager {
  private readonly config: AuthConfig;
  private readonly httpClient: HttpClient;
  private readonly stateFilePath: string;
  private authState: AuthState;

  constructor(httpClient: HttpClient, config: AuthConfig) {
    this.httpClient = httpClient;
    this.config = this.validateConfig(config);
    this.stateFilePath = this.getStateFilePath();
    this.authState = {
      deviceUuid: uuidv4(),
      loginAttempts: 0
    };
  }

  /**
   * Initialize authentication manager by loading existing state
   */
  public async initialize(): Promise<void> {
    try {
      await this.loadState();
    } catch (error) {
      // If state loading fails, we'll start fresh
      console.warn('Failed to load auth state, starting fresh:', error);
      await this.generateNewDeviceUuid();
    }
  }

  /**
   * Authenticate with the Trane API
   */
  public async authenticate(): Promise<AuthTokens> {
    // Check rate limiting
    this.checkRateLimit();

    try {
      const response = await this.performLogin();

      if (response.success && response.result?.api_key && response.result?.mobile_id) {
        // Update auth state on successful login
        this.authState.apiKey = response.result.api_key;
        this.authState.mobileId = String(response.result.mobile_id);
        this.authState.loginAttempts = 0;
        this.authState.lastLoginAttempt = Date.now();
        this.authState.sessionExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

        // Update HTTP client headers
        this.httpClient.setAuthHeaders(response.result.api_key, String(response.result.mobile_id), this.config.brand);

        // Save state
        await this.saveState();

        return {
          apiKey: response.result.api_key,
          mobileId: String(response.result.mobile_id),
          success: true
        };
      } else {
        this.handleLoginFailure();
        throw new AuthenticationError('Login failed: Invalid credentials');
      }
    } catch (error) {
      this.handleLoginFailure();

      if (error instanceof AuthenticationError) {
        throw error;
      }

      const traneError = ErrorHandler.handle(error);
      throw new AuthenticationError(`Login failed: ${traneError.message}`);
    }
  }

  /**
   * Check if current session is valid
   */
  public isSessionValid(): boolean {
    return !!(
      this.authState.apiKey &&
      this.authState.mobileId &&
      this.authState.sessionExpiry &&
      this.authState.sessionExpiry > Date.now()
    );
  }

  /**
   * Refresh session by re-authenticating
   */
  public async refreshSession(): Promise<void> {
    // Clear current session
    this.authState.apiKey = undefined;
    this.authState.mobileId = undefined;
    this.authState.sessionExpiry = undefined;

    // Clear HTTP headers
    this.httpClient.clearAuthHeaders();

    // Re-authenticate
    await this.authenticate();
  }

  /**
   * Get current API key
   */
  public getApiKey(): string | null {
    return this.authState.apiKey || null;
  }

  /**
   * Get current mobile ID
   */
  public getMobileId(): string | null {
    return this.authState.mobileId || null;
  }

  /**
   * Get device UUID
   */
  public getDeviceUuid(): string {
    return this.authState.deviceUuid;
  }

  /**
   * Check if authentication is required
   */
  public needsAuthentication(): boolean {
    return !this.isSessionValid();
  }

  /**
   * Logout and clear session
   */
  public async logout(): Promise<void> {
    this.authState.apiKey = undefined;
    this.authState.mobileId = undefined;
    this.authState.sessionExpiry = undefined;

    this.httpClient.clearAuthHeaders();
    await this.saveState();
  }

  /**
   * Clear all auth state and generate new device UUID
   */
  public async reset(): Promise<void> {
    this.authState = {
      deviceUuid: uuidv4(),
      loginAttempts: 0
    };

    this.httpClient.clearAuthHeaders();
    await this.saveState();
  }

  /**
   * Get session discovery info (house ID if not provided in config)
   */
  public async getSessionInfo(): Promise<{ houseId: number; houseName: string }> {
    if (!this.isSessionValid()) {
      await this.authenticate();
    }

    try {
      const response = await this.httpClient.post<SessionResponse>(API_ENDPOINTS.SESSION, {});

      if (response.data.success && response.data.result) {
        const result = response.data.result;

        // Parse homes from the _links.child array (current API format)
        // Each child with type "application/vnd.nexia.location+json" is a home
        // Note: The API uses "nexia" in content types regardless of brand
        const homes: Array<{ house_id: number; name: string }> = [];

        if (result._links?.child) {
          for (const child of result._links.child) {
            if (child.type === 'application/vnd.nexia.location+json' && child.data?.id) {
              homes.push({
                house_id: child.data.id,
                name: child.data.name || 'Home'
              });
            }
          }
        }

        // Fall back to legacy format if available
        if (homes.length === 0 && result.homes) {
          homes.push(...result.homes);
        }

        if (homes.length === 0) {
          throw new AuthenticationError('No homes found in account');
        }

        // Use configured house ID or first available home
        const targetHouse = this.config.houseId
          ? homes.find(h => h.house_id === this.config.houseId)
          : homes[0];

        if (!targetHouse) {
          throw new AuthenticationError(
            `House ID ${this.config.houseId} not found. Available houses: ${homes.map(h => h.house_id).join(', ')}`
          );
        }

        return {
          houseId: targetHouse.house_id,
          houseName: targetHouse.name
        };
      } else {
        throw new AuthenticationError('Failed to retrieve session information');
      }
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      const traneError = ErrorHandler.handle(error);
      throw new AuthenticationError(`Session discovery failed: ${traneError.message}`);
    }
  }

  /**
   * Validate authentication configuration
   */
  private validateConfig(config: AuthConfig): AuthConfig {
    if (!config.username || typeof config.username !== 'string') {
      throw new ConfigurationError('Username is required');
    }

    if (!config.password || typeof config.password !== 'string') {
      throw new ConfigurationError('Password is required');
    }

    if (!Object.values(BrandType).includes(config.brand)) {
      throw new ConfigurationError(`Invalid brand: ${config.brand}. Must be one of: ${Object.values(BrandType).join(', ')}`);
    }

    return {
      ...config,
      deviceName: config.deviceName || API_CONSTANTS.DEFAULT_DEVICE_NAME
    };
  }

  /**
   * Get state file path with proper defaults
   */
  private getStateFilePath(): string {
    if (this.config.stateFile) {
      return this.config.stateFile;
    }

    // Default to user's home directory or current working directory
    const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || process.cwd();
    return join(homeDir, '.trane', 'auth-state.json');
  }

  /**
   * Load authentication state from file
   */
  private async loadState(): Promise<void> {
    try {
      const stateData = await fs.readFile(this.stateFilePath, 'utf8');
      const state = JSON.parse(stateData) as AuthState;

      // Validate loaded state
      if (state.deviceUuid && typeof state.deviceUuid === 'string') {
        this.authState = {
          ...this.authState,
          ...state
        };

        // Restore HTTP headers if session is still valid
        if (this.isSessionValid() && state.apiKey && state.mobileId) {
          this.httpClient.setAuthHeaders(state.apiKey, state.mobileId, this.config.brand);
        }
      } else {
        throw new Error('Invalid state file format');
      }
    } catch {
      // File doesn't exist or is invalid, generate new UUID
      await this.generateNewDeviceUuid();
    }
  }

  /**
   * Save authentication state to file
   */
  private async saveState(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(dirname(this.stateFilePath), { recursive: true });

      // Save state
      const stateData = JSON.stringify(this.authState, null, 2);
      await fs.writeFile(this.stateFilePath, stateData, 'utf8');
    } catch (error) {
      console.warn('Failed to save auth state:', error);
      // Don't throw error for save failures
    }
  }

  /**
   * Generate new device UUID and save
   */
  private async generateNewDeviceUuid(): Promise<void> {
    this.authState.deviceUuid = uuidv4();
    await this.saveState();
  }

  /**
   * Check rate limiting before login attempt
   */
  private checkRateLimit(): void {
    const now = Date.now();
    const lastAttempt = this.authState.lastLoginAttempt || 0;
    const timeSinceLastAttempt = now - lastAttempt;

    // Reset attempts if it's been more than an hour
    if (timeSinceLastAttempt > 60 * 60 * 1000) {
      this.authState.loginAttempts = 0;
    }

    // Check if rate limited
    if (this.authState.loginAttempts >= API_CONSTANTS.MAX_LOGIN_ATTEMPTS) {
      const waitTime = 60 * 60 * 1000; // 1 hour
      const remainingWait = waitTime - timeSinceLastAttempt;

      if (remainingWait > 0) {
        throw new RateLimitError(
          `Too many login attempts. Try again in ${Math.ceil(remainingWait / 60000)} minutes.`,
          Math.ceil(remainingWait / 1000)
        );
      } else {
        // Reset attempts after wait period
        this.authState.loginAttempts = 0;
      }
    }
  }

  /**
   * Perform the actual login API call
   */
  private async performLogin(): Promise<LoginResponse> {
    const loginData: LoginRequest = {
      login: this.config.username,
      password: this.config.password,
      device_uuid: this.authState.deviceUuid,
      device_name: this.config.deviceName!,
      app_version: API_CONSTANTS.APP_VERSION,
      is_commercial: false
    };

    const response = await this.httpClient.post<LoginResponse>(API_ENDPOINTS.SIGN_IN, loginData);

    // Handle redirect response (usually indicates invalid credentials)
    if (response.status === 302) {
      throw new AuthenticationError('Invalid credentials');
    }

    return response.data;
  }

  /**
   * Handle login failure
   */
  private handleLoginFailure(): void {
    this.authState.loginAttempts = (this.authState.loginAttempts || 0) + 1;
    this.authState.lastLoginAttempt = Date.now();
  }

  /**
   * Handle session expired scenario
   */
  public handleSessionExpired(): void {
    this.authState.apiKey = undefined;
    this.authState.mobileId = undefined;
    this.authState.sessionExpiry = undefined;
    this.httpClient.clearAuthHeaders();
  }
}
