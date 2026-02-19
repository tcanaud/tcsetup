/**
 * YAML Merge Module
 * Handles intelligent merging of YAML configuration files with deduplication
 * and proper handling of nested objects and arrays.
 *
 * Zero runtime dependencies - uses only Node.js built-ins (no external YAML libraries)
 */

// ============================================================================
// Helper Functions - Deep Equality and Comparison
// ============================================================================

/**
 * Recursively checks if two values are deeply equal
 * @param {*} a - First value to compare
 * @param {*} b - Second value to compare
 * @returns {boolean} True if values are deeply equal
 */
export function deepEqual(a, b) {
  // Primitive types
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;

  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  // Objects
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => deepEqual(a[key], b[key]));
  }

  return false;
}

// ============================================================================
// Array Deduplication
// ============================================================================

/**
 * Deduplicates an array by removing duplicate items found in the existing array
 * Uses deep equality checking
 * @param {Array} existing - Current array values
 * @param {Array} update - New items to merge
 * @returns {Array} Merged array with duplicates removed
 */
export function deduplicateArrays(existing, update) {
  if (!Array.isArray(existing)) existing = [];
  if (!Array.isArray(update)) update = [];

  const result = [...existing];
  const dedup = [];

  for (const item of update) {
    const isDuplicate = result.some((existingItem) =>
      deepEqual(item, existingItem)
    );
    if (!isDuplicate) {
      result.push(item);
      dedup.push(item);
    }
  }

  return { result, deduped: dedup.length };
}

// ============================================================================
// Object Merging
// ============================================================================

/**
 * Recursively merges two objects
 * New keys are added, existing keys are preserved, nested objects are merged recursively
 * @param {object} existing - Current object
 * @param {object} update - Object with new/updated values
 * @returns {object} Merged object
 */
export function mergeObjects(existing, update) {
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
    return update || {};
  }
  if (!update || typeof update !== 'object' || Array.isArray(update)) {
    return existing;
  }

  const result = { ...existing };

  for (const [key, value] of Object.entries(update)) {
    if (key in result) {
      // Key exists - recursively merge if both are objects
      if (
        typeof result[key] === 'object' &&
        !Array.isArray(result[key]) &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        result[key] = mergeObjects(result[key], value);
      } else if (Array.isArray(result[key]) && Array.isArray(value)) {
        // Both are arrays - deduplicate
        const { result: merged } = deduplicateArrays(result[key], value);
        result[key] = merged;
      }
      // Otherwise keep existing value (don't overwrite)
    } else {
      // New key - add it
      result[key] = value;
    }
  }

  return result;
}

// ============================================================================
// YAML Parsing and Serialization
// ============================================================================

/**
 * Simple YAML parser for basic structures (objects, arrays, strings, numbers, booleans, null)
 * Handles indentation-based structure and preserves comments
 * @param {string} content - YAML string content
 * @returns {object} Parsed YAML with { data, comments, raw }
 */
export function parseYAML(content) {
  if (!content || typeof content !== 'string') {
    return { data: {}, comments: {}, raw: content || '' };
  }

  try {
    const lines = content.split('\n');
    return { data: parseYAMLLines(lines, 0).data, comments: {}, raw: content };
  } catch (error) {
    return { data: {}, comments: {}, raw: content, parseError: error.message };
  }
}

/**
 * Recursively parse YAML lines starting at a given index and indentation level
 */
function parseYAMLLines(lines, startIdx = 0, expectedIndent = 0, parentIsArray = false) {
  const result = {};
  const items = [];
  let i = startIdx;
  let isArray = parentIsArray;
  let currentArrayItem = null;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    const indent = line.length - line.trimStart().length;

    // If indent is less than expected, we're done with this level
    if (indent < expectedIndent) {
      break;
    }

    // If indent is greater than expected, skip until we find matching indent
    if (indent > expectedIndent) {
      i++;
      continue;
    }

    // Handle array items
    if (trimmed.startsWith('- ')) {
      isArray = true;
      const itemValue = trimmed.substring(2).trim();

      // Check if next line is more indented (nested object/array)
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextTrimmed = nextLine.trim();
        const nextIndent = nextLine.length - nextLine.trimStart().length;

        if (
          nextIndent > indent &&
          !nextTrimmed.startsWith('#') &&
          nextTrimmed &&
          nextTrimmed.includes(':') &&
          !nextTrimmed.startsWith('-')
        ) {
          // Nested object in array
          const nested = parseYAMLLines(lines, i + 1, nextIndent, false);
          // If there was a value after the dash, add it as a property
          if (itemValue) {
            const [k, ...vParts] = itemValue.split(':');
            nested.data[k.trim()] = parseYAMLValue(vParts.join(':').trim());
          }
          items.push(nested.data);
          currentArrayItem = nested.data;
          i = nested.i;
          continue;
        }
      }

      // Simple array item
      if (itemValue) {
        items.push(parseYAMLValue(itemValue));
        currentArrayItem = null;
      }
      i++;
      continue;
    }

    // Handle key: value pairs
    if (trimmed.includes(':')) {
      const colonIdx = trimmed.indexOf(':');
      const key = trimmed.substring(0, colonIdx).trim();
      const valueStr = trimmed.substring(colonIdx + 1).trim();

      // If we're in an array item (next indent is array), add to current item
      if (currentArrayItem && typeof currentArrayItem === 'object' && !Array.isArray(currentArrayItem)) {
        if (!valueStr) {
          // Nested content follows
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            const nextTrimmed = nextLine.trim();
            const nextIndent = nextLine.length - nextLine.trimStart().length;

            if (nextIndent > indent && !nextTrimmed.startsWith('#') && nextTrimmed) {
              const nested = parseYAMLLines(lines, i + 1, nextIndent, nextTrimmed.startsWith('-'));
              currentArrayItem[key] = nested.data;
              i = nested.i;
              continue;
            }
          }
          currentArrayItem[key] = null;
        } else {
          currentArrayItem[key] = parseYAMLValue(valueStr);
        }
        i++;
        continue;
      }

      // Normal object key
      if (!valueStr) {
        // Nested content follows
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          const nextTrimmed = nextLine.trim();
          const nextIndent = nextLine.length - nextLine.trimStart().length;

          if (
            nextIndent > indent &&
            !nextTrimmed.startsWith('#') &&
            nextTrimmed
          ) {
            // This is nested
            const nested = parseYAMLLines(lines, i + 1, nextIndent, nextTrimmed.startsWith('-'));
            result[key] = nested.data;
            i = nested.i;
            continue;
          }
        }
        result[key] = null;
      } else {
        result[key] = parseYAMLValue(valueStr);
      }

      i++;
      continue;
    }

    i++;
  }

  return {
    data: isArray && items.length > 0 ? items : result,
    i,
  };
}

/**
 * Parse a YAML array value
 */
function parseYAMLArray(str) {
  if (!str.startsWith('[') || !str.endsWith(']')) {
    return [];
  }
  const content = str.slice(1, -1).trim();
  if (!content) return [];
  return content.split(',').map((item) => parseYAMLValue(item.trim()));
}

/**
 * Parse a YAML object value
 */
function parseYAMLObject(str) {
  if (!str.startsWith('{') || !str.endsWith('}')) {
    return {};
  }
  const content = str.slice(1, -1).trim();
  if (!content) return {};

  const obj = {};
  const pairs = content.split(',');
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split(':');
    if (key) {
      obj[key.trim()] = parseYAMLValue(valueParts.join(':').trim());
    }
  }
  return obj;
}

/**
 * Parse a single YAML value (string, number, boolean, null)
 */
function parseYAMLValue(str) {
  if (!str) return null;
  str = str.trim();

  if (str === 'null' || str === '~') return null;
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (str === '[]') return [];
  if (str === '{}') return {};

  if (str.startsWith('"') && str.endsWith('"')) {
    return str.slice(1, -1);
  }
  if (str.startsWith("'") && str.endsWith("'")) {
    return str.slice(1, -1);
  }

  // Check if it's a number (but not a version string like 1.0)
  // Version strings contain dots - keep as string
  if (str.includes('.') && str.split('.').length === 2 && str.split('.').every(part => /^\d+$/.test(part))) {
    // This looks like a version string (e.g., 1.0, 2.1.5)
    return str;
  }

  const num = Number(str);
  if (!isNaN(num) && str !== '' && !str.includes('.')) return num;

  return str;
}

/**
 * Validate YAML syntax by attempting to parse it
 * @param {string} content - YAML content to validate
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateYAML(content) {
  if (!content || typeof content !== 'string') {
    return { valid: true, errors: [] };
  }

  try {
    parseYAML(content);
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}

/**
 * Serialize JavaScript object back to YAML string
 * @param {object} obj - Object to serialize
 * @param {number} indent - Starting indentation level
 * @returns {string} YAML string
 */
export function serializeYAML(obj, indent = 0) {
  if (obj === null || obj === undefined) return '';

  const lines = [];
  const indentStr = ' '.repeat(indent);
  const nextIndentStr = ' '.repeat(indent + 2);

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (
        typeof item === 'object' &&
        item !== null &&
        !Array.isArray(item)
      ) {
        // For objects in arrays, serialize the first property inline if simple
        const keys = Object.keys(item);
        if (keys.length === 1) {
          const key = keys[0];
          const value = item[key];
          const serialized = serializeYAMLValue(value);
          lines.push(indentStr + '- ' + key + ': ' + serialized);
        } else {
          // Multiple properties - inline first, rest below
          const serialized = serializeYAML(item, indent + 2).trim();
          lines.push(indentStr + '- ' + serialized);
        }
      } else if (Array.isArray(item)) {
        lines.push(
          indentStr + '-\n' + serializeYAML(item, indent + 2)
        );
      } else {
        const value = serializeYAMLValue(item);
        lines.push(indentStr + '- ' + value);
      }
    }
  } else if (typeof obj === 'object') {
    // Sort keys to maintain consistent ordering
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      const value = obj[key];
      if (value === null || value === undefined) {
        lines.push(nextIndentStr + key + ': null');
      } else if (Array.isArray(value)) {
        lines.push(nextIndentStr + key + ':');
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            const itemSerialized = serializeYAML(item, indent + 4).trim();
            lines.push(nextIndentStr + '  - ' + itemSerialized);
          } else {
            lines.push(
              nextIndentStr +
                '  - ' +
                serializeYAMLValue(item)
            );
          }
        }
      } else if (
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        lines.push(nextIndentStr + key + ':');
        lines.push(serializeYAML(value, indent + 4));
      } else {
        const serialized = serializeYAMLValue(value);
        lines.push(nextIndentStr + key + ': ' + serialized);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Serialize a single value for YAML
 */
function serializeYAMLValue(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (value.includes(':') || value.includes('#') || value.includes('"')) {
      return '"' + value.replace(/"/g, '\\"') + '"';
    }
    return value;
  }
  return String(value);
}

// ============================================================================
// MergeChangelog - Tracks what changed during merge
// ============================================================================

class MergeChangelog {
  constructor() {
    this.added = [];
    this.deduplicated = [];
    this.preserved = [];
    this.merged = [];
    this.errors = [];
  }

  recordAdded(section, items) {
    this.added.push({
      section,
      items: items.length > 0 ? items : null,
    });
  }

  recordDeduplicated(section, count) {
    if (count > 0) {
      this.deduplicated.push({ section, count });
    }
  }

  recordPreserved(path) {
    this.preserved.push(path);
  }

  recordMerged(section, keys) {
    this.merged.push({ section, keys });
  }

  recordError(error) {
    this.errors.push(error);
  }

  toJSON() {
    return {
      added: this.added,
      deduplicated: this.deduplicated,
      preserved: this.preserved,
      merged: this.merged,
    };
  }
}

// ============================================================================
// MergeResult - Represents the outcome of a merge operation
// ============================================================================

class MergeResult {
  constructor() {
    this.success = true;
    this.data = {};
    this.errors = [];
    this.warnings = [];
    this.changelog = new MergeChangelog();
  }

  /**
   * Convert merged data back to YAML string
   */
  toYAML() {
    try {
      if (!this.data || typeof this.data !== 'object') {
        return '';
      }

      const lines = [];
      for (const [key, value] of Object.entries(this.data)) {
        if (value === null || value === undefined) {
          lines.push(key + ': null');
        } else if (Array.isArray(value)) {
          lines.push(key + ':');
          for (const item of value) {
            if (typeof item === 'object' && item !== null) {
              const serialized = serializeYAML(item, 2).trim();
              lines.push('  - ' + serialized);
            } else {
              const serialized = serializeYAMLValue(item);
              lines.push('  - ' + serialized);
            }
          }
        } else if (typeof value === 'object') {
          lines.push(key + ':');
          const serialized = serializeYAML(value, 2);
          lines.push(serialized);
        } else {
          const serialized = serializeYAMLValue(value);
          lines.push(key + ': ' + serialized);
        }
      }

      return lines.join('\n');
    } catch (error) {
      this.errors.push('Serialization error: ' + error.message);
      this.success = false;
      return '';
    }
  }

  /**
   * Validate that merged result is valid YAML
   */
  validate() {
    const errors = [];

    if (!this.data || typeof this.data !== 'object') {
      errors.push('Merged data is not an object');
    }

    // Check for valid YAML serialization
    try {
      this.toYAML();
    } catch (error) {
      errors.push('Invalid YAML output: ' + error.message);
    }

    return errors;
  }
}

// ============================================================================
// Main Merge Function
// ============================================================================

/**
 * Merges two YAML configuration strings intelligently
 * Arrays are deduplicated using deep equality
 * Objects are recursively merged with new keys added and existing keys preserved
 *
 * @param {string} existing - Current configuration (file content or empty string)
 * @param {string} update - New configuration to merge
 * @returns {MergeResult} Result object with merged data, success status, errors, warnings, and changelog
 */
export function mergeYAML(existing, update) {
  const result = new MergeResult();

  try {
    // Validate inputs
    if (typeof existing !== 'string') {
      result.errors.push('existing parameter must be a string');
      result.success = false;
      return result;
    }
    if (typeof update !== 'string') {
      result.errors.push('update parameter must be a string');
      result.success = false;
      return result;
    }

    // Parse both YAML strings
    const existingParsed = parseYAML(existing);
    const updateParsed = parseYAML(update);

    if (existingParsed.parseError) {
      result.errors.push('Existing YAML parse error: ' + existingParsed.parseError);
      result.success = false;
      return result;
    }

    if (updateParsed.parseError) {
      result.errors.push('Update YAML parse error: ' + updateParsed.parseError);
      result.success = false;
      return result;
    }

    const existingData = existingParsed.data || {};
    const updateData = updateParsed.data || {};

    // Merge the data
    result.data = mergeObjectsWithChangelog(
      existingData,
      updateData,
      result.changelog
    );

    // Validate output
    const validationErrors = result.validate();
    if (validationErrors.length > 0) {
      result.errors.push(...validationErrors);
      result.success = false;
    }

    return result;
  } catch (error) {
    result.errors.push('Merge error: ' + error.message);
    result.success = false;
    return result;
  }
}

/**
 * Merge objects while recording changelog
 */
function mergeObjectsWithChangelog(existing, update, changelog) {
  const result = { ...existing };

  for (const [key, updateValue] of Object.entries(update)) {
    if (key in result) {
      const existingValue = result[key];

      if (Array.isArray(existingValue) && Array.isArray(updateValue)) {
        const { result: merged, deduped } = deduplicateArrays(
          existingValue,
          updateValue
        );
        result[key] = merged;
        if (deduped > 0) {
          changelog.recordDeduplicated(key, deduped);
        }
      } else if (
        typeof existingValue === 'object' &&
        existingValue !== null &&
        !Array.isArray(existingValue) &&
        typeof updateValue === 'object' &&
        updateValue !== null &&
        !Array.isArray(updateValue)
      ) {
        result[key] = mergeObjectsWithChangelog(
          existingValue,
          updateValue,
          changelog
        );
      } else if (existingValue !== updateValue) {
        // Values differ - update to new value (tool updates should be applied)
        result[key] = updateValue;
      }
      // If values are equal, no change needed
    } else {
      result[key] = updateValue;
      if (Array.isArray(updateValue)) {
        changelog.recordAdded(key, updateValue);
      } else if (typeof updateValue === 'object') {
        changelog.recordAdded(key, []);
      }
    }
  }

  return result;
}

// ============================================================================
// Exports (including classes for advanced usage)
// ============================================================================

export { MergeResult, MergeChangelog };
