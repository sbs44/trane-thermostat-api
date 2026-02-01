/**
 * TraneSensor device class
 * Represents RoomIQ temperature/humidity sensors with battery monitoring
 */

import { SensorData } from '../types/api';
import { ITraneSensor } from '../types/interfaces';
import { SensorType, BATTERY_THRESHOLDS } from '../types/constants';

export class TraneSensor implements ITraneSensor {
  private readonly data: SensorData;

  constructor(data: SensorData) {
    this.data = data;
  }

  // Identification
  public get id(): number {
    return this.data.id;
  }

  public get name(): string {
    return this.data.name || 'Unknown Sensor';
  }

  public get type(): SensorType {
    // Map API type to enum, default to RoomIQ
    switch (this.data.type?.toLowerCase()) {
      case 'roomiq':
        return SensorType.ROOMIQ;
      case 'thermostat':
        return SensorType.THERMOSTAT;
      default:
        return SensorType.ROOMIQ;
    }
  }

  public get serialNumber(): string {
    return this.data.serial_number || this.data.serialNumber || 'Unknown';
  }

  // Status
  public get weight(): number {
    return this.data.weight || 0;
  }

  public get isActive(): boolean {
    return this.weight > 0;
  }

  public get isConnected(): boolean | null {
    return this.data.connected || null;
  }

  // Temperature
  public get temperature(): number {
    return this.data.temperature || 0;
  }

  public get temperatureValid(): boolean {
    return this.data.temperature_valid || false;
  }

  // Humidity
  public get humidity(): number {
    return this.data.humidity || 0;
  }

  public get humidityValid(): boolean {
    return this.data.humidity_valid || false;
  }

  // Battery (if applicable)
  public get hasBattery(): boolean {
    return this.data.has_battery || false;
  }

  public get batteryLevel(): number | null {
    if (this.data.battery?.level !== undefined) {
      return this.data.battery.level;
    }
    return this.data.battery_level || null;
  }

  public get batteryLow(): boolean | null {
    if (this.data.battery?.low !== undefined) {
      return this.data.battery.low;
    }
    return this.data.battery_low || null;
  }

  public get batteryValid(): boolean | null {
    if (this.data.battery?.valid !== undefined) {
      return this.data.battery.valid;
    }
    return this.data.battery_valid || null;
  }

  public get batteryStatus(): 'good' | 'low' | 'critical' | 'unknown' {
    if (!this.hasBattery || this.batteryLevel === null || !this.batteryValid) {
      return 'unknown';
    }

    const level = this.batteryLevel;

    if (level <= BATTERY_THRESHOLDS.CRITICAL) {
      return 'critical';
    } else if (level <= BATTERY_THRESHOLDS.LOW) {
      return 'low';
    } else {
      return 'good';
    }
  }

  // Online status
  public get hasOnlineStatus(): boolean {
    return this.data.has_online || false;
  }

  /**
   * Get sensor status summary for debugging
   */
  public getStatusSummary(): Record<string, any> {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      isActive: this.isActive,
      weight: this.weight,
      temperature: this.temperature,
      temperatureValid: this.temperatureValid,
      humidity: this.humidity,
      humidityValid: this.humidityValid,
      isConnected: this.isConnected,
      hasBattery: this.hasBattery,
      batteryLevel: this.batteryLevel,
      batteryStatus: this.batteryStatus,
      serialNumber: this.serialNumber
    };
  }

  /**
   * Check if sensor data is valid and usable
   */
  public isDataValid(): boolean {
    return (
      this.isConnected !== false &&
      (this.temperatureValid || this.humidityValid) &&
      (!this.hasBattery || this.batteryStatus !== 'critical')
    );
  }

  /**
   * Get human-readable description
   */
  public getDescription(): string {
    const parts = [this.name];

    if (this.temperatureValid) {
      parts.push(`${this.temperature}°`);
    }

    if (this.humidityValid) {
      parts.push(`${this.humidity}% humidity`);
    }

    if (this.hasBattery && this.batteryLevel !== null) {
      parts.push(`${this.batteryLevel}% battery`);
    }

    if (this.isConnected === false) {
      parts.push('(disconnected)');
    }

    return parts.join(' ');
  }

  /**
   * Compare sensors for sorting (active sensors first, then by name)
   */
  public static compare(a: ITraneSensor, b: ITraneSensor): number {
    // Active sensors first
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;

    // Then by name
    return a.name.localeCompare(b.name);
  }

  /**
   * Filter sensors by various criteria
   */
  public static filterActive(sensors: ITraneSensor[]): ITraneSensor[] {
    return sensors.filter(sensor => sensor.isActive);
  }

  public static filterConnected(sensors: ITraneSensor[]): ITraneSensor[] {
    return sensors.filter(sensor => sensor.isConnected !== false);
  }

  public static filterValidData(sensors: ITraneSensor[]): ITraneSensor[] {
    return sensors.filter(sensor => sensor.isDataValid());
  }

  public static filterBatteryPowered(sensors: ITraneSensor[]): ITraneSensor[] {
    return sensors.filter(sensor => sensor.hasBattery);
  }

  /**
   * Get sensors with low battery
   */
  public static getLowBatterySensors(sensors: ITraneSensor[]): ITraneSensor[] {
    return sensors.filter(sensor =>
      sensor.hasBattery &&
      (sensor.batteryStatus === 'low' || sensor.batteryStatus === 'critical')
    );
  }
}
