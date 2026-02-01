# Nexia Homebridge Library

A TypeScript/Node.js library for controlling Nexia/Trane/American Standard thermostats, specifically designed for Homebridge integration.

## Overview

This library provides a complete rewrite of the Python Nexia library in TypeScript, offering:

- **Full TypeScript support** with comprehensive type definitions
- **Homebridge-optimized** architecture for seamless HomeKit integration
- **Modern async/await** patterns for all API interactions
- **Multi-zone support** with individual thermostat zone control
- **RoomIQ sensor integration** for enhanced temperature monitoring
- **Comprehensive error handling** with structured error hierarchy

## Supported Devices

- **Nexia Thermostats**: XL950, XL1050, XL824, UX360
- **Trane Thermostats**: Compatible with Nexia API
- **American Standard**: Compatible with Nexia API

## Features

### Thermostat Control
- System mode control (Auto, Heat, Cool, Off)
- Temperature setpoint management with deadband validation
- Fan speed and mode control
- Emergency heat support
- Outdoor temperature monitoring
- Variable speed compressor monitoring

### Zone Management
- Individual zone temperature control
- Zone-specific mode settings
- Hold/schedule management
- Preset mode support (Home, Away, Sleep)
- RoomIQ sensor selection and monitoring

### Humidity & Air Quality
- Humidity monitoring and control
- Dehumidify/humidify setpoint management
- Air cleaner mode control (Auto, Quick, Allergy)

### Advanced Features
- ETag-based caching for efficient API usage
- Automatic session management and re-authentication
- Rate-limited login attempts to prevent account lockout
- Brand-specific URL handling (Nexia, Trane, American Standard)
- Comprehensive device capability detection

## Installation

```bash
npm install trane-thermostat-api
```

## Quick Start

```typescript
import { NexiaClient, BrandType } from 'trane-thermostat-api';

const client = new NexiaClient({
  username: 'your-email@example.com',
  password: 'your-password',
  brand: BrandType.NEXIA
});

// Authenticate and discover devices
await client.login();
const thermostats = await client.getThermostats();

// Control thermostat
const thermostat = thermostats[0];
await thermostat.setFanMode('auto');

// Control zones
const zone = thermostat.zones[0];
await zone.setTemperatures({
  heatingSetpoint: 70,
  coolingSetpoint: 75
});
```

## API Documentation

### Core Classes

#### NexiaClient
Main HTTP client for API communication and device discovery.

#### NexiaThermostat
Represents a physical thermostat with full feature detection and control.

#### NexiaZone
Represents a zone/room within a thermostat with independent temperature control.

#### NexiaSensor
RoomIQ temperature and humidity sensor with battery monitoring.

## Homebridge Integration

This library is designed specifically for Homebridge plugins. See the included platform implementation for complete HomeKit integration examples.

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run linting
npm run lint

# Watch mode for development
npm run dev
```

## Testing

The test suite includes:
- Unit tests for all core classes
- Mock HTTP responses for API testing
- Validation logic testing
- Error handling scenarios
- Integration tests with real API endpoints

```bash
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run the test suite
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

Based on the original Python Nexia library architecture, rewritten for modern TypeScript/Node.js environments with Homebridge-specific optimizations.
