/**
 * NexiaThermostat device class
 * Represents a physical thermostat device with comprehensive feature detection and control
 */

import {
  ThermostatData,
  DeviceCapabilities,
  SystemStatusSummary,
  HumidityOptions,
  FanOptions
} from '../types/api';
import {
  INexiaThermostat,
  INexiaZone
} from '../types/interfaces';
import {
  SystemStatus,
  AirCleanerMode,
  TemperatureUnit,
  BLOWER_OFF_STATUSES,
  API_ENDPOINTS,
  API_CONSTANTS
} from '../types/constants';
import { NexiaClient } from '../client/nexia-client';
import { NexiaZone } from './nexia-zone';
import {
  TemperatureValidator,
  HumidityValidator,
  FanSpeedValidator,
  GeneralValidator,
  NexiaValidator
} from '../utils/validation';
import {
  FeatureNotSupportedError,
  ValidationError
} from '../utils/errors';

export class NexiaThermostat implements INexiaThermostat {
  private readonly client: NexiaClient;
  private readonly data: ThermostatData;
  private readonly zonesMap: Map<string, INexiaZone> = new Map();

  constructor(client: NexiaClient, data: ThermostatData) {
    this.client = client;
    this.data = data;
    this.initializeZones();
  }

  // Identification
  public get id(): string {
    return String(this.data.id);
  }

  public get name(): string {
    return this.data.name || `Thermostat ${this.id}`;
  }

  // System information
  public get model(): string {
    return this.data.model || 'Unknown';
  }

  public get firmware(): string {
    return this.data.firmware || 'Unknown';
  }

  public get isOnline(): boolean {
    return this.data.is_online !== false;
  }

  public get temperatureUnit(): TemperatureUnit {
    const unit = this.data.settings?.temperature_unit;
    return unit === TemperatureUnit.CELSIUS ? TemperatureUnit.CELSIUS : TemperatureUnit.FAHRENHEIT;
  }

  public get deadband(): number {
    return this.data.settings?.deadband || 3; // Default 3 degrees
  }

  // Capability detection
  public get capabilities(): DeviceCapabilities {
    const features = this.data.features || {};
    return {
      model: this.model,
      firmware: this.firmware,
      hasZones: features.has_zones || false,
      hasOutdoorTemperature: features.has_outdoor_temperature || false,
      hasRelativeHumidity: features.has_relative_humidity || false,
      hasVariableSpeedCompressor: features.has_variable_speed_compressor || false,
      hasEmergencyHeat: features.has_emergency_heat || false,
      hasVariableFanSpeed: features.has_variable_fan_speed || false,
      hasDehumidifySupport: features.has_dehumidify_support || false,
      hasHumidifySupport: features.has_humidify_support || false,
      hasAirCleaner: features.has_air_cleaner || false
    };
  }

  public get hasZones(): boolean {
    return this.capabilities.hasZones;
  }

  public get hasOutdoorTemperature(): boolean {
    return this.capabilities.hasOutdoorTemperature;
  }

  public get hasRelativeHumidity(): boolean {
    return this.capabilities.hasRelativeHumidity;
  }

  public get hasVariableSpeedCompressor(): boolean {
    return this.capabilities.hasVariableSpeedCompressor;
  }

  public get hasEmergencyHeat(): boolean {
    return this.capabilities.hasEmergencyHeat;
  }

  public get hasVariableFanSpeed(): boolean {
    return this.capabilities.hasVariableFanSpeed;
  }

  public get hasDehumidifySupport(): boolean {
    return this.capabilities.hasDehumidifySupport;
  }

  public get hasHumidifySupport(): boolean {
    return this.capabilities.hasHumidifySupport;
  }

  public get hasAirCleaner(): boolean {
    return this.capabilities.hasAirCleaner;
  }

  // Current status
  public get systemStatus(): SystemStatusSummary {
    const settings = this.data.settings || {};
    const status = this.parseSystemStatus(settings.system_status);

    return {
      systemStatus: status,
      isOnline: this.isOnline,
      isBlowerActive: this.isBlowerActive,
      isEmergencyHeatActive: this.isEmergencyHeatActive,
      currentCompressorSpeed: this.currentCompressorSpeed,
      relativeHumidity: this.relativeHumidity,
      outdoorTemperature: this.outdoorTemperature
    };
  }

  public get isBlowerActive(): boolean {
    const status = this.parseSystemStatus(this.data.settings?.system_status);
    return !BLOWER_OFF_STATUSES.has(status);
  }

  public get isEmergencyHeatActive(): boolean {
    if (!this.hasEmergencyHeat) {
      return false;
    }
    return this.data.settings?.emergency_heat_active || false;
  }

  public get currentCompressorSpeed(): number {
    if (!this.hasVariableSpeedCompressor) {
      return 0;
    }
    return this.data.settings?.current_compressor_speed || 0;
  }

  public get relativeHumidity(): number | null {
    if (!this.hasRelativeHumidity) {
      return null;
    }
    const humidity = this.data.settings?.relative_humidity;
    return typeof humidity === 'number' ? humidity : null;
  }

  public get outdoorTemperature(): number | null {
    if (!this.hasOutdoorTemperature) {
      return null;
    }
    const temp = this.data.settings?.outdoor_temperature;
    return typeof temp === 'number' ? temp : null;
  }

  // Setpoint limits
  public get setpointLimits(): {
    heatMin: number;
    heatMax: number;
    coolMin: number;
    coolMax: number;
  } {
    // Get limits from temperature unit
    const limits = TemperatureValidator.getTemperatureLimits(this.temperatureUnit);

    // TODO: Could be enhanced to get actual limits from device if available
    return {
      heatMin: limits.min,
      heatMax: limits.max,
      coolMin: limits.min,
      coolMax: limits.max
    };
  }

  // Fan control
  public get availableFanModes(): string[] {
    // Extract from device data or return common defaults
    return this.extractAvailableValues() || ['auto', 'on', 'circulate'];
  }

  public get currentFanMode(): string | null {
    return this.data.settings?.fan_mode || null;
  }

  public get fanSpeedLimits(): { min: number; max: number } {
    if (!this.hasVariableFanSpeed) {
      return { min: 0, max: 1 };
    }

    // TODO: Extract actual limits from device data if available
    return {
      min: 0.0,
      max: 1.0
    };
  }

  public get currentFanSpeed(): number {
    if (!this.hasVariableFanSpeed) {
      return 0;
    }
    return this.data.settings?.fan_speed || 0;
  }

  public async setFanMode(mode: string): Promise<void> {
    const validMode = GeneralValidator.validateRequiredString(mode, 'fanMode');

    if (!this.availableFanModes.includes(validMode)) {
      throw new ValidationError(
        `Invalid fan mode '${validMode}'. Available modes: ${this.availableFanModes.join(', ')}`,
        'fanMode',
        validMode
      );
    }

    const endpoint = await this.getThermostatEndpoint('fan_mode');
    await this.client.post(endpoint, { fan_mode: validMode });

    // Delayed update to allow device to reflect changes
    await this.delayedUpdate();
  }

  public async setFanSpeed(speed: number): Promise<void> {
    if (!this.hasVariableFanSpeed) {
      throw new FeatureNotSupportedError('variable fan speed', this.model);
    }

    const validSpeed = FanSpeedValidator.roundFanSpeed(speed);
    FanSpeedValidator.validateFanSpeed(validSpeed);

    const endpoint = await this.getThermostatEndpoint('fan_speed');
    await this.client.post(endpoint, { fan_speed: validSpeed });

    await this.delayedUpdate();
  }

  public async setFanOptions(options: FanOptions): Promise<void> {
    const validOptions = this.validateFanOptions(options);

    if (validOptions.mode !== undefined) {
      await this.setFanMode(validOptions.mode);
    }

    if (validOptions.speed !== undefined) {
      await this.setFanSpeed(validOptions.speed);
    }

    // Note: Schedule option would need additional API endpoint if supported
  }

  // Humidity control
  public get humidifySetpoint(): number {
    if (!this.hasHumidifySupport) {
      return 0;
    }
    return this.data.settings?.humidify_setpoint || 0.35; // Default 35%
  }

  public get dehumidifySetpoint(): number {
    if (!this.hasDehumidifySupport) {
      return 1;
    }
    return this.data.settings?.dehumidify_setpoint || 0.60; // Default 60%
  }

  public get humiditySetpoints(): number[] {
    return HumidityValidator.getAvailableSetpoints();
  }

  public get dehumidifySetpoints(): number[] {
    return HumidityValidator.getAvailableSetpoints();
  }

  public async setHumiditySetpoints(options: HumidityOptions): Promise<void> {
    NexiaValidator.validateHumidityConfig(options);

    if (options.humidify !== undefined) {
      if (!this.hasHumidifySupport) {
        throw new FeatureNotSupportedError('humidify control', this.model);
      }
      await this.setHumidifySetpoint(options.humidify);
    }

    if (options.dehumidify !== undefined) {
      if (!this.hasDehumidifySupport) {
        throw new FeatureNotSupportedError('dehumidify control', this.model);
      }
      await this.setDehumidifySetpoint(options.dehumidify);
    }
  }

  public async setDehumidifySetpoint(value: number): Promise<void> {
    if (!this.hasDehumidifySupport) {
      throw new FeatureNotSupportedError('dehumidify control', this.model);
    }

    const validValue = HumidityValidator.roundHumidity(value);
    HumidityValidator.validateHumiditySetpoint(validValue);

    const endpoint = await this.getThermostatEndpoint('dehumidify');
    await this.client.post(endpoint, { dehumidify_setpoint: validValue });

    await this.delayedUpdate();
  }

  public async setHumidifySetpoint(value: number): Promise<void> {
    if (!this.hasHumidifySupport) {
      throw new FeatureNotSupportedError('humidify control', this.model);
    }

    const validValue = HumidityValidator.roundHumidity(value);
    HumidityValidator.validateHumiditySetpoint(validValue);

    const endpoint = await this.getThermostatEndpoint('humidify');
    await this.client.post(endpoint, { humidify_setpoint: validValue });

    await this.delayedUpdate();
  }

  // Air cleaner
  public get airCleanerMode(): string | null {
    return this.data.settings?.air_cleaner_mode || null;
  }

  public get availableAirCleanerModes(): AirCleanerMode[] {
    return [AirCleanerMode.AUTO, AirCleanerMode.QUICK, AirCleanerMode.ALLERGY];
  }

  public async setAirCleanerMode(mode: AirCleanerMode): Promise<void> {
    if (!this.hasAirCleaner) {
      throw new FeatureNotSupportedError('air cleaner', this.model);
    }

    const validMode = GeneralValidator.validateEnum(mode, AirCleanerMode, 'airCleanerMode');

    const endpoint = await this.getThermostatEndpoint('air_cleaner_mode');
    await this.client.post(endpoint, { air_cleaner_mode: validMode });

    await this.delayedUpdate();
  }

  // Emergency heat
  public async setEmergencyHeat(enabled: boolean): Promise<void> {
    if (!this.hasEmergencyHeat) {
      throw new FeatureNotSupportedError('emergency heat', this.model);
    }

    const validEnabled = GeneralValidator.validateBoolean(enabled, 'enabled');

    const endpoint = await this.getThermostatEndpoint('emergency_heat');
    await this.client.post(endpoint, { emergency_heat: validEnabled });

    await this.delayedUpdate();
  }

  // Schedule control
  public async setFollowSchedule(follow: boolean): Promise<void> {
    const validFollow = GeneralValidator.validateBoolean(follow, 'follow');

    const endpoint = await this.getThermostatEndpoint('scheduling_enabled');
    await this.client.post(endpoint, { scheduling_enabled: validFollow });

    await this.delayedUpdate();
  }

  // Zone management
  public get zones(): INexiaZone[] {
    return Array.from(this.zonesMap.values());
  }

  public get zoneIds(): string[] {
    return Array.from(this.zonesMap.keys());
  }

  public getZoneById(zoneId: string): INexiaZone | undefined {
    return this.zonesMap.get(zoneId);
  }

  // Data refresh
  public async refresh(): Promise<void> {
    await this.client.update({ forceUpdate: true });
  }

  // Private helper methods

  /**
   * Initialize zones from thermostat data
   */
  private initializeZones(): void {
    this.zonesMap.clear();

    if (!this.data.zones) {
      return;
    }

    for (const zoneData of this.data.zones) {
      try {
        const zone = new NexiaZone(this.client, this, zoneData);
        this.zonesMap.set(zone.id, zone);
      } catch (error) {
        console.warn(`Failed to create zone ${zoneData.id}:`, error);
      }
    }
  }

  /**
   * Parse system status string into enum
   */
  private parseSystemStatus(status?: string): SystemStatus {
    if (!status) {
      return SystemStatus.OFF;
    }

    switch (status) {
      case 'Cooling':
        return SystemStatus.COOLING;
      case 'Heating':
        return SystemStatus.HEATING;
      case 'Waiting...':
        return SystemStatus.WAITING;
      case 'System Idle':
        return SystemStatus.IDLE;
      case 'System Off':
        return SystemStatus.OFF;
      default:
        return SystemStatus.IDLE;
    }
  }

  /**
   * Extract available values for a feature from device data
   */
  private extractAvailableValues(): string[] | null {
    // This would extract available values from the device JSON structure
    // Implementation depends on how the API provides this information
    // For now, return null to use defaults
    return null;
  }

  /**
   * Get thermostat endpoint URL for a specific operation
   */
  private async getThermostatEndpoint(operation: string): Promise<string> {
    // Try to find endpoint from device data links first
    const selfLink = this.data._links?.self?.href;
    if (selfLink) {
      return `${selfLink}/${operation}`;
    }

    // Fallback to standard endpoint pattern
    return `${API_ENDPOINTS.THERMOSTAT}/${this.id}/${operation}`;
  }

  /**
   * Validate fan options
   */
  private validateFanOptions(options: FanOptions): FanOptions {
    const validated: FanOptions = {};

    if (options.mode !== undefined) {
      validated.mode = GeneralValidator.validateRequiredString(options.mode, 'fanMode');
    }

    if (options.speed !== undefined) {
      FanSpeedValidator.validateFanSpeed(options.speed);
      validated.speed = FanSpeedValidator.roundFanSpeed(options.speed);
    }

    if (options.schedule !== undefined) {
      validated.schedule = GeneralValidator.validateBoolean(options.schedule, 'schedule');
    }

    return validated;
  }

  /**
   * Delayed update helper
   */
  private async delayedUpdate(): Promise<void> {
    await this.client.delayedUpdate(API_CONSTANTS.UPDATE_DELAY_SECONDS * 1000);
  }

  /**
   * Get thermostat status summary for debugging
   */
  public getStatusSummary(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      model: this.model,
      firmware: this.firmware,
      isOnline: this.isOnline,
      temperatureUnit: this.temperatureUnit,
      systemStatus: this.systemStatus,
      capabilities: this.capabilities,
      zones: this.zones.length,
      currentFanMode: this.currentFanMode,
      currentFanSpeed: this.currentFanSpeed,
      airCleanerMode: this.airCleanerMode,
      humidifySetpoint: this.humidifySetpoint,
      dehumidifySetpoint: this.dehumidifySetpoint
    };
  }
}
