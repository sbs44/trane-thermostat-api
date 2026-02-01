/**
 * JSON utility functions for traversing and manipulating API responses
 * Mirrors the functionality from Python util.py with TypeScript improvements
 */

import { ValidationError } from './errors';

export interface JsonTraversalOptions {
  caseSensitive?: boolean;
  maxDepth?: number;
  returnPath?: boolean;
}

export interface JsonSearchResult<T = any> {
  value: T;
  path: string[];
  depth: number;
}

export class JsonUtils {
  /**
   * Finds a dictionary/object with a specific key-value pair in nested JSON
   * Equivalent to Python's find_dict_with_keyvalue_in_json
   */
  public static findDictWithKeyValue<T = any>(
    jsonData: any,
    key: string,
    value: any,
    options: JsonTraversalOptions = {}
  ): T | undefined {
    const { caseSensitive = true, maxDepth = 50 } = options;

    const search = (data: any, currentDepth: number, path: string[] = []): T | undefined => {
      if (currentDepth > maxDepth) {
        return undefined;
      }

      if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
          const result = search(data[i], currentDepth + 1, [...path, i.toString()]);
          if (result !== undefined) {
            return result;
          }
        }
      } else if (data && typeof data === 'object') {
        // Check if current object matches the criteria
        if (this.objectHasKeyValue(data, key, value, caseSensitive)) {
          return data as T;
        }

        // Search in nested objects
        for (const [objKey, objValue] of Object.entries(data)) {
          const result = search(objValue, currentDepth + 1, [...path, objKey]);
          if (result !== undefined) {
            return result;
          }
        }
      }

      return undefined;
    };

    return search(jsonData, 0);
  }

  /**
   * Finds all dictionaries/objects with a specific key-value pair
   */
  public static findAllDictsWithKeyValue<T = any>(
    jsonData: any,
    key: string,
    value: any,
    options: JsonTraversalOptions = {}
  ): JsonSearchResult<T>[] {
    const { caseSensitive = true, maxDepth = 50, returnPath = false } = options;
    const results: JsonSearchResult<T>[] = [];

    const search = (data: any, currentDepth: number, path: string[] = []): void => {
      if (currentDepth > maxDepth) {
        return;
      }

      if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
          search(data[i], currentDepth + 1, [...path, i.toString()]);
        }
      } else if (data && typeof data === 'object') {
        // Check if current object matches the criteria
        if (this.objectHasKeyValue(data, key, value, caseSensitive)) {
          results.push({
            value: data as T,
            path: returnPath ? [...path] : [],
            depth: currentDepth
          });
        }

        // Search in nested objects
        for (const [objKey, objValue] of Object.entries(data)) {
          search(objValue, currentDepth + 1, [...path, objKey]);
        }
      }
    };

    search(jsonData, 0);
    return results;
  }

  /**
   * Gets value at a specific path in nested JSON
   */
  public static getValueAtPath<T = any>(
    jsonData: any,
    path: string | string[],
    defaultValue?: T
  ): T | undefined {
    const pathArray = Array.isArray(path) ? path : path.split('.');
    let current = jsonData;

    for (const key of pathArray) {
      if (current === null || current === undefined) {
        return defaultValue;
      }

      if (Array.isArray(current)) {
        const index = parseInt(key, 10);
        if (isNaN(index) || index < 0 || index >= current.length) {
          return defaultValue;
        }
        current = current[index];
      } else if (typeof current === 'object') {
        current = current[key];
      } else {
        return defaultValue;
      }
    }

    return current !== undefined ? current : defaultValue;
  }

  /**
   * Sets value at a specific path in nested JSON
   */
  public static setValueAtPath(
    jsonData: any,
    path: string | string[],
    value: any,
    createPath: boolean = true
  ): boolean {
    const pathArray = Array.isArray(path) ? path : path.split('.');
    if (pathArray.length === 0) {
      return false;
    }

    let current = jsonData;
    const lastKey = pathArray[pathArray.length - 1];

    // Navigate to the parent of the target
    for (let i = 0; i < pathArray.length - 1; i++) {
      const key = pathArray[i];

      if (current === null || current === undefined) {
        if (!createPath) return false;
        current = {};
      }

      if (Array.isArray(current)) {
        const index = parseInt(key, 10);
        if (isNaN(index)) return false;

        // Extend array if needed
        if (createPath) {
          while (current.length <= index) {
            current.push(undefined);
          }
        } else if (index >= current.length) {
          return false;
        }

        if (current[index] === undefined || current[index] === null) {
          if (createPath) {
            current[index] = {};
          } else {
            return false;
          }
        }
        current = current[index];
      } else if (typeof current === 'object') {
        if (!(key in current)) {
          if (createPath) {
            current[key] = {};
          } else {
            return false;
          }
        }
        current = current[key];
      } else {
        return false;
      }
    }

    // Set the final value
    if (Array.isArray(current)) {
      const index = parseInt(lastKey, 10);
      if (isNaN(index)) return false;

      if (createPath) {
        while (current.length <= index) {
          current.push(undefined);
        }
      } else if (index >= current.length) {
        return false;
      }

      current[index] = value;
    } else if (typeof current === 'object' && current !== null) {
      current[lastKey] = value;
    } else {
      return false;
    }

    return true;
  }

  /**
   * Finds humidity setpoint value and rounds to nearest 5%
   * Equivalent to Python's find_humidity_setpoint
   */
  public static findHumiditySetpoint(setpoint: number): number {
    if (typeof setpoint !== 'number' || !Number.isFinite(setpoint)) {
      throw new ValidationError('Setpoint must be a finite number');
    }

    // Round to nearest 5% (0.05 in decimal)
    return Math.round(setpoint / 0.05) * 0.05;
  }

  /**
   * Checks if a string represents a number
   * Equivalent to Python's is_number
   */
  public static isNumber(str: string): boolean {
    if (typeof str !== 'string') {
      return false;
    }

    // Handle special cases from the API
    if (str === '--' || str.trim() === '') {
      return false;
    }

    const num = parseFloat(str);
    return !isNaN(num) && isFinite(num);
  }

  /**
   * Safely converts string to number, returns null for invalid strings
   */
  public static toNumber(str: string): number | null {
    if (!this.isNumber(str)) {
      return null;
    }

    return parseFloat(str);
  }

  /**
   * Deep clones an object
   */
  public static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepClone(item)) as unknown as T;
    }

    const cloned = {} as T;
    for (const [key, value] of Object.entries(obj)) {
      (cloned as any)[key] = this.deepClone(value);
    }

    return cloned;
  }

  /**
   * Merges objects deeply
   */
  public static deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
    if (!sources.length) return target;

    const source = sources.shift();
    if (!source) return target;

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {} as any;
        }
        this.deepMerge(target[key] as Record<string, any>, source[key] as Record<string, any>);
      } else {
        target[key] = source[key] as any;
      }
    }

    return this.deepMerge(target, ...sources);
  }

  /**
   * Safely parses JSON string with error handling
   */
  public static safeParse<T = any>(jsonString: string): T | null {
    try {
      return JSON.parse(jsonString) as T;
    } catch {
      return null;
    }
  }

  /**
   * Safely stringifies object with error handling
   */
  public static safeStringify(obj: any, space?: number): string | null {
    try {
      return JSON.stringify(obj, this.jsonReplacer, space);
    } catch {
      return null;
    }
  }

  /**
   * Custom JSON replacer function for handling special values
   */
  private static jsonReplacer(_key: string, value: unknown): unknown {
    // Handle undefined values
    if (value === undefined) {
      return null;
    }

    // Handle functions (skip them)
    if (typeof value === 'function') {
      return undefined;
    }

    // Handle symbols (convert to string)
    if (typeof value === 'symbol') {
      return value.toString();
    }

    // Handle BigInt (convert to string)
    if (typeof value === 'bigint') {
      return value.toString();
    }

    return value;
  }

  /**
   * Flattens nested object to dot notation
   */
  public static flatten(obj: Record<string, any>, prefix: string = ''): Record<string, any> {
    const flattened: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this.flatten(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }

  /**
   * Unflattens dot notation object back to nested structure
   */
  public static unflatten(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      this.setValueAtPath(result, key, value, true);
    }

    return result;
  }

  /**
   * Validates JSON structure against a schema
   */
  public static validateStructure(data: any, schema: Record<string, any>): boolean {
    try {
      this.validateAgainstSchema(data, schema);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Private helper to check if object has key-value pair
   */
  private static objectHasKeyValue(
    obj: Record<string, any>,
    key: string,
    value: any,
    caseSensitive: boolean
  ): boolean {
    if (caseSensitive) {
      return obj[key] === value;
    } else {
      // Case-insensitive comparison
      const objKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
      if (!objKey) return false;

      const objValue = obj[objKey];
      if (typeof objValue === 'string' && typeof value === 'string') {
        return objValue.toLowerCase() === value.toLowerCase();
      }
      return objValue === value;
    }
  }

  /**
   * Private helper for schema validation
   */
  private static validateAgainstSchema(data: any, schema: any, path: string = 'root'): void {
    if (schema === null || schema === undefined) {
      return;
    }

    if (typeof schema === 'function') {
      if (!schema(data)) {
        throw new ValidationError(`Validation failed at ${path}`);
      }
      return;
    }

    if (Array.isArray(schema)) {
      if (!Array.isArray(data)) {
        throw new ValidationError(`Expected array at ${path}, got ${typeof data}`);
      }

      if (schema.length === 1) {
        // All items should match the schema
        data.forEach((item, index) => {
          this.validateAgainstSchema(item, schema[0], `${path}[${index}]`);
        });
      }
      return;
    }

    if (typeof schema === 'object') {
      if (typeof data !== 'object' || data === null) {
        throw new ValidationError(`Expected object at ${path}, got ${typeof data}`);
      }

      for (const [key, valueSchema] of Object.entries(schema)) {
        const dataValue = data[key];
        this.validateAgainstSchema(dataValue, valueSchema, `${path}.${key}`);
      }
      return;
    }

    // Primitive type validation
    if (typeof data !== typeof schema) {
      throw new ValidationError(
        `Expected ${typeof schema} at ${path}, got ${typeof data}`
      );
    }
  }
}

// Utility functions for common JSON operations
export function findInJson<T = unknown>(
  data: unknown,
  predicate: (value: unknown, key: string, parent: unknown) => boolean,
  options: JsonTraversalOptions = {}
): JsonSearchResult<T>[] {
  const results: JsonSearchResult<T>[] = [];
  const { maxDepth = 50, returnPath = false } = options;

  const search = (current: unknown, currentDepth: number, path: string[] = []): void => {
    if (currentDepth > maxDepth) return;

    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        if (predicate(item, index.toString(), current)) {
          results.push({
            value: item as T,
            path: returnPath ? [...path, index.toString()] : [],
            depth: currentDepth
          });
        }
        search(item, currentDepth + 1, [...path, index.toString()]);
      });
    } else if (current && typeof current === 'object') {
      Object.entries(current as Record<string, unknown>).forEach(([key, value]) => {
        if (predicate(value, key, current)) {
          results.push({
            value: value as T,
            path: returnPath ? [...path, key] : [],
            depth: currentDepth
          });
        }
        search(value, currentDepth + 1, [...path, key]);
      });
    }
  };

  search(data, 0);
  return results;
}

export function extractPaths(data: any, maxDepth: number = 10): string[] {
  const paths: string[] = [];

  const traverse = (current: any, currentPath: string, depth: number): void => {
    if (depth > maxDepth) return;

    if (Array.isArray(current)) {
      paths.push(currentPath);
      current.forEach((_, index) => {
        traverse(current[index], `${currentPath}[${index}]`, depth + 1);
      });
    } else if (current && typeof current === 'object') {
      paths.push(currentPath);
      Object.keys(current).forEach((key) => {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        traverse(current[key], newPath, depth + 1);
      });
    } else {
      paths.push(currentPath);
    }
  };

  traverse(data, '', 0);
  return paths.filter(path => path.length > 0);
}
