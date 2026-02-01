/**
 * Trane Homebridge Library
 * Main exports for the TypeScript Trane library
 */

// Core client
export { TraneClient } from './client/trane-client';
export { AuthManager } from './client/auth';

// Device classes
export { TraneThermostat } from './devices/trane-thermostat';
export { TraneZone } from './devices/trane-zone';
export { TraneSensor } from './devices/trane-sensor';
export { TraneAutomation } from './devices/trane-automation';

// Types and interfaces
export * from './types/constants';
export * from './types/api';
export * from './types/interfaces';

// Utilities
export * from './utils/errors';
export * from './utils/validation';
export { HttpClient, createHttpClient } from './utils/http-utils';
export { JsonUtils } from './utils/json-utils';

// Homebridge integration (to be implemented)
// export { TraneHomebridgePlatform } from './homebridge/platform';
// export { ThermostatAccessory } from './homebridge/accessories/thermostat-accessory';
// export { ZoneAccessory } from './homebridge/accessories/zone-accessory';
// export { SensorAccessory } from './homebridge/accessories/sensor-accessory';

// Version information
export const VERSION = '1.0.0';
