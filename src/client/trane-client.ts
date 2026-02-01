/**
 * Main HTTP client for Trane API
 * Handles authentication, device discovery, and API communication
 * Replaces the Python TraneHome class functionality
 */

import { BrandType, BRAND_URLS, API_ENDPOINTS, HTTP_STATUS } from '../types/constants';
import {
  HouseData,
  ThermostatData,
  AutomationData,
  TraneClientConfig,
  UpdateOptions
} from '../types/api';
import { ITraneClient, ITraneThermostat, ITraneAutomation } from '../types/interfaces';
import { HttpClient, createHttpClient } from '../utils/http-utils';
import { AuthManager, AuthConfig } from './auth';
import { TraneThermostat } from '../devices/trane-thermostat';
import { TraneAutomation } from '../devices/trane-automation';
import {
  AuthenticationError,
  SessionExpiredError,
  ApiError,
  ErrorHandler
} from '../utils/errors';
import { GeneralValidator } from '../utils/validation';

export class TraneClient implements ITraneClient {
  private readonly httpClient: HttpClient;
  private readonly authManager: AuthManager;
  private readonly config: TraneClientConfig;

  private _houseId?: number;
  // House name is stored for potential future use
  private _houseName?: string;
  private thermostats: Map<string, ITraneThermostat> = new Map();
  private automations: Map<string, ITraneAutomation> = new Map();
  private _lastUpdate: Date | null = null;
  private isInitialized: boolean = false;

  constructor(config: TraneClientConfig) {
    this.config = this.validateConfig(config);

    // Create HTTP client with brand-specific base URL
    const baseURL = BRAND_URLS[this.config.brand!];
    this.httpClient = createHttpClient({
      baseURL,
      timeout: this.config.timeout || 30000,
      retryAttempts: this.config.retryAttempts || 3,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Create auth manager
    const authConfig: AuthConfig = {
      username: this.config.username,
      password: this.config.password,
      brand: this.config.brand!,
      deviceName: this.config.deviceName,
      stateFile: this.config.stateFile,
      houseId: this.config.houseId
    };

    this.authManager = new AuthManager(this.httpClient, authConfig);
  }

  /**
   * Initialize the client and authenticate
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.authManager.initialize();

    // Auto-authenticate if no valid session exists
    if (!this.authManager.isSessionValid()) {
      await this.login();
    }

    this.isInitialized = true;
  }

  /**
   * Login and authenticate with the Trane API
   */
  public async login(): Promise<void> {
    try {
      await this.authManager.authenticate();

      // Get session info to determine house ID
      const sessionInfo = await this.authManager.getSessionInfo();
      this._houseId = sessionInfo.houseId;
      this._houseName = sessionInfo.houseName;

      // Perform initial data load
      await this.update({ forceUpdate: true });

    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      const traneError = ErrorHandler.handle(error);
      throw new AuthenticationError(`Login failed: ${traneError.message}`);
    }
  }

  /**
   * Logout and clear session
   */
  public async logout(): Promise<void> {
    await this.authManager.logout();
    this.clearDeviceCache();
    this.isInitialized = false;
  }

  /**
   * Check if client is authenticated
   */
  public isAuthenticated(): boolean {
    return this.authManager.isSessionValid();
  }

  /**
   * Get all thermostats
   */
  public async getThermostats(): Promise<ITraneThermostat[]> {
    await this.ensureAuthenticated();
    return Array.from(this.thermostats.values());
  }

  /**
   * Get all automations
   */
  public async getAutomations(): Promise<ITraneAutomation[]> {
    await this.ensureAuthenticated();
    return Array.from(this.automations.values());
  }

  /**
   * Get thermostat by ID
   */
  public getThermostatById(id: string): ITraneThermostat | undefined {
    return this.thermostats.get(id);
  }

  /**
   * Get automation by ID
   */
  public getAutomationById(id: string): ITraneAutomation | undefined {
    return this.automations.get(id);
  }

  /**
   * Update all device data from API
   */
  public async update(options: UpdateOptions = {}): Promise<void> {
    await this.ensureAuthenticated();

    if (!this._houseId) {
      throw new ApiError('House ID not available. Please ensure login was successful.');
    }

    try {
      const { forceUpdate = false } = options;
      const houseUrl = `${API_ENDPOINTS.HOUSES}/${this._houseId}`;

      // Use ETag caching unless forcing update
      const response = forceUpdate
        ? await this.httpClient.get<HouseData>(houseUrl)
        : await this.httpClient.getWithETag<HouseData>(houseUrl);

      if (!('fromCache' in response) || !response.fromCache || forceUpdate) {
        await this.processHouseData(response.data);
        this._lastUpdate = new Date();
      }

    } catch (error) {
      // Handle session expiry with automatic retry
      if (this.isSessionExpiredError(error)) {
        await this.handleSessionExpiry();
        return this.update(options); // Retry once
      }

      throw ErrorHandler.handle(error);
    }
  }

  /**
   * Perform GET request with authentication
   */
  public async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
    await this.ensureAuthenticated();

    try {
      const response = await this.httpClient.get<T>(url, { headers });
      return response.data;
    } catch (error) {
      if (this.isSessionExpiredError(error)) {
        await this.handleSessionExpiry();
        // Retry once
        const response = await this.httpClient.get<T>(url, { headers });
        return response.data;
      }
      throw ErrorHandler.handle(error);
    }
  }

  /**
   * Perform POST request with authentication
   */
  public async post<T>(url: string, data: unknown, headers?: Record<string, string>): Promise<T> {
    await this.ensureAuthenticated();

    try {
      const response = await this.httpClient.post<T>(url, data, { headers });
      return response.data;
    } catch (error) {
      if (this.isSessionExpiredError(error)) {
        await this.handleSessionExpiry();
        // Retry once
        const response = await this.httpClient.post<T>(url, data, { headers });
        return response.data;
      }
      throw ErrorHandler.handle(error);
    }
  }

  /**
   * Perform PUT request with authentication
   */
  public async put<T>(url: string, data: unknown, headers?: Record<string, string>): Promise<T> {
    await this.ensureAuthenticated();

    try {
      const response = await this.httpClient.put<T>(url, data, { headers });
      return response.data;
    } catch (error) {
      if (this.isSessionExpiredError(error)) {
        await this.handleSessionExpiry();
        // Retry once
        const response = await this.httpClient.put<T>(url, data, { headers });
        return response.data;
      }
      throw ErrorHandler.handle(error);
    }
  }

  // Getters for configuration and status
  public get brand(): BrandType {
    return this.config.brand!;
  }

  public get username(): string {
    return this.config.username;
  }

  public getHouseId(): number | undefined {
    return this._houseId;
  }

  public get lastUpdate(): Date | null {
    return this._lastUpdate;
  }

  /**
   * Get thermostat IDs
   */
  public getThermostatIds(): string[] {
    return Array.from(this.thermostats.keys());
  }

  /**
   * Get automation IDs
   */
  public getAutomationIds(): string[] {
    return Array.from(this.automations.keys());
  }

  /**
   * Clear ETag cache (forces fresh data on next update)
   */
  public clearCache(): void {
    this.httpClient.clearETagCache();
  }

  /**
   * Validate client configuration
   */
  private validateConfig(config: TraneClientConfig): TraneClientConfig {
    const username = GeneralValidator.validateRequiredString(config.username, 'username');
    const password = GeneralValidator.validateRequiredString(config.password, 'password');

    const brand = GeneralValidator.validateOptional(
      config.brand,
      (b) => GeneralValidator.validateEnum(b, BrandType, 'brand'),
      BrandType.TRANE
    );

    return {
      ...config,
      username,
      password,
      brand,
      deviceName: config.deviceName || 'Homebridge',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3
    };
  }

  /**
   * Ensure client is authenticated and initialized
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.isAuthenticated()) {
      await this.login();
    }
  }

  /**
   * Process house data and update device caches
   */
  private async processHouseData(houseData: HouseData): Promise<void> {
    if (!houseData.success || !houseData.result) {
      throw new ApiError('Invalid house data received');
    }

    const result = houseData.result;

    // Clear existing device caches
    this.clearDeviceCache();

    // Process child devices from _links
    if (result._links?.child) {
      for (const childLink of result._links.child) {
        try {
          // Handle direct device links (legacy format)
          if (childLink.type === 'thermostat' || childLink.href.includes('xxl_thermostats')) {
            await this.processThermostat(childLink);
          } else if (childLink.type === 'automation' || childLink.href.includes('automation')) {
            await this.processAutomation(childLink);
          }
          // Handle collection format (current API format)
          // Devices are embedded in data.items
          else if (childLink.type === 'application/vnd.nexia.collection+json' && childLink.data?.items) {
            for (const item of childLink.data.items) {
              try {
                // Check if item has thermostat features
                if (this.isThermostatItem(item)) {
                  const thermostat = new TraneThermostat(this, item);
                  this.thermostats.set(thermostat.id, thermostat);
                }
              } catch (error) {
                console.warn(`Failed to process device item ${item.id}:`, error);
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to process child link:`, error);
        }
      }
    }

    // Process devices directly if included in house data
    if (result.devices) {
      for (const device of result.devices) {
        try {
          const thermostat = new TraneThermostat(this, device);
          this.thermostats.set(thermostat.id, thermostat);
        } catch (error) {
          console.warn('Failed to create thermostat from device data:', error);
        }
      }
    }

    // Process automations directly if included
    if (result.automations) {
      for (const automation of result.automations) {
        try {
          const automationObj = new TraneAutomation(this, automation);
          this.automations.set(automationObj.id, automationObj);
        } catch (error) {
          console.warn('Failed to create automation from data:', error);
        }
      }
    }
  }

  /**
   * Check if a data item represents a thermostat
   */
  private isThermostatItem(item: any): boolean {
    if (!item || !item.features) {
      return false;
    }
    // Check for thermostat-specific features
    return item.features.some((f: any) =>
      f.name === 'thermostat' ||
      f.name === 'thermostat_mode' ||
      f.name === 'advanced_info'
    );
  }

  /**
   * Process individual thermostat from device link
   */
  private async processThermostat(deviceLink: { href: string; id?: string | number }): Promise<void> {
    try {
      // Fetch full thermostat data
      const thermostatData = await this.get<ThermostatData>(deviceLink.href);

      // Create thermostat instance
      const thermostat = new TraneThermostat(this, thermostatData);
      this.thermostats.set(thermostat.id, thermostat);

    } catch (error) {
      console.warn(`Failed to load thermostat ${deviceLink.id || 'unknown'}:`, error);
    }
  }

  /**
   * Process individual automation from device link
   */
  private async processAutomation(deviceLink: { href: string; id?: string | number }): Promise<void> {
    try {
      // Fetch full automation data
      const automationData = await this.get<AutomationData>(deviceLink.href);

      // Create automation instance
      const automation = new TraneAutomation(this, automationData);
      this.automations.set(automation.id, automation);

    } catch (error) {
      console.warn(`Failed to load automation ${deviceLink.id || 'unknown'}:`, error);
    }
  }

  /**
   * Clear device caches
   */
  private clearDeviceCache(): void {
    this.thermostats.clear();
    this.automations.clear();
  }

  /**
   * Check if error indicates session expiry
   */
  private isSessionExpiredError(error: unknown): boolean {
    return (
      error instanceof SessionExpiredError ||
      (error instanceof ApiError && error.statusCode === HTTP_STATUS.REDIRECT) ||
      (error instanceof AuthenticationError && error.message.includes('session'))
    );
  }

  /**
   * Handle session expiry by refreshing authentication
   */
  private async handleSessionExpiry(): Promise<void> {
    console.info('Session expired, refreshing authentication...');

    try {
      this.authManager.handleSessionExpired();
      await this.authManager.authenticate();

      // Get updated session info
      const sessionInfo = await this.authManager.getSessionInfo();
      this._houseId = sessionInfo.houseId;
      this._houseName = sessionInfo.houseName;

    } catch {
      this.clearDeviceCache();
      throw new AuthenticationError('Failed to refresh expired session');
    }
  }

  /**
   * Delayed update helper for after operations
   */
  public async delayedUpdate(delayMs: number = 7000): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          await this.update();
          resolve();
        } catch (error) {
          reject(error);
        }
      }, delayMs);
    });
  }

  /**
   * Get base URL for the configured brand
   */
  public getBaseUrl(): string {
    return BRAND_URLS[this.config.brand!];
  }

  /**
   * Get mobile API URL
   */
  public getMobileUrl(): string {
    return `${this.getBaseUrl()}/mobile`;
  }

  /**
   * Get update URL for house data
   */
  public getUpdateUrl(): string | null {
    return this._houseId ? `${API_ENDPOINTS.HOUSES}/${this._houseId}` : null;
  }

  /**
   * Get the house name
   */
  public getHouseName(): string | undefined {
    return this._houseName;
  }
}
