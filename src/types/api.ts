/**
 * API response type definitions for Trane thermostat API
 * Based on analysis of Python library's JSON response handling
 */

import { BrandType, OperationMode, SystemStatus, PresetMode, AirCleanerMode, TemperatureUnit, ZoneStatus, DamperState } from './constants';

// Authentication response types
export interface AuthTokens {
  apiKey: string;
  mobileId: string;
  success: boolean;
}

export interface LoginRequest {
  login: string;
  password: string;
  device_uuid: string;
  device_name: string;
  app_version: string;
  is_commercial: boolean;
}

export interface LoginResponse {
  success: boolean;
  error?: string | null;
  result?: {
    api_key: string;
    mobile_id: number;
    setup_step?: string;
    locale?: string;
  };
}

export interface SessionResponse {
  success: boolean;
  error?: string | null;
  result?: {
    can_control_automations?: boolean;
    can_manage_locks?: boolean;
    can_view_videos?: boolean;
    can_receive_notifications?: boolean;
    _links?: {
      self?: LinkInfo;
      child?: SessionChildLink[];
      parent?: LinkInfo;
      stream?: LinkInfo;
    };
    // Legacy format support
    homes?: HomeInfo[];
  };
}

export interface SessionChildLink {
  href: string;
  type: string;
  data?: {
    id: number;
    name: string;
    postal_code?: string;
    items?: any[];
    _links?: any;
  };
}

export interface HomeInfo {
  house_id: number;
  name: string;
  _links?: {
    self: LinkInfo;
  };
}

// Common link structure used throughout API responses
export interface LinkInfo {
  href: string;
  method?: string;
  templated?: boolean;
}

export interface DeviceLink {
  href: string;
  type: string;
  id?: string | number;
  name?: string;
  data?: {
    items?: any[];
    [key: string]: any;
  };
}

// Main house data response
export interface HouseData {
  success: boolean;
  result: {
    _links: {
      child: DeviceLink[];
    };
    house_id: number;
    name: string;
    devices?: ThermostatData[];
    automations?: AutomationData[];
    [key: string]: any;
  };
}

// Thermostat feature detection
export interface ThermostatFeatures {
  has_zones?: boolean;
  has_outdoor_temperature?: boolean;
  has_relative_humidity?: boolean;
  has_variable_speed_compressor?: boolean;
  has_emergency_heat?: boolean;
  has_variable_fan_speed?: boolean;
  has_dehumidify_support?: boolean;
  has_humidify_support?: boolean;
  has_air_cleaner?: boolean;
  [key: string]: any;
}

// Thermostat settings and current status
export interface ThermostatSettings {
  temperature_unit?: TemperatureUnit;
  deadband?: number;
  system_status?: SystemStatus;
  current_compressor_speed?: number;
  relative_humidity?: number;
  outdoor_temperature?: number;
  fan_mode?: string;
  fan_speed?: number;
  air_cleaner_mode?: AirCleanerMode;
  emergency_heat_active?: boolean;
  scheduling_enabled?: boolean;
  humidify_setpoint?: number;
  dehumidify_setpoint?: number;
  [key: string]: any;
}

// Setpoint limits for temperature validation
export interface SetpointLimits {
  heat_min: number;
  heat_max: number;
  cool_min: number;
  cool_max: number;
}

// Available fan speed range
export interface FanSpeedLimits {
  min: number;
  max: number;
}

// Full thermostat data structure
export interface ThermostatData {
  id: string | number;
  name?: string;
  model?: string;
  firmware?: string;
  is_online?: boolean;
  features?: ThermostatFeatures;
  settings?: ThermostatSettings;
  zones?: ZoneData[];
  automations?: AutomationData[];
  _links?: {
    self?: LinkInfo;
    child?: DeviceLink[];
  };
  // Raw JSON data for dynamic endpoint discovery
  [key: string]: any;
}

// Zone feature detection
export interface ZoneFeatures {
  heating_setpoint?: number;
  cooling_setpoint?: number;
  current_mode?: OperationMode;
  requested_mode?: OperationMode;
  setpoint_status?: string;
  preset?: PresetMode;
  preset_selected?: string;
  is_calling?: boolean;
  damper_position?: DamperState;
  [key: string]: any;
}

// Zone settings and status
export interface ZoneSettings {
  temperature?: number;
  status?: ZoneStatus;
  native_zone?: boolean;
  available_presets?: string[];
  [key: string]: any;
}

// Full zone data structure
export interface ZoneData {
  id: string | number;
  name?: string;
  zone_id?: string | number; // UX360 uses different naming
  features?: ZoneFeatures;
  settings?: ZoneSettings;
  sensors?: SensorData[];
  _links?: {
    self?: LinkInfo;
    child?: DeviceLink[];
  };
  // Raw JSON data for dynamic endpoint discovery
  [key: string]: any;
}

// Battery information for sensors
export interface BatteryInfo {
  level?: number;
  low?: boolean;
  valid?: boolean;
}

// Sensor data structure
export interface SensorData {
  id: number;
  name?: string;
  type?: string;
  serial_number?: string;
  serialNumber?: string; // Alternative naming
  weight?: number;
  temperature?: number;
  temperature_valid?: boolean;
  humidity?: number;
  humidity_valid?: boolean;
  has_online?: boolean;
  connected?: boolean | null;
  has_battery?: boolean;
  battery?: BatteryInfo;
  battery_level?: number;
  battery_low?: boolean;
  battery_valid?: boolean;
  [key: string]: any;
}

// Automation data structure
export interface AutomationData {
  id: string | number;
  name?: string;
  description?: string;
  enabled?: boolean;
  _links?: {
    self?: LinkInfo;
  };
  [key: string]: any;
}

// Endpoint mapping data for dynamic API discovery
export interface EndpointMapData {
  area: string;
  area_primary_key: string;
  key: string;
  action: string;
  fallback_endpoint: string;
}

// Temperature setting options
export interface TemperatureOptions {
  heatingSetpoint?: number;
  coolingSetpoint?: number;
  setTemp?: number; // For single setpoint modes
}

// Humidity setting options
export interface HumidityOptions {
  dehumidify?: number;
  humidify?: number;
}

// Generic API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  result?: T;
  error?: string;
  [key: string]: any;
}

// Error response structure
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
}

// HTTP response with ETag support
export interface ETagResponse<T> {
  data: T;
  etag?: string;
  modified: boolean;
}

// Configuration for API client
export interface TraneClientConfig {
  username: string;
  password: string;
  brand?: BrandType;
  deviceName?: string;
  houseId?: number;
  stateFile?: string;
  timeout?: number;
  retryAttempts?: number;
}

// Device capability summary
export interface DeviceCapabilities {
  model: string;
  firmware: string;
  hasZones: boolean;
  hasOutdoorTemperature: boolean;
  hasRelativeHumidity: boolean;
  hasVariableSpeedCompressor: boolean;
  hasEmergencyHeat: boolean;
  hasVariableFanSpeed: boolean;
  hasDehumidifySupport: boolean;
  hasHumidifySupport: boolean;
  hasAirCleaner: boolean;
}

// Update options for various operations
export interface UpdateOptions {
  forceUpdate?: boolean;
  delayUpdate?: boolean;
  pollingDelay?: number;
  maxPolls?: number;
}

// Sensor selection options for RoomIQ
export interface SensorSelectionOptions {
  activeSensorIds: number[];
  pollingDelay?: number;
  maxPolls?: number;
}

// Hold/schedule operation options
export interface HoldOptions {
  temperatures?: TemperatureOptions;
  duration?: 'permanent' | 'temporary';
  endTime?: Date;
}

// Fan control options
export interface FanOptions {
  mode?: string;
  speed?: number;
  schedule?: boolean;
}

// System status summary
export interface SystemStatusSummary {
  systemStatus: SystemStatus;
  isOnline: boolean;
  isBlowerActive: boolean;
  isEmergencyHeatActive: boolean;
  currentCompressorSpeed: number;
  relativeHumidity: number | null;
  outdoorTemperature: number | null;
}

// Zone status summary
export interface ZoneStatusSummary {
  id: string;
  name: string;
  currentTemperature: number;
  heatingSetpoint: number;
  coolingSetpoint: number;
  currentMode: OperationMode;
  status: ZoneStatus;
  isCalling: boolean;
  isInPermanentHold: boolean;
  currentPreset: PresetMode | null;
}
