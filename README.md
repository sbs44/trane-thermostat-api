# Trane Thermostat API

A TypeScript/Node.js library for controlling Trane thermostats via the Trane Home API.

## Overview

This library provides:

- **Full TypeScript support** with comprehensive type definitions
- **Homebridge-optimized** architecture for seamless HomeKit integration
- **Modern async/await** patterns for all API interactions
- **Multi-zone support** with individual thermostat zone control
- **RoomIQ sensor integration** for enhanced temperature monitoring
- **Comprehensive error handling** with structured error hierarchy

## Supported Devices

- **Trane Thermostats**: XL850, XL950, XL1050, XL824, and other Trane Home compatible models

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
- Comprehensive device capability detection

## Installation

```bash
npm install trane-thermostat-api
```

## Quick Start

```typescript
import { TraneClient } from 'trane-thermostat-api';

const client = new TraneClient({
  username: 'your-email@example.com',
  password: 'your-password'
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

#### TraneClient
Main HTTP client for API communication and device discovery.

#### TraneThermostat
Represents a physical thermostat with full feature detection and control.

#### TraneZone
Represents a zone/room within a thermostat with independent temperature control.

#### TraneSensor
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
