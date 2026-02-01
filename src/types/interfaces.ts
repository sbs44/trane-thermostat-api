/**
 * Public interfaces for the Trane library
 * These define the contract for external consumers
 */

import {
  BrandType,
  OperationMode,
  PresetMode,
  AirCleanerMode,
  TemperatureUnit,
  SensorType
} from './constants';

import {
  TemperatureOptions,
  HumidityOptions,
  FanOptions,
  HoldOptions,
  UpdateOptions,
  SensorSelectionOptions,
  DeviceCapabilities,
  SystemStatusSummary,
  ZoneStatusSummary
} from './api';

// Main client interface
export interface ITraneClient {
  // Authentication
  login(): Promise<void>;
  logout(): Promise<void>;
  isAuthenticated(): boolean;

  // Device discovery
  getThermostats(): Promise<ITraneThermostat[]>;
  getAutomations(): Promise<ITraneAutomation[]>;
  getThermostatById(id: string): ITraneThermostat | undefined;
  getAutomationById(id: string): ITraneAutomation | undefined;

  // Data refresh
  update(options?: UpdateOptions): Promise<void>;

  // Configuration
  readonly brand: BrandType;
  readonly username: string;
  getHouseId(): number | undefined;
  readonly lastUpdate: Date | null;
}

// Thermostat interface
export interface ITraneThermostat {
  // Identification
  readonly id: string;
  readonly name: string;

  // System information
  readonly model: string;
  readonly firmware: string;
  readonly isOnline: boolean;
  readonly temperatureUnit: TemperatureUnit;
  readonly deadband: number;

  // Capability detection
  readonly capabilities: DeviceCapabilities;
  readonly hasZones: boolean;
  readonly hasOutdoorTemperature: boolean;
  readonly hasRelativeHumidity: boolean;
  readonly hasVariableSpeedCompressor: boolean;
  readonly hasEmergencyHeat: boolean;
  readonly hasVariableFanSpeed: boolean;
  readonly hasDehumidifySupport: boolean;
  readonly hasHumidifySupport: boolean;
  readonly hasAirCleaner: boolean;

  // Current status
  readonly systemStatus: SystemStatusSummary;
  readonly isBlowerActive: boolean;
  readonly isEmergencyHeatActive: boolean;
  readonly currentCompressorSpeed: number;
  readonly relativeHumidity: number | null;
  readonly outdoorTemperature: number | null;

  // Setpoint limits
  readonly setpointLimits: {
    heatMin: number;
    heatMax: number;
    coolMin: number;
    coolMax: number;
  };

  // Fan control
  readonly availableFanModes: string[];
  readonly currentFanMode: string | null;
  readonly fanSpeedLimits: { min: number; max: number };
  readonly currentFanSpeed: number;
  setFanMode(mode: string): Promise<void>;
  setFanSpeed(speed: number): Promise<void>;
  setFanOptions(options: FanOptions): Promise<void>;

  // Humidity control
  readonly humidifySetpoint: number;
  readonly dehumidifySetpoint: number;
  readonly humiditySetpoints: number[];
  readonly dehumidifySetpoints: number[];
  setHumiditySetpoints(options: HumidityOptions): Promise<void>;
  setDehumidifySetpoint(value: number): Promise<void>;
  setHumidifySetpoint(value: number): Promise<void>;

  // Air cleaner
  readonly airCleanerMode: string | null;
  readonly availableAirCleanerModes: AirCleanerMode[];
  setAirCleanerMode(mode: AirCleanerMode): Promise<void>;

  // Emergency heat
  setEmergencyHeat(enabled: boolean): Promise<void>;

  // Schedule control
  setFollowSchedule(follow: boolean): Promise<void>;

  // Zone management
  readonly zones: ITraneZone[];
  readonly zoneIds: string[];
  getZoneById(zoneId: string): ITraneZone | undefined;

  // Data refresh
  refresh(): Promise<void>;
}

// Zone interface
export interface ITraneZone {
  // Identification
  readonly id: string;
  readonly name: string;
  readonly isNativeZone: boolean;

  // Temperature
  readonly currentTemperature: number;
  readonly heatingSetpoint: number;
  readonly coolingSetpoint: number;

  // Mode control
  readonly currentMode: OperationMode;
  readonly requestedMode: OperationMode;
  readonly availableModes: OperationMode[];
  setMode(mode: OperationMode): Promise<void>;

  // Setpoint control
  setTemperatures(options: TemperatureOptions): Promise<void>;
  setHeatingSetpoint(temperature: number): Promise<void>;
  setCoolingSetpoint(temperature: number): Promise<void>;

  // Status
  readonly status: ZoneStatusSummary;
  readonly isCalling: boolean;

  // Hold/schedule control
  readonly setpointStatus: string;
  readonly isInPermanentHold: boolean;
  setPermanentHold(options?: HoldOptions): Promise<void>;
  returnToSchedule(): Promise<void>;

  // Preset control
  readonly availablePresets: PresetMode[];
  readonly currentPreset: PresetMode | null;
  setPreset(preset: PresetMode): Promise<void>;

  // RoomIQ sensors
  readonly sensors: ITraneSensor[];
  readonly activeSensorIds: Set<number>;
  readonly sensorIds: number[];
  getSensorById(sensorId: number): ITraneSensor | undefined;
  selectActiveSensors(options: SensorSelectionOptions): Promise<void>;

  // Thermostat reference
  readonly thermostat: ITraneThermostat;

  // Validation
  validateTemperatureSetpoints(heatTemp: number, coolTemp: number): boolean;
  roundTemperature(temperature: number): number;
}

// Sensor interface
export interface ITraneSensor {
  // Identification
  readonly id: number;
  readonly name: string;
  readonly type: SensorType;
  readonly serialNumber: string;

  // Status
  readonly weight: number;
  readonly isActive: boolean;
  readonly isConnected: boolean | null;

  // Temperature
  readonly temperature: number;
  readonly temperatureValid: boolean;

  // Humidity
  readonly humidity: number;
  readonly humidityValid: boolean;

  // Battery (if applicable)
  readonly hasBattery: boolean;
  readonly batteryLevel: number | null;
  readonly batteryLow: boolean | null;
  readonly batteryValid: boolean | null;
  readonly batteryStatus: 'good' | 'low' | 'critical' | 'unknown';

  // Online status
  readonly hasOnlineStatus: boolean;

  // Data validation
  isDataValid(): boolean;
}

// Automation interface
export interface ITraneAutomation {
  // Identification
  readonly id: string;
  readonly name: string;
  readonly description: string;

  // Control
  readonly enabled: boolean;
  setEnabled(enabled: boolean): Promise<void>;

  // Execution
  activate(): Promise<void>;
}

// Configuration interface for client creation
export interface TraneConfig {
  username: string;
  password: string;
  brand?: BrandType;
  deviceName?: string;
  houseId?: number;
  stateFile?: string;
  timeout?: number;
  retryAttempts?: number;
}

// Event interface for notifications
export interface TraneEvent {
  type: 'update' | 'error' | 'connected' | 'disconnected';
  timestamp: Date;
  data?: any;
  error?: Error;
}

// Event listener interface
export interface ITraneEventListener {
  onUpdate?(data: any): void;
  onError?(error: Error): void;
  onConnected?(): void;
  onDisconnected?(): void;
}

// Validation interface
export interface ITemperatureValidator {
  validateSetpoints(
    heatTemp: number,
    coolTemp: number,
    deadband: number,
    unit: TemperatureUnit
  ): void;

  validateTemperature(
    temperature: number,
    unit: TemperatureUnit
  ): void;

  roundTemperature(temperature: number, unit: TemperatureUnit): number;

  convertTemperature(
    temperature: number,
    fromUnit: TemperatureUnit,
    toUnit: TemperatureUnit
  ): number;
}

// HTTP client interface
export interface IHttpClient {
  get<T>(url: string, headers?: Record<string, string>): Promise<T>;
  post<T>(url: string, data: any, headers?: Record<string, string>): Promise<T>;
  put<T>(url: string, data: any, headers?: Record<string, string>): Promise<T>;
  delete<T>(url: string, headers?: Record<string, string>): Promise<T>;
}

// Authentication manager interface
export interface IAuthManager {
  authenticate(): Promise<void>;
  refreshSession(): Promise<void>;
  isSessionValid(): boolean;
  getApiKey(): string | null;
  getMobileId(): string | null;
  getDeviceUuid(): string;
}

// Cache interface for ETag support
export interface ICache {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  clear(): void;
  has(key: string): boolean;
}

// Logger interface
export interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, error?: Error, ...args: any[]): void;
}

// Homebridge-specific interfaces
export interface IHomebridgePlatform {
  readonly api: any; // HAP-NodeJS API
  readonly log: ILogger;
  readonly config: any;

  discoverDevices(): Promise<void>;
  configureAccessory(accessory: any): void;
}

export interface IHomebridgeAccessory {
  readonly platform: IHomebridgePlatform;
  readonly accessory: any; // PlatformAccessory
  readonly device: ITraneThermostat | ITraneZone | ITraneSensor;

  setupServices(): void;
  updateCharacteristics(): void;
}

// Type guards for runtime type checking
export interface ITraneTypeGuards {
  isThermostat(device: any): device is ITraneThermostat;
  isZone(device: any): device is ITraneZone;
  isSensor(device: any): device is ITraneSensor;
  isAutomation(device: any): device is ITraneAutomation;
  isValidTemperature(value: any, unit: TemperatureUnit): boolean;
  isValidHumidity(value: any): boolean;
  isValidFanSpeed(value: any): boolean;
}
