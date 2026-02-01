/**
 * TraneAutomation device class
 * Represents automation rules configured in Trane
 */

import { AutomationData } from '../types/api';
import { ITraneAutomation } from '../types/interfaces';
import { TraneClient } from '../client/trane-client';
import { GeneralValidator } from '../utils/validation';
import { DeviceNotFoundError } from '../utils/errors';

export class TraneAutomation implements ITraneAutomation {
  private readonly client: TraneClient;
  private readonly data: AutomationData;

  constructor(client: TraneClient, data: AutomationData) {
    this.client = client;
    this.data = data;
  }

  // Identification
  public get id(): string {
    return String(this.data.id);
  }

  public get name(): string {
    return this.data.name || 'Unknown Automation';
  }

  public get description(): string {
    return this.data.description || '';
  }

  // Control
  public get enabled(): boolean {
    return this.data.enabled || false;
  }

  public async setEnabled(enabled: boolean): Promise<void> {
    const validEnabled = GeneralValidator.validateBoolean(enabled, 'enabled');

    if (!this.data._links?.self?.href) {
      throw new DeviceNotFoundError('Automation endpoint not available', this.id, 'automation');
    }

    // Implementation would depend on API structure
    // For now, this is a placeholder
    await this.client.put(this.data._links.self.href, { enabled: validEnabled });
  }

  // Execution
  public async activate(): Promise<void> {
    if (!this.data._links?.self?.href) {
      throw new DeviceNotFoundError('Automation endpoint not available', this.id, 'automation');
    }

    // Implementation would depend on API structure
    // For now, this is a placeholder
    const activateUrl = `${this.data._links.self.href}/activate`;
    await this.client.post(activateUrl, {});
  }
}
