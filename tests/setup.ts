// Jest setup file for global test configuration
import 'jest';

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to reduce test noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Test utilities interface
export interface TestUtils {
  createMockThermostatData: () => Record<string, unknown>;
  createMockZoneData: () => Record<string, unknown>;
  createMockSensorData: () => Record<string, unknown>;
}

// Test utilities
export const testUtils: TestUtils = {
  createMockThermostatData: () => ({
    id: 'test-thermostat-1',
    model: 'XL1050',
    firmware: '5.9.1',
    features: {
      has_zones: true,
      has_outdoor_temperature: true,
      has_relative_humidity: true,
      has_variable_speed_compressor: true,
      has_emergency_heat: true,
      has_variable_fan_speed: true,
      has_dehumidify_support: true,
      has_humidify_support: true,
      has_air_cleaner: true
    },
    settings: {
      temperature_unit: 'F',
      deadband: 3,
      system_status: 'System Idle',
      current_compressor_speed: 0.0,
      relative_humidity: 0.45,
      outdoor_temperature: 32
    },
    zones: []
  }),

  createMockZoneData: () => ({
    id: 'test-zone-1',
    name: 'Living Room',
    temperature: 72,
    features: {
      heating_setpoint: 70,
      cooling_setpoint: 75,
      current_mode: 'AUTO',
      setpoint_status: 'Following Schedule - Home',
      preset: 'Home'
    },
    settings: {},
    sensors: []
  }),

  createMockSensorData: () => ({
    id: 12345,
    name: 'Living Room Sensor',
    type: 'RoomIQ',
    serialNumber: 'ABC123DEF456',
    temperature: 72,
    humidity: 45,
    has_battery: true,
    battery: {
      level: 85,
      low: false,
      valid: true
    }
  })
};
