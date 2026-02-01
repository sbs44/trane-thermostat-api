/**
 * TraneZone device class
 * Represents a zone/room within a thermostat with independent temperature control
 */

import {
  ZoneData,
  ZoneStatusSummary,
  TemperatureOptions,
  HoldOptions,
  SensorSelectionOptions
} from '../types/api';
import { ITraneZone, ITraneThermostat, ITraneSensor } from '../types/interfaces';
import {
  OperationMode,
  PresetMode,
  ZoneStatus,
  API_ENDPOINTS,
  API_CONSTANTS
} from '../types/constants';
import { TraneClient } from '../client/trane-client';
import { TraneSensor } from './trane-sensor';
import {
  TemperatureValidator,
  GeneralValidator,
  TraneValidator
} from '../utils/validation';
import {
  ValidationError
} from '../utils/errors';

export class TraneZone implements ITraneZone {
  private readonly client: TraneClient;
  private readonly thermostatRef: ITraneThermostat;
  private readonly data: ZoneData;
  private readonly sensorsMap: Map<number, ITraneSensor> = new Map();

  constructor(client: TraneClient, thermostat: ITraneThermostat, data: ZoneData) {
    this.client = client;
    this.thermostatRef = thermostat;
    this.data = data;
    this.initializeSensors();
  }

  // Identification
  public get id(): string {
    // Handle UX360 naming differences
    return String(this.data.zone_id || this.data.id);
  }

  public get name(): string {
    return this.data.name || `Zone ${this.id}`;
  }

  public get isNativeZone(): boolean {
    return this.data.settings?.native_zone || false;
  }

  // Temperature
  public get currentTemperature(): number {
    // Handle both API formats: direct property or nested in settings
    return (this.data as any).temperature ?? this.data.settings?.temperature ?? 0;
  }

  public get heatingSetpoint(): number {
    // Handle both API formats: direct property or nested in features
    return (this.data as any).heating_setpoint ?? (this.data as any).setpoints?.heat ?? this.data.features?.heating_setpoint ?? 70;
  }

  public get coolingSetpoint(): number {
    // Handle both API formats: direct property or nested in features
    return (this.data as any).cooling_setpoint ?? (this.data as any).setpoints?.cool ?? this.data.features?.cooling_setpoint ?? 75;
  }

  // Mode control
  public get currentMode(): OperationMode {
    // Handle both API formats
    const mode = (this.data as any).current_zone_mode ?? this.data.features?.current_mode;
    return this.parseOperationMode(mode);
  }

  public get requestedMode(): OperationMode {
    const mode = this.data.features?.requested_mode;
    return this.parseOperationMode(mode);
  }

  public get availableModes(): OperationMode[] {
    // Extract from device data or return all modes
    return [OperationMode.AUTO, OperationMode.HEAT, OperationMode.COOL, OperationMode.OFF];
  }

  public async setMode(mode: OperationMode): Promise<void> {
    const validMode = GeneralValidator.validateEnum<OperationMode>(mode, OperationMode, 'mode');

    if (!this.availableModes.includes(validMode)) {
      throw new ValidationError(
        `Mode '${validMode}' is not available. Available modes: ${this.availableModes.join(', ')}`,
        'mode',
        validMode
      );
    }

    const endpoint = await this.getZoneEndpoint('zone_mode');
    await this.client.post(endpoint, { zone_mode: validMode });

    await this.delayedUpdate();
  }

  // Setpoint control
  public async setTemperatures(options: TemperatureOptions): Promise<void> {
    TraneValidator.validateTemperatureConfig({
      heatTemp: options.heatingSetpoint,
      coolTemp: options.coolingSetpoint,
      setTemp: options.setTemp,
      deadband: this.thermostat.deadband,
      unit: this.thermostat.temperatureUnit
    });

    const payload: any = {};

    if (options.setTemp !== undefined) {
      // Single setpoint mode
      const roundedTemp = this.roundTemperature(options.setTemp);
      payload.setpoint = roundedTemp;
    } else {
      // Dual setpoint mode
      if (options.heatingSetpoint !== undefined) {
        const roundedHeat = this.roundTemperature(options.heatingSetpoint);
        payload.heating_setpoint = roundedHeat;
      }

      if (options.coolingSetpoint !== undefined) {
        const roundedCool = this.roundTemperature(options.coolingSetpoint);
        payload.cooling_setpoint = roundedCool;
      }
    }

    const endpoint = await this.getZoneEndpoint('setpoints');
    await this.client.post(endpoint, payload);

    await this.delayedUpdate();
  }

  public async setHeatingSetpoint(temperature: number): Promise<void> {
    await this.setTemperatures({ heatingSetpoint: temperature });
  }

  public async setCoolingSetpoint(temperature: number): Promise<void> {
    await this.setTemperatures({ coolingSetpoint: temperature });
  }

  // Status
  public get status(): ZoneStatusSummary {
    return {
      id: this.id,
      name: this.name,
      currentTemperature: this.currentTemperature,
      heatingSetpoint: this.heatingSetpoint,
      coolingSetpoint: this.coolingSetpoint,
      currentMode: this.currentMode,
      status: this.parseZoneStatus(),
      isCalling: this.isCalling,
      isInPermanentHold: this.isInPermanentHold,
      currentPreset: this.currentPreset
    };
  }

  public get isCalling(): boolean {
    return this.data.features?.is_calling || false;
  }

  // Hold/schedule control
  public get setpointStatus(): string {
    return this.data.features?.setpoint_status || 'Unknown';
  }

  public get isInPermanentHold(): boolean {
    const status = this.setpointStatus.toLowerCase();
    return status.includes('hold') && !status.includes('schedule');
  }

  public async setPermanentHold(options?: HoldOptions): Promise<void> {
    const payload: any = { run_mode: 'permanent_hold' };

    // Include temperature setpoints if provided
    if (options?.temperatures) {
      TraneValidator.validateTemperatureConfig({
        heatTemp: options.temperatures.heatingSetpoint,
        coolTemp: options.temperatures.coolingSetpoint,
        setTemp: options.temperatures.setTemp,
        deadband: this.thermostat.deadband,
        unit: this.thermostat.temperatureUnit
      });

      if (options.temperatures.heatingSetpoint !== undefined) {
        payload.heating_setpoint = this.roundTemperature(options.temperatures.heatingSetpoint);
      }

      if (options.temperatures.coolingSetpoint !== undefined) {
        payload.cooling_setpoint = this.roundTemperature(options.temperatures.coolingSetpoint);
      }

      if (options.temperatures.setTemp !== undefined) {
        payload.setpoint = this.roundTemperature(options.temperatures.setTemp);
      }
    }

    const endpoint = await this.getZoneEndpoint('run_mode');
    await this.client.post(endpoint, payload);

    await this.delayedUpdate();
  }

  public async returnToSchedule(): Promise<void> {
    const endpoint = await this.getZoneEndpoint('return_to_schedule');
    await this.client.post(endpoint, { run_mode: 'run_schedule' });

    await this.delayedUpdate();
  }

  // Preset control
  public get availablePresets(): PresetMode[] {
    const available = this.data.settings?.available_presets;
    if (Array.isArray(available)) {
      return available.map(preset => this.parsePresetMode(preset)).filter(Boolean) as PresetMode[];
    }

    // Return common presets as default
    return [PresetMode.HOME, PresetMode.AWAY, PresetMode.SLEEP, PresetMode.NONE];
  }

  public get currentPreset(): PresetMode | null {
    const preset = this.data.features?.preset || this.data.features?.preset_selected;
    return this.parsePresetMode(preset);
  }

  public async setPreset(preset: PresetMode): Promise<void> {
    const validPreset = GeneralValidator.validateEnum<PresetMode>(preset, PresetMode, 'preset');

    if (!this.availablePresets.includes(validPreset)) {
      throw new ValidationError(
        `Preset '${validPreset}' is not available. Available presets: ${this.availablePresets.join(', ')}`,
        'preset',
        validPreset
      );
    }

    const endpoint = await this.getZoneEndpoint('preset_selected');
    await this.client.post(endpoint, { preset: validPreset });

    await this.delayedUpdate();
  }

  // RoomIQ sensors
  public get sensors(): ITraneSensor[] {
    return Array.from(this.sensorsMap.values());
  }

  public get activeSensorIds(): Set<number> {
    const activeSensors = this.sensors.filter(sensor => sensor.isActive);
    return new Set(activeSensors.map(sensor => sensor.id));
  }

  public get sensorIds(): number[] {
    return Array.from(this.sensorsMap.keys());
  }

  public getSensorById(sensorId: number): ITraneSensor | undefined {
    return this.sensorsMap.get(sensorId);
  }

  public async selectActiveSensors(options: SensorSelectionOptions): Promise<void> {
    TraneValidator.validateSensorSelection({
      activeSensorIds: options.activeSensorIds,
      availableSensorIds: this.sensorIds
    });

    const { activeSensorIds, pollingDelay = 5.0, maxPolls = 8 } = options;

    // Step 1: Update active sensors
    const endpoint = await this.getZoneEndpoint('update_active_sensors');
    await this.client.post(endpoint, {
      active_sensor_ids: activeSensorIds
    });

    // Step 2: Poll for sensor state update (mimics Python's async polling)
    let pollCount = 0;
    const pollInterval = pollingDelay * 1000;

    while (pollCount < maxPolls) {
      await this.delay(pollInterval);

      try {
        await this.loadCurrentSensorState();

        // Check if the sensor selection has been applied
        const currentActiveIds = this.activeSensorIds;
        const expectedIds = new Set(activeSensorIds);

        if (this.setsAreEqual(currentActiveIds, expectedIds)) {
          break;
        }
      } catch (error) {
        console.warn(`Failed to load sensor state on poll ${pollCount + 1}:`, error);
      }

      pollCount++;
    }

    if (pollCount >= maxPolls) {
      console.warn('Sensor selection polling reached maximum attempts');
    }

    await this.delayedUpdate();
  }

  /**
   * Load current sensor state from API
   */
  public async loadCurrentSensorState(): Promise<void> {
    try {
      const endpoint = await this.getZoneEndpoint('request_current_sensor_state');
      await this.client.post(endpoint, {});

      // Small delay for the API to process the request
      await this.delay(1000);

      // Refresh zone data
      await this.thermostat.refresh();
    } catch (error) {
      console.warn('Failed to load current sensor state:', error);
    }
  }

  // Thermostat reference
  public get thermostat(): ITraneThermostat {
    return this.thermostatRef;
  }

  // Validation
  public validateTemperatureSetpoints(heatTemp: number, coolTemp: number): boolean {
    try {
      TemperatureValidator.validateSetpoints(
        heatTemp,
        coolTemp,
        this.thermostat.deadband,
        this.thermostat.temperatureUnit
      );
      return true;
    } catch {
      return false;
    }
  }

  public roundTemperature(temperature: number): number {
    return TemperatureValidator.roundTemperature(temperature, this.thermostat.temperatureUnit);
  }

  // Private helper methods

  /**
   * Initialize sensors from zone data
   */
  private initializeSensors(): void {
    this.sensorsMap.clear();

    if (!this.data.sensors) {
      return;
    }

    for (const sensorData of this.data.sensors) {
      try {
        const sensor = new TraneSensor(sensorData);
        this.sensorsMap.set(sensor.id, sensor);
      } catch (error) {
        console.warn(`Failed to create sensor ${sensorData.id}:`, error);
      }
    }
  }

  /**
   * Parse operation mode string into enum
   */
  private parseOperationMode(mode?: string): OperationMode {
    if (!mode) {
      return OperationMode.OFF;
    }

    switch (mode.toUpperCase()) {
      case 'AUTO':
        return OperationMode.AUTO;
      case 'COOL':
        return OperationMode.COOL;
      case 'HEAT':
        return OperationMode.HEAT;
      case 'OFF':
        return OperationMode.OFF;
      default:
        return OperationMode.OFF;
    }
  }

  /**
   * Parse zone status
   */
  private parseZoneStatus(): ZoneStatus {
    const status = this.data.settings?.status;
    return status === 'Calling' ? ZoneStatus.CALLING : ZoneStatus.IDLE;
  }

  /**
   * Parse preset mode string into enum
   */
  private parsePresetMode(preset?: string): PresetMode | null {
    if (!preset) {
      return null;
    }

    switch (preset) {
      case 'Home':
        return PresetMode.HOME;
      case 'Away':
        return PresetMode.AWAY;
      case 'Sleep':
        return PresetMode.SLEEP;
      case 'None':
        return PresetMode.NONE;
      default:
        return null;
    }
  }

  /**
   * Get zone endpoint URL for a specific operation
   */
  private async getZoneEndpoint(operation: string): Promise<string> {
    // Try to find endpoint from device data links first
    const selfLink = this.data._links?.self?.href;
    if (selfLink) {
      return `${selfLink}/${operation}`;
    }

    // Fallback to standard endpoint pattern
    return `${API_ENDPOINTS.ZONE}/${this.id}/${operation}`;
  }

  /**
   * Delayed update helper
   */
  private async delayedUpdate(): Promise<void> {
    await this.client.delayedUpdate(API_CONSTANTS.UPDATE_DELAY_SECONDS * 1000);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if two sets are equal
   */
  private setsAreEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
    if (set1.size !== set2.size) {
      return false;
    }

    for (const item of set1) {
      if (!set2.has(item)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get zone status summary for debugging
   */
  public getStatusSummary(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      isNativeZone: this.isNativeZone,
      currentTemperature: this.currentTemperature,
      heatingSetpoint: this.heatingSetpoint,
      coolingSetpoint: this.coolingSetpoint,
      currentMode: this.currentMode,
      requestedMode: this.requestedMode,
      isCalling: this.isCalling,
      setpointStatus: this.setpointStatus,
      isInPermanentHold: this.isInPermanentHold,
      currentPreset: this.currentPreset,
      availablePresets: this.availablePresets,
      sensorCount: this.sensors.length,
      activeSensorCount: this.activeSensorIds.size
    };
  }

  /**
   * Set temporary hold with automatic return to schedule
   */
  public async setTemporaryHold(
    temperatures: TemperatureOptions,
    durationMinutes: number = 120
  ): Promise<void> {
    // This would be a convenience method for temporary holds
    // The API might support this through different parameters
    await this.setPermanentHold({ temperatures });

    // Schedule return to schedule after duration
    setTimeout(async () => {
      try {
        await this.returnToSchedule();
      } catch (error) {
        console.warn('Failed to return to schedule after temporary hold:', error);
      }
    }, durationMinutes * 60 * 1000);
  }

  /**
   * Quick preset shortcuts
   */
  public async setHome(): Promise<void> {
    await this.setPreset(PresetMode.HOME);
  }

  public async setAway(): Promise<void> {
    await this.setPreset(PresetMode.AWAY);
  }

  public async setSleep(): Promise<void> {
    await this.setPreset(PresetMode.SLEEP);
  }

  /**
   * Get temperature difference from setpoint
   */
  public getTemperatureDifference(): {
    fromHeating: number;
    fromCooling: number;
  } {
    return {
      fromHeating: this.currentTemperature - this.heatingSetpoint,
      fromCooling: this.coolingSetpoint - this.currentTemperature
    };
  }

  /**
   * Check if zone is efficiently heated/cooled
   */
  public isAtDesiredTemperature(tolerance: number = 1): boolean {
    const current = this.currentTemperature;
    const heat = this.heatingSetpoint;
    const cool = this.coolingSetpoint;

    switch (this.currentMode) {
      case OperationMode.HEAT:
        return Math.abs(current - heat) <= tolerance;
      case OperationMode.COOL:
        return Math.abs(current - cool) <= tolerance;
      case OperationMode.AUTO:
        return current >= (heat - tolerance) && current <= (cool + tolerance);
      default:
        return true; // OFF mode
    }
  }
}
