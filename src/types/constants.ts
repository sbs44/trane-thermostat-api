/**
 * Constants and enums for the Trane thermostat library
 * Converted from Python version with TypeScript typing
 */

// Brand type - Trane only
export enum BrandType {
  TRANE = 'trane'
}

// Base URL for Trane API
export const BRAND_URLS = {
  [BrandType.TRANE]: 'https://www.tranehome.com'
} as const;

// API base URL (single brand)
export const API_BASE_URL = 'https://www.tranehome.com';

// Operation modes for thermostats and zones
export enum OperationMode {
  AUTO = 'AUTO',
  COOL = 'COOL',
  HEAT = 'HEAT',
  OFF = 'OFF'
}

// System status values from the API
export enum SystemStatus {
  COOLING = 'Cooling',
  HEATING = 'Heating',
  WAITING = 'Waiting...',
  IDLE = 'System Idle',
  OFF = 'System Off'
}

// Statuses where the blower is considered off
export const BLOWER_OFF_STATUSES = new Set([
  SystemStatus.WAITING,
  SystemStatus.IDLE,
  SystemStatus.OFF
]);

// Preset modes available for zones
export enum PresetMode {
  HOME = 'Home',
  AWAY = 'Away',
  SLEEP = 'Sleep',
  NONE = 'None'
}

// Preset mode indices (matching Python implementation)
export const PRESET_MODE_INDEX = {
  [PresetMode.HOME]: 0,
  [PresetMode.AWAY]: 1,
  [PresetMode.SLEEP]: 2,
  [PresetMode.NONE]: 3
} as const;

// Hold/schedule control modes
export enum HoldMode {
  PERMANENT_HOLD = 'permanent_hold',
  RUN_SCHEDULE = 'run_schedule'
}

// Air cleaner modes
export enum AirCleanerMode {
  AUTO = 'auto',
  QUICK = 'quick',
  ALLERGY = 'allergy'
}

// Fan modes commonly available
export enum FanMode {
  AUTO = 'auto',
  ON = 'on',
  CIRCULATE = 'circulate'
}

// Temperature unit constants
export enum TemperatureUnit {
  CELSIUS = 'C',
  FAHRENHEIT = 'F'
}

// Temperature limits for validation
export const TEMPERATURE_LIMITS = {
  CELSIUS_MIN: 7,
  CELSIUS_MAX: 32,
  FAHRENHEIT_MIN: 45,
  FAHRENHEIT_MAX: 90
} as const;

// Humidity control limits (as percentages 0-1)
export const HUMIDITY_LIMITS = {
  MIN: 0.10,    // 10%
  MAX: 0.65,    // 65%
  STEP: 0.05    // 5% increments
} as const;

// Humidity setpoint values available (as percentages)
export const HUMIDITY_SETPOINT_VALUES = [
  0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40,
  0.45, 0.50, 0.55, 0.60, 0.65
] as const;

// Fan speed limits (0-1 range)
export const FAN_SPEED_LIMITS = {
  MIN: 0.0,
  MAX: 1.0,
  STEP: 0.1
} as const;

// API-specific constants
export const API_CONSTANTS = {
  APP_VERSION: '6.0.0',
  UPDATE_DELAY_SECONDS: 7,
  MAX_LOGIN_ATTEMPTS: 4,
  DEFAULT_DEVICE_NAME: 'Home Automation',
  DEFAULT_POLLING_DELAY: 5.0,
  DEFAULT_MAX_POLLS: 8
} as const;

// HTTP headers required for API calls
export const API_HEADERS = {
  APP_VERSION: 'X-AppVersion',
  ASSOCIATED_BRAND: 'X-AssociatedBrand',
  MOBILE_ID: 'X-MobileId',
  API_KEY: 'X-ApiKey',
  CONTENT_TYPE: 'Content-Type',
  IF_NONE_MATCH: 'If-None-Match'
} as const;

// API endpoints (relative to base URL)
export const API_ENDPOINTS = {
  SIGN_IN: '/mobile/accounts/sign_in',
  SESSION: '/mobile/session',
  HOUSES: '/mobile/houses',
  THERMOSTAT: '/mobile/xxl_thermostats',
  ZONE: '/mobile/xxl_zones'
} as const;

// Zone status values
export enum ZoneStatus {
  IDLE = 'Idle',
  CALLING = 'Calling'
}

// Damper states
export enum DamperState {
  CLOSED = 'Damper Closed',
  OPEN = 'Damper Open'
}

// Thermostat endpoint types for dynamic routing
export enum ThermostatEndpoint {
  FAN_MODE = 'FAN_MODE',
  FAN_SPEED = 'FAN_SPEED',
  AIR_CLEANER_MODE = 'AIR_CLEANER_MODE',
  SCHEDULING_ENABLED = 'SCHEDULING_ENABLED',
  EMERGENCY_HEAT = 'EMERGENCY_HEAT',
  DEHUMIDIFY = 'DEHUMIDIFY',
  HUMIDIFY = 'HUMIDIFY'
}

// Zone endpoint types for dynamic routing
export enum ZoneEndpoint {
  ZONE_MODE = 'ZONE_MODE',
  SETPOINTS = 'SETPOINTS',
  RUN_MODE = 'RUN_MODE',
  PRESET_SELECTED = 'PRESET_SELECTED',
  RETURN_TO_SCHEDULE = 'RETURN_TO_SCHEDULE',
  UPDATE_ACTIVE_SENSORS = 'UPDATE_ACTIVE_SENSORS',
  REQUEST_CURRENT_SENSOR_STATE = 'REQUEST_CURRENT_SENSOR_STATE'
}

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  NOT_MODIFIED: 304,
  REDIRECT: 302,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
} as const;

// Sensor types
export enum SensorType {
  ROOMIQ = 'RoomIQ',
  THERMOSTAT = 'Thermostat'
}

// Battery level thresholds
export const BATTERY_THRESHOLDS = {
  LOW: 20,      // Below 20% is considered low
  CRITICAL: 10  // Below 10% is critical
} as const;
