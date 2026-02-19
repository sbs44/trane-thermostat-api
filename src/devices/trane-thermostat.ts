/**
 * TraneThermostat device class
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
  ITraneThermostat,
  ITraneZone
} from '../types/interfaces';
import {
  SystemStatus,
  AirCleanerMode,
  TemperatureUnit,
  BLOWER_OFF_STATUSES,
  API_ENDPOINTS,
  API_CONSTANTS
} from '../types/constants';
import { TraneClient } from '../client/trane-client';
import { TraneZone } from './trane-zone';
import {
  TemperatureValidator,
  HumidityValidator,
  FanSpeedValidator,
  GeneralValidator,
  TraneValidator
} from '../utils/validation';
import {
  FeatureNotSupportedError,
  ValidationError
} from '../utils/errors';

export class TraneThermostat implements ITraneThermostat {
  private readonly client: TraneClient;
  private readonly data: ThermostatData;
  private readonly zonesMap: Map<string, ITraneZone> = new Map();

  constructor(client: TraneClient, rawData: any) {
    this.client = client;
    this.data = this.transformApiData(rawData);
    this.initializeZones();
  }

  /**
   * Transform API response data to internal format
   * Handles both legacy format and current array-based features format
   */
  private transformApiData(rawData: any): ThermostatData {
    // Check if already in expected format (has settings as an object, not an array)
    const hasSettingsObject = rawData.settings && typeof rawData.settings === 'object' && !Array.isArray(rawData.settings);
    const hasFeaturesObject = rawData.features && typeof rawData.features === 'object' && !Array.isArray(rawData.features);

    if (hasSettingsObject || hasFeaturesObject) {
      return rawData as ThermostatData;
    }

    // Transform array-based format
    // The raw API puts name-based items in "features" and type-based items in "settings"
    const features = Array.isArray(rawData.features) ? rawData.features : [];
    const settingsArray = Array.isArray(rawData.settings) ? rawData.settings : [];

    // Find specific feature objects (name-based, in features array)
    const advancedInfo = features.find((f: any) => f.name === 'advanced_info');
    const thermostatFeature = features.find((f: any) => f.name === 'thermostat');
    const connectionFeature = features.find((f: any) => f.name === 'connection');

    // Extract model and firmware from advanced_info
    let model = 'Unknown';
    let firmware = 'Unknown';
    if (advancedInfo?.items) {
      for (const item of advancedInfo.items) {
        if (item.label === 'Model') model = item.value;
        if (item.label === 'Firmware Version') firmware = item.value;
      }
    }

    // Build transformed data
    const transformed: ThermostatData = {
      id: rawData.id,
      name: rawData.name,
      model,
      firmware,
      is_online: connectionFeature?.is_connected ?? true,
      features: {
        has_zones: false,
        has_outdoor_temperature: !!rawData.has_outdoor_temperature,
        has_relative_humidity: !!rawData.has_indoor_humidity,
        has_variable_speed_compressor: false,
        has_emergency_heat: false,
        has_variable_fan_speed: false,
        has_dehumidify_support: !!settingsArray.find((f: any) => f.type === 'dehumidify'),
        has_humidify_support: !!settingsArray.find((f: any) => f.type === 'humidify'),
        has_air_cleaner: !!settingsArray.find((f: any) => f.type === 'air_cleaner_mode')
      },
      settings: {},
      zones: [],
      // Preserve raw features for zone extraction
      _rawFeatures: features
    };

    // Extract settings from thermostat feature and device-level fields
    const dehumidifyFeature = settingsArray.find((f: any) => f.type === 'dehumidify');
    const humidifyFeature = settingsArray.find((f: any) => f.type === 'humidify');

    if (thermostatFeature) {
      transformed.settings = {
        temperature_unit: thermostatFeature.scale === 'c' ? TemperatureUnit.CELSIUS : TemperatureUnit.FAHRENHEIT,
        deadband: thermostatFeature.setpoint_delta || 3,
        system_status: thermostatFeature.system_status || thermostatFeature.status
      };
    }

    // Map device-level humidity and outdoor temperature
    if (rawData.indoor_humidity != null) {
      transformed.settings!.relative_humidity = parseFloat(rawData.indoor_humidity) / 100;
    }
    if (rawData.outdoor_temperature != null) {
      transformed.settings!.outdoor_temperature = parseFloat(rawData.outdoor_temperature);
    }

    // Map dehumidify/humidify setpoints from feature array
    if (dehumidifyFeature) {
      transformed.settings!.dehumidify_setpoint = dehumidifyFeature.current_value;
    }
    if (humidifyFeature) {
      transformed.settings!.humidify_setpoint = humidifyFeature.current_value;
    }

    return transformed;
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
    TraneValidator.validateHumidityConfig(options);

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
  public get zones(): ITraneZone[] {
    return Array.from(this.zonesMap.values());
  }

  public get zoneIds(): string[] {
    return Array.from(this.zonesMap.keys());
  }

  public getZoneById(zoneId: string): ITraneZone | undefined {
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

    // First try explicit zones array
    if (this.data.zones && this.data.zones.length > 0) {
      for (const zoneData of this.data.zones) {
        try {
          const zone = new TraneZone(this.client, this, zoneData);
          this.zonesMap.set(zone.id, zone);
        } catch (error) {
          console.warn(`Failed to create zone ${zoneData.id}:`, error);
        }
      }
      return;
    }

    // Extract zone from raw features (current API format)
    const rawFeatures = (this.data as any)._rawFeatures;
    if (rawFeatures && Array.isArray(rawFeatures)) {
      const thermostatFeature = rawFeatures.find((f: any) => f.name === 'thermostat');
      const modeFeature = rawFeatures.find((f: any) => f.name === 'thermostat_mode');
      const runModeFeature = rawFeatures.find((f: any) => f.name === 'thermostat_run_mode');
      const sensorFeature = rawFeatures.find((f: any) => f.name === 'room_iq_sensors');

      if (thermostatFeature) {
        // Extract zone ID from device_identifier (e.g., "XxlZone-85588519" -> 85588519)
        let zoneId = String(this.data.id);
        if (thermostatFeature.device_identifier) {
          const match = thermostatFeature.device_identifier.match(/XxlZone-(\d+)/);
          if (match) {
            zoneId = match[1];
          }
        }

        // Get temperature from sensor if available (more accurate)
        let currentTemp = thermostatFeature.temperature;
        if (sensorFeature?.sensors?.length > 0) {
          const primarySensor = sensorFeature.sensors[0];
          if (primarySensor.temperature_valid) {
            currentTemp = primarySensor.temperature;
          }
        }

        const zoneData = {
          id: zoneId,
          name: this.data.name || 'Zone 1',
          features: {
            heating_setpoint: thermostatFeature.setpoint_heat,
            cooling_setpoint: thermostatFeature.setpoint_cool,
            current_mode: modeFeature?.value,
            setpoint_status: runModeFeature?.value,
            is_calling: thermostatFeature.operating_state !== 'idle'
          },
          settings: {
            temperature: currentTemp,
            status: thermostatFeature.operating_state || thermostatFeature.status
          },
          _rawActions: {
            setpoints: thermostatFeature.actions?.set_heat_setpoint?.href,
            zone_mode: modeFeature?.actions?.update_thermostat_mode?.href,
            run_mode: runModeFeature?.actions?.update_thermostat_run_mode?.href
          }
        };

        try {
          const zone = new TraneZone(this.client, this, zoneData);
          this.zonesMap.set(zone.id, zone);
        } catch (error) {
          console.warn(`Failed to create zone from thermostat feature:`, error);
        }
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
