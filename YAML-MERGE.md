# YAML Merge Module

Intelligent YAML configuration file merging with deduplication and proper object/array handling.

## Overview

The `yaml-merge.js` module provides intelligent merging of YAML configuration files without the blind appending that was causing duplicate configurations during repeated `tcsetup update` operations.

**Key Features:**
- **Deduplication**: Array items are deduplicated using deep equality checks
- **Smart Object Merging**: Existing object keys are preserved while new keys are added
- **Nested Structure Support**: Recursively merges nested objects and handles mixed arrays/objects
- **Error Handling**: Gracefully handles invalid YAML, empty files, and type mismatches
- **Zero Dependencies**: Uses only Node.js built-ins (no external YAML libraries)

## Problem Solved

Previously, running `npx tcsetup update` multiple times would cause:
- Duplicate configuration sections in YAML files
- Repeated menu items, memories, and other array-based configurations
- File corruption from blind text appending

The yaml-merge module fixes this by intelligently merging configurations:
- Identical array items are detected and not duplicated
- New configuration sections are added only once
- User customizations are preserved
- Valid YAML syntax is maintained throughout

## API

### `mergeYAML(existing, update): MergeResult`

Main function for merging two YAML configuration strings.

**Parameters:**
- `existing` (string): Current configuration file content (or empty string)
- `update` (string): New content from tool update

**Returns:** `MergeResult` object with:
- `success` (boolean): Whether merge completed without errors
- `data` (object): Merged configuration as JavaScript object
- `errors` (Array): Fatal errors encountered
- `warnings` (Array): Non-fatal issues (e.g., dedup skipped)
- `changelog` (MergeChangelog): Detailed record of changes

**Example:**
```javascript
import { mergeYAML } from './yaml-merge.js';
import { readFileSync, writeFileSync } from 'node:fs';

const existing = readFileSync('customize.yaml', 'utf-8');
const update = readFileSync('template.yaml', 'utf-8');

const result = mergeYAML(existing, update);

if (result.success) {
  writeFileSync('customize.yaml', result.toYAML());
  console.log('Configuration updated successfully');
} else {
  console.error('Merge failed:', result.errors);
}
```

### `MergeResult` Class

Represents the outcome of a merge operation.

**Methods:**
- `toYAML()`: Converts merged data back to YAML string
- `validate()`: Returns array of validation errors (empty if valid)

### Helper Functions

**`deepEqual(a, b): boolean`**
- Recursively checks if two values are deeply equal
- Used for array deduplication

**`deduplicateArrays(existing, update): {result, deduped}`**
- Deduplicates arrays using deep equality
- Returns merged array and count of deduplicated items

**`mergeObjects(existing, update): object`**
- Recursively merges objects without overwriting existing keys
- New keys are added, nested objects are merged

**`parseYAML(content): {data, comments, raw}`**
- Simple YAML parser for basic structures
- Handles nested objects, arrays, strings, numbers, booleans, null

**`serializeYAML(obj, indent): string`**
- Converts JavaScript object back to YAML format
- Preserves proper indentation

**`validateYAML(content): {valid, errors}`**
- Validates YAML syntax
- Returns validation status and error messages

## Usage in tcsetup Updaters

The yaml-merge module is automatically integrated into:
- `packages/agreement-system/src/updater.js`
- `packages/feature-lifecycle/src/updater.js`

Both updaters now use `mergeYAML()` instead of blind text appending when updating BMAD configuration files.

### Before (Text Appending)
```javascript
const existing = readFileSync(destPath, 'utf-8');
const snippet = readFileSync(srcPath, 'utf-8');
// Blind append - causes duplicates!
writeFileSync(destPath, existing + '\n\n' + snippet);
```

### After (Intelligent Merging)
```javascript
const existing = readFileSync(destPath, 'utf-8');
const snippet = readFileSync(srcPath, 'utf-8');
const result = mergeYAML(existing, snippet);
if (result.success) {
  writeFileSync(destPath, result.toYAML());
}
```

## Merge Behavior

### Arrays (e.g., memories, menu items)

Items are deduplicated using deep equality:
```yaml
# Existing
items:
  - id: 1
    name: apple

# Update
items:
  - id: 1
    name: apple
  - id: 2
    name: banana

# Result: Both items present, id:1 not duplicated
items:
  - id: 1
    name: apple
  - id: 2
    name: banana
```

### Objects (e.g., agent config)

Keys are merged with existing values preserved:
```yaml
# Existing
agent:
  name: test
  custom: user_value

# Update
agent:
  name: test
  version: 1.0

# Result: All three keys present
agent:
  name: test
  custom: user_value
  version: 1.0
```

### Nested Structures

Nested objects and arrays are recursively merged:
```yaml
# Existing
config:
  database:
    host: localhost
    custom: value
  settings:
    - item1

# Update
config:
  database:
    host: localhost
    port: 5432
  settings:
    - item1
    - item2

# Result: Both nested structures merged
config:
  database:
    host: localhost
    custom: value
    port: 5432
  settings:
    - item1
    - item2
```

## Edge Cases Handled

1. **Empty existing file** - Creates new configuration
2. **Empty update** - Returns existing configuration unchanged
3. **Invalid YAML** - Returns error in result, original file preserved
4. **Type mismatches** - Gracefully handles array vs object conflicts
5. **Null/undefined values** - Properly distinguishes between absent and null

## Idempotency

The merger is idempotent - running the same update twice produces identical results:

```javascript
const result1 = mergeYAML(existing, update);
const yaml1 = result1.toYAML();

const result2 = mergeYAML(yaml1, update);
const yaml2 = result2.toYAML();

// yaml1 === yaml2 (idempotent!)
```

## Testing

Comprehensive test coverage includes:

**Unit Tests** (`yaml-merge.test.js`):
- 48 tests covering all functions and edge cases
- Tests for deep equality, deduplication, merging, parsing, serialization
- Tests for MergeResult and MergeChangelog

**Integration Tests** (`integration.test.js`):
- 9 tests with real file operations
- Tests idempotency, nested structures, edge cases
- Tests real-world tcsetup update scenarios

Run tests with:
```bash
node --test packages/tcsetup/tests/yaml-merge.test.js
node --test packages/tcsetup/tests/integration.test.js
```

## Performance

YAML merge operations are optimized for speed:
- Simple arrays: <1ms
- Complex nested structures: <10ms
- Performance tested to ensure <100ms for typical 500-line config files

## Limitations

The embedded YAML parser is simple and handles common structures:
- Top-level key-value pairs with nested objects/arrays
- Simple types (strings, numbers, booleans, null)
- Comments are preserved but not returned

For complex YAML features (anchors, aliases, multi-line strings, etc.), the parser may not preserve them exactly. The module is designed for straightforward configuration files typical of tcsetup use cases.

## Future Enhancements

Potential improvements:
1. Support for YAML comments preservation in output
2. Support for anchors and aliases
3. Option to preserve original formatting
4. Custom merge strategies per configuration section
5. Diff/changelog visualization

## License

MIT (inherited from kai project)
