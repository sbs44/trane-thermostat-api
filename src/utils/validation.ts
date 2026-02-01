/**
 * Validation utilities for temperature, humidity, and other parameters
 * Provides comprehensive validation with proper error handling
 */

import {
  TemperatureUnit,
  TEMPERATURE_LIMITS,
  HUMIDITY_LIMITS,
  FAN_SPEED_LIMITS,
  HUMIDITY_SETPOINT_VALUES
} from '../types/constants';

import {
  ValidationError,
  TemperatureValidationError,
  ErrorFactory
} from './errors';

export class TemperatureValidator {
  /**
   * Validates heating and cooling setpoints with deadband check
   */
  public static validateSetpoints(
    heatTemp: number,
    coolTemp: number,
    deadband: number,
    unit: TemperatureUnit
  ): void {
    // Validate individual temperatures
    this.validateTemperature(heatTemp, unit);
    this.validateTemperature(coolTemp, unit);

    // Validate deadband
    if (coolTemp - heatTemp < deadband) {
      throw ErrorFactory.createDeadbandError(heatTemp, coolTemp, deadband, unit);
    }
  }

  /**
   * Validates a single temperature value
   */
  public static validateTemperature(temperature: number, unit: TemperatureUnit): void {
    if (!Number.isFinite(temperature)) {
      throw new TemperatureValidationError(
        'Temperature must be a finite number',
        'temperature',
        temperature,
        unit
      );
    }

    const limits = this.getTemperatureLimits(unit);

    if (temperature < limits.min || temperature > limits.max) {
      throw ErrorFactory.createTemperatureError(temperature, unit, limits.min, limits.max);
    }
  }

  /**
   * Rounds temperature to appropriate precision for the unit
   */
  public static roundTemperature(temperature: number, unit: TemperatureUnit): number {
    if (!Number.isFinite(temperature)) {
      throw new ValidationError('Temperature must be a finite number');
    }

    // Celsius rounds to 0.5 degrees, Fahrenheit to whole numbers
    return unit === TemperatureUnit.CELSIUS
      ? Math.round(temperature * 2) / 2
      : Math.round(temperature);
  }

  /**
   * Converts temperature between Celsius and Fahrenheit
   */
  public static convertTemperature(
    temperature: number,
    fromUnit: TemperatureUnit,
    toUnit: TemperatureUnit
  ): number {
    if (fromUnit === toUnit) {
      return temperature;
    }

    if (fromUnit === TemperatureUnit.CELSIUS && toUnit === TemperatureUnit.FAHRENHEIT) {
      return (temperature * 9) / 5 + 32;
    }

    if (fromUnit === TemperatureUnit.FAHRENHEIT && toUnit === TemperatureUnit.CELSIUS) {
      return ((temperature - 32) * 5) / 9;
    }

    throw new ValidationError(`Unsupported temperature unit conversion: ${fromUnit} to ${toUnit}`);
  }

  /**
   * Gets temperature limits for the specified unit
   */
  public static getTemperatureLimits(unit: TemperatureUnit): { min: number; max: number } {
    switch (unit) {
      case TemperatureUnit.CELSIUS:
        return {
          min: TEMPERATURE_LIMITS.CELSIUS_MIN,
          max: TEMPERATURE_LIMITS.CELSIUS_MAX
        };
      case TemperatureUnit.FAHRENHEIT:
        return {
          min: TEMPERATURE_LIMITS.FAHRENHEIT_MIN,
          max: TEMPERATURE_LIMITS.FAHRENHEIT_MAX
        };
      default:
        throw new ValidationError(`Unsupported temperature unit: ${unit}`);
    }
  }

  /**
   * Validates temperature range compatibility with deadband
   */
  public static validateTemperatureRange(
    heatMin: number,
    heatMax: number,
    coolMin: number,
    coolMax: number,
    deadband: number,
    unit: TemperatureUnit
  ): void {
    // Validate individual limits
    this.validateTemperature(heatMin, unit);
    this.validateTemperature(heatMax, unit);
    this.validateTemperature(coolMin, unit);
    this.validateTemperature(coolMax, unit);

    // Validate ranges make sense
    if (heatMin >= heatMax) {
      throw new ValidationError('Heat minimum must be less than heat maximum');
    }

    if (coolMin >= coolMax) {
      throw new ValidationError('Cool minimum must be less than cool maximum');
    }

    // Validate deadband compatibility
    if (coolMin - heatMax < deadband) {
      throw new ValidationError(
        `Temperature ranges are incompatible with deadband requirement of ${deadband}°${unit}`
      );
    }
  }
}

export class HumidityValidator {
  /**
   * Validates humidity value (0-1 range)
   */
  public static validateHumidity(humidity: number): void {
    if (!Number.isFinite(humidity)) {
      throw new ValidationError('Humidity must be a finite number', 'humidity', humidity);
    }

    if (humidity < HUMIDITY_LIMITS.MIN || humidity > HUMIDITY_LIMITS.MAX) {
      throw new ValidationError(
        `Humidity must be between ${HUMIDITY_LIMITS.MIN * 100}% and ${HUMIDITY_LIMITS.MAX * 100}%`,
        'humidity',
        humidity
      );
    }
  }

  /**
   * Rounds humidity to nearest valid setpoint
   */
  public static roundHumidity(humidity: number): number {
    this.validateHumidity(humidity);

    // Find the nearest valid setpoint value
    let nearestValue: number = HUMIDITY_SETPOINT_VALUES[0];
    let minDiff = Math.abs(humidity - nearestValue);

    for (const value of HUMIDITY_SETPOINT_VALUES) {
      const diff = Math.abs(humidity - value);
      if (diff < minDiff) {
        minDiff = diff;
        nearestValue = value;
      }
    }

    return nearestValue;
  }

  /**
   * Validates humidity setpoint is available
   */
  public static validateHumiditySetpoint(setpoint: number): void {
    this.validateHumidity(setpoint);

    if (!HUMIDITY_SETPOINT_VALUES.includes(setpoint as any)) {
      throw new ValidationError(
        `Invalid humidity setpoint. Must be one of: ${HUMIDITY_SETPOINT_VALUES.map(v => v * 100 + '%').join(', ')}`,
        'humiditySetpoint',
        setpoint
      );
    }
  }

  /**
   * Gets available humidity setpoints as percentages (0-100)
   */
  public static getAvailableSetpoints(): number[] {
    return HUMIDITY_SETPOINT_VALUES.map(value => value * 100);
  }
}

export class FanSpeedValidator {
  /**
   * Validates fan speed (0-1 range)
   */
  public static validateFanSpeed(speed: number): void {
    if (!Number.isFinite(speed)) {
      throw new ValidationError('Fan speed must be a finite number', 'fanSpeed', speed);
    }

    if (speed < FAN_SPEED_LIMITS.MIN || speed > FAN_SPEED_LIMITS.MAX) {
      throw new ValidationError(
        `Fan speed must be between ${FAN_SPEED_LIMITS.MIN} and ${FAN_SPEED_LIMITS.MAX}`,
        'fanSpeed',
        speed
      );
    }
  }

  /**
   * Rounds fan speed to nearest 0.1
   */
  public static roundFanSpeed(speed: number): number {
    this.validateFanSpeed(speed);
    return Math.round(speed * 10) / 10;
  }

  /**
   * Validates fan speed limits configuration
   */
  public static validateFanSpeedLimits(min: number, max: number): void {
    this.validateFanSpeed(min);
    this.validateFanSpeed(max);

    if (min >= max) {
      throw new ValidationError('Minimum fan speed must be less than maximum fan speed');
    }
  }
}

export class GeneralValidator {
  /**
   * Validates required string parameter
   */
  public static validateRequiredString(value: any, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`, fieldName, value);
    }

    if (value.trim().length === 0) {
      throw new ValidationError(`${fieldName} cannot be empty`, fieldName, value);
    }

    return value.trim();
  }

  /**
   * Validates required number parameter
   */
  public static validateRequiredNumber(value: any, fieldName: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ValidationError(`${fieldName} must be a finite number`, fieldName, value);
    }

    return value;
  }

  /**
   * Validates number within range
   */
  public static validateNumberRange(
    value: number,
    min: number,
    max: number,
    fieldName: string
  ): number {
    this.validateRequiredNumber(value, fieldName);

    if (value < min || value > max) {
      throw new ValidationError(
        `${fieldName} must be between ${min} and ${max}`,
        fieldName,
        value
      );
    }

    return value;
  }

  /**
   * Validates enum value
   */
  public static validateEnum<T>(value: any, enumObject: any, fieldName: string): T {
    const validValues = Object.values(enumObject);

    if (!validValues.includes(value)) {
      throw new ValidationError(
        `${fieldName} must be one of: ${validValues.join(', ')}`,
        fieldName,
        value
      );
    }

    return value as T;
  }

  /**
   * Validates array contains only valid values
   */
  public static validateArray<T>(
    value: any,
    validator: (item: any) => T,
    fieldName: string
  ): T[] {
    if (!Array.isArray(value)) {
      throw new ValidationError(`${fieldName} must be an array`, fieldName, value);
    }

    return value.map((item, index) => {
      try {
        return validator(item);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new ValidationError(
            `${fieldName}[${index}]: ${error.message}`,
            `${fieldName}[${index}]`,
            item
          );
        }
        throw error;
      }
    });
  }

  /**
   * Validates optional parameter with default
   */
  public static validateOptional<T>(
    value: any,
    validator: (val: any) => T,
    defaultValue: T
  ): T {
    if (value === undefined || value === null) {
      return defaultValue;
    }

    return validator(value);
  }

  /**
   * Validates boolean parameter
   */
  public static validateBoolean(value: any, fieldName: string): boolean {
    if (typeof value !== 'boolean') {
      throw new ValidationError(`${fieldName} must be a boolean`, fieldName, value);
    }

    return value;
  }

  /**
   * Validates date parameter
   */
  public static validateDate(value: any, fieldName: string): Date {
    let date: Date;

    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string' || typeof value === 'number') {
      date = new Date(value);
    } else {
      throw new ValidationError(`${fieldName} must be a Date, string, or number`, fieldName, value);
    }

    if (isNaN(date.getTime())) {
      throw new ValidationError(`${fieldName} must be a valid date`, fieldName, value);
    }

    return date;
  }

  /**
   * Validates object has required properties
   */
  public static validateRequiredProperties<T extends Record<string, any>>(
    obj: any,
    requiredProps: (keyof T)[],
    objectName: string
  ): void {
    if (typeof obj !== 'object' || obj === null) {
      throw new ValidationError(`${objectName} must be an object`);
    }

    for (const prop of requiredProps) {
      if (!(prop in obj) || obj[prop] === undefined) {
        throw new ValidationError(`${objectName} must have property '${String(prop)}'`);
      }
    }
  }
}

// Combined validation utilities for common operations
export class NexiaValidator {
  /**
   * Validates complete temperature configuration
   */
  public static validateTemperatureConfig(config: {
    heatTemp?: number;
    coolTemp?: number;
    deadband: number;
    unit: TemperatureUnit;
    setTemp?: number;
  }): void {
    const { heatTemp, coolTemp, deadband, unit, setTemp } = config;

    if (setTemp !== undefined) {
      // Single setpoint mode
      TemperatureValidator.validateTemperature(setTemp, unit);
    } else if (heatTemp !== undefined && coolTemp !== undefined) {
      // Dual setpoint mode
      TemperatureValidator.validateSetpoints(heatTemp, coolTemp, deadband, unit);
    } else if (heatTemp !== undefined || coolTemp !== undefined) {
      // Only one setpoint provided
      if (heatTemp !== undefined) {
        TemperatureValidator.validateTemperature(heatTemp, unit);
      }
      if (coolTemp !== undefined) {
        TemperatureValidator.validateTemperature(coolTemp, unit);
      }
    } else {
      throw new ValidationError('At least one temperature setpoint must be provided');
    }
  }

  /**
   * Validates complete humidity configuration
   */
  public static validateHumidityConfig(config: {
    dehumidify?: number;
    humidify?: number;
  }): void {
    const { dehumidify, humidify } = config;

    if (dehumidify !== undefined) {
      HumidityValidator.validateHumiditySetpoint(dehumidify);
    }

    if (humidify !== undefined) {
      HumidityValidator.validateHumiditySetpoint(humidify);
    }

    if (dehumidify === undefined && humidify === undefined) {
      throw new ValidationError('At least one humidity setpoint must be provided');
    }

    // Validate humidify is less than dehumidify if both are provided
    if (dehumidify !== undefined && humidify !== undefined && humidify >= dehumidify) {
      throw new ValidationError('Humidify setpoint must be less than dehumidify setpoint');
    }
  }

  /**
   * Validates sensor selection configuration
   */
  public static validateSensorSelection(config: {
    activeSensorIds: number[];
    availableSensorIds: number[];
  }): void {
    const { activeSensorIds, availableSensorIds } = config;

    if (!Array.isArray(activeSensorIds)) {
      throw new ValidationError('activeSensorIds must be an array');
    }

    if (!Array.isArray(availableSensorIds)) {
      throw new ValidationError('availableSensorIds must be an array');
    }

    // Validate all active sensors are available
    for (const sensorId of activeSensorIds) {
      if (!availableSensorIds.includes(sensorId)) {
        throw new ValidationError(
          `Sensor ID ${sensorId} is not available. Available sensors: ${availableSensorIds.join(', ')}`
        );
      }
    }

    // Validate at least one sensor is selected
    if (activeSensorIds.length === 0) {
      throw new ValidationError('At least one sensor must be selected');
    }
  }
}
