/**
 * Nexia Homebridge Library
 * Main exports for the TypeScript Nexia library
 */

// Core client
export { NexiaClient } from './client/nexia-client';
export { AuthManager } from './client/auth';

// Device classes
export { NexiaThermostat } from './devices/nexia-thermostat';
export { NexiaZone } from './devices/nexia-zone';
export { NexiaSensor } from './devices/nexia-sensor';
export { NexiaAutomation } from './devices/nexia-automation';

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
// export { NexiaHomebridgePlatform } from './homebridge/platform';
// export { ThermostatAccessory } from './homebridge/accessories/thermostat-accessory';
// export { ZoneAccessory } from './homebridge/accessories/zone-accessory';
// export { SensorAccessory } from './homebridge/accessories/sensor-accessory';

// Version information
export const VERSION = '1.0.0';
