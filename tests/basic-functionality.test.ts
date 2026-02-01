/**
 * Basic functionality tests for the Trane library
 * Tests core classes and basic operations
 */

import {
  TraneClient,
  BrandType,
  OperationMode,
  SystemStatus,
  PresetMode,
  TemperatureUnit,
  TraneSensor
} from '../src/index';

import { testUtils } from './setup';

describe('Trane Library Basic Functionality', () => {
  describe('Constants and Enums', () => {
    test('BrandType enum should have correct values', () => {
      expect(BrandType.TRANE).toBe('trane');
    });

    test('OperationMode enum should have correct values', () => {
      expect(OperationMode.AUTO).toBe('AUTO');
      expect(OperationMode.COOL).toBe('COOL');
      expect(OperationMode.HEAT).toBe('HEAT');
      expect(OperationMode.OFF).toBe('OFF');
    });

    test('SystemStatus enum should have correct values', () => {
      expect(SystemStatus.COOLING).toBe('Cooling');
      expect(SystemStatus.HEATING).toBe('Heating');
      expect(SystemStatus.IDLE).toBe('System Idle');
      expect(SystemStatus.OFF).toBe('System Off');
    });

    test('PresetMode enum should have correct values', () => {
      expect(PresetMode.HOME).toBe('Home');
      expect(PresetMode.AWAY).toBe('Away');
      expect(PresetMode.SLEEP).toBe('Sleep');
      expect(PresetMode.NONE).toBe('None');
    });
  });

  describe('TraneClient Configuration', () => {
    test('should validate required configuration', () => {
      expect(() => {
        new TraneClient({
          username: '',
          password: 'password'
        });
      }).toThrow();

      expect(() => {
        new TraneClient({
          username: 'user@example.com',
          password: ''
        });
      }).toThrow();
    });

    test('should accept valid configuration', () => {
      expect(() => {
        new TraneClient({
          username: 'user@example.com',
          password: 'password',
          brand: BrandType.TRANE
        });
      }).not.toThrow();
    });

    test('should use default brand when not specified', () => {
      const client = new TraneClient({
        username: 'user@example.com',
        password: 'password'
      });

      expect(client.brand).toBe(BrandType.TRANE);
    });
  });

  describe('TraneSensor', () => {
    test('should create sensor with basic data', () => {
      const sensorData = testUtils.createMockSensorData();
      const sensor = new TraneSensor(sensorData as any);

      expect(sensor.id).toBe(sensorData['id']);
      expect(sensor.name).toBe(sensorData['name']);
      expect(sensor.temperature).toBe(sensorData['temperature']);
      expect(sensor.humidity).toBe(sensorData['humidity']);
    });

    test('should handle battery status correctly', () => {
      const sensorData = testUtils.createMockSensorData() as any;
      sensorData.has_battery = true;
      sensorData.battery = { level: 85, low: false, valid: true };

      const sensor = new TraneSensor(sensorData);

      expect(sensor.hasBattery).toBe(true);
      expect(sensor.batteryLevel).toBe(85);
      expect(sensor.batteryStatus).toBe('good');
    });

    test('should identify low battery correctly', () => {
      const sensorData = testUtils.createMockSensorData() as any;
      sensorData.has_battery = true;
      sensorData.battery = { level: 15, low: true, valid: true };

      const sensor = new TraneSensor(sensorData);

      expect(sensor.batteryStatus).toBe('low');
    });

    test('should identify critical battery correctly', () => {
      const sensorData = testUtils.createMockSensorData() as any;
      sensorData.has_battery = true;
      sensorData.battery = { level: 5, low: true, valid: true };

      const sensor = new TraneSensor(sensorData);

      expect(sensor.batteryStatus).toBe('critical');
    });
  });

  describe('Temperature Validation', () => {
    test('should validate Fahrenheit temperatures', () => {
      const { TemperatureValidator } = require('../src/utils/validation');

      expect(() => {
        TemperatureValidator.validateTemperature(70, TemperatureUnit.FAHRENHEIT);
      }).not.toThrow();

      expect(() => {
        TemperatureValidator.validateTemperature(30, TemperatureUnit.FAHRENHEIT);
      }).toThrow();

      expect(() => {
        TemperatureValidator.validateTemperature(100, TemperatureUnit.FAHRENHEIT);
      }).toThrow();
    });

    test('should validate Celsius temperatures', () => {
      const { TemperatureValidator } = require('../src/utils/validation');

      expect(() => {
        TemperatureValidator.validateTemperature(20, TemperatureUnit.CELSIUS);
      }).not.toThrow();

      expect(() => {
        TemperatureValidator.validateTemperature(0, TemperatureUnit.CELSIUS);
      }).toThrow();

      expect(() => {
        TemperatureValidator.validateTemperature(40, TemperatureUnit.CELSIUS);
      }).toThrow();
    });

    test('should validate deadband requirements', () => {
      const { TemperatureValidator } = require('../src/utils/validation');

      expect(() => {
        TemperatureValidator.validateSetpoints(70, 75, 3, TemperatureUnit.FAHRENHEIT);
      }).not.toThrow();

      expect(() => {
        TemperatureValidator.validateSetpoints(70, 72, 3, TemperatureUnit.FAHRENHEIT);
      }).toThrow();
    });

    test('should round temperatures correctly', () => {
      const { TemperatureValidator } = require('../src/utils/validation');

      // Fahrenheit rounds to whole numbers
      expect(TemperatureValidator.roundTemperature(70.6, TemperatureUnit.FAHRENHEIT)).toBe(71);
      expect(TemperatureValidator.roundTemperature(70.4, TemperatureUnit.FAHRENHEIT)).toBe(70);

      // Celsius rounds to 0.5 degrees
      expect(TemperatureValidator.roundTemperature(20.6, TemperatureUnit.CELSIUS)).toBe(20.5);
      expect(TemperatureValidator.roundTemperature(20.8, TemperatureUnit.CELSIUS)).toBe(21);
      expect(TemperatureValidator.roundTemperature(20.2, TemperatureUnit.CELSIUS)).toBe(20);
    });
  });

  describe('Error Handling', () => {
    test('should create proper error types', () => {
      const { ValidationError, AuthenticationError, ApiError } = require('../src/utils/errors');

      const validationError = new ValidationError('Invalid value', 'field', 'value');
      expect(validationError.name).toBe('ValidationError');
      expect(validationError.field).toBe('field');
      expect(validationError.value).toBe('value');

      const authError = new AuthenticationError('Auth failed');
      expect(authError.name).toBe('AuthenticationError');

      const apiError = new ApiError('API failed', 500);
      expect(apiError.name).toBe('ApiError');
      expect(apiError.statusCode).toBe(500);
    });
  });

  describe('JSON Utilities', () => {
    test('should find values in nested JSON', () => {
      const { JsonUtils } = require('../src/utils/json-utils');

      const testData = {
        devices: [
          { id: 1, name: 'Device 1', type: 'thermostat' },
          { id: 2, name: 'Device 2', type: 'sensor' },
          {
            id: 3,
            name: 'Device 3',
            type: 'thermostat',
            zones: [
              { id: 'zone1', name: 'Living Room' },
              { id: 'zone2', name: 'Bedroom' }
            ]
          }
        ]
      };

      const thermostat = JsonUtils.findDictWithKeyValue(testData, 'type', 'thermostat');
      expect(thermostat).toBeDefined();
      expect(thermostat.id).toBe(1);

      const zone = JsonUtils.findDictWithKeyValue(testData, 'name', 'Bedroom');
      expect(zone).toBeDefined();
      expect(zone.id).toBe('zone2');
    });

    test('should handle humidity setpoint rounding', () => {
      const { JsonUtils } = require('../src/utils/json-utils');

      expect(JsonUtils.findHumiditySetpoint(0.42)).toBeCloseTo(0.40);
      expect(JsonUtils.findHumiditySetpoint(0.48)).toBeCloseTo(0.50);
      expect(JsonUtils.findHumiditySetpoint(0.37)).toBeCloseTo(0.35);
    });

    test('should validate number strings', () => {
      const { JsonUtils } = require('../src/utils/json-utils');

      expect(JsonUtils.isNumber('123')).toBe(true);
      expect(JsonUtils.isNumber('123.45')).toBe(true);
      expect(JsonUtils.isNumber('0')).toBe(true);
      expect(JsonUtils.isNumber('--')).toBe(false);
      expect(JsonUtils.isNumber('abc')).toBe(false);
      expect(JsonUtils.isNumber('')).toBe(false);
    });
  });
});

describe('Integration Tests (Mock)', () => {
  let mockClient: TraneClient;

  beforeEach(() => {
    mockClient = new TraneClient({
      username: 'test@example.com',
      password: 'password',
      brand: BrandType.TRANE
    });
  });

  test('should initialize client without errors', () => {
    expect(mockClient.brand).toBe(BrandType.TRANE);
    expect(mockClient.username).toBe('test@example.com');
  });

  // Note: These tests would require mocking the HTTP client
  // and setting up proper test fixtures for full integration testing
});
