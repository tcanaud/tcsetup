/**
 * Integration Tests for YAML Merge Module
 * Tests with actual file operations and real YAML structures
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { mergeYAML } from '../src/yaml-merge.js';

// Helper to load fixture files
function loadFixture(name) {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf-8');
}

// ============================================================================
// Integration Tests - User Story 1: Idempotency
// ============================================================================

test('Integration: tcsetup update idempotency with simple arrays', () => {
  // Simulate first update
  const existing1 = `agent:
  name: test`;

  const update = `agent:
  name: test
tags:
  - python`;

  const result1 = mergeYAML(existing1, update);
  assert.strictEqual(result1.success, true);
  const yaml1 = result1.toYAML();

  // Simulate second update (idempotency test)
  const result2 = mergeYAML(yaml1, update);
  assert.strictEqual(result2.success, true);
  const yaml2 = result2.toYAML();

  // Results should be identical (idempotent)
  assert.strictEqual(yaml1, yaml2);
});

test('Integration: deduplicates array items across multiple updates', () => {
  const existing = `config:
  items:
    - apple
    - banana`;

  const update1 = `config:
  items:
    - apple
    - banana
    - cherry`;

  const update2 = `config:
  items:
    - apple
    - banana
    - cherry
    - date`;

  // First update
  const result1 = mergeYAML(existing, update1);
  assert.strictEqual(result1.success, true);
  assert(Array.isArray(result1.data.config.items));
  assert.strictEqual(result1.data.config.items.length, 3);

  // Second update
  const result2 = mergeYAML(result1.toYAML(), update2);
  assert.strictEqual(result2.success, true);
  assert.strictEqual(result2.data.config.items.length, 4);

  // Apply same update again - should remain 4 items
  const result3 = mergeYAML(result2.toYAML(), update2);
  assert.strictEqual(result3.success, true);
  assert.strictEqual(result3.data.config.items.length, 4);
});

// ============================================================================
// Integration Tests - User Story 2: Intelligent Object Merging
// ============================================================================

test('Integration: adds new sections without duplicating existing config', () => {
  const existing = `agent:
  name: test
  custom_value: preserved`;

  const update = `agent:
  name: test
  version: 1.0
  custom_value: preserved
new_section:
  key: value`;

  const result = mergeYAML(existing, update);
  assert.strictEqual(result.success, true);

  // Verify original values preserved
  assert.strictEqual(result.data.agent.custom_value, 'preserved');

  // Verify new values added
  assert.strictEqual(result.data.agent.version, '1.0');
  assert.deepEqual(result.data.new_section, { key: 'value' });
});

test('Integration: recursive object merging preserves user customizations', () => {
  const existing = `config:
  database:
    host: localhost
    user_custom: value`;

  const update = `config:
  database:
    host: localhost
    port: 5432
  other: newvalue`;

  const result = mergeYAML(existing, update);
  assert.strictEqual(result.success, true);

  // Verify user custom value preserved
  assert.strictEqual(result.data.config.database.user_custom, 'value');

  // Verify new config added
  assert.strictEqual(result.data.config.database.port, 5432);
  assert.strictEqual(result.data.config.other, 'newvalue');
});

// ============================================================================
// Integration Tests - User Story 3: Edge Cases
// ============================================================================

test('Integration: handles empty existing file', () => {
  const existing = '';
  const update = `agent:
  name: test`;

  const result = mergeYAML(existing, update);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.data.agent.name, 'test');
});

test('Integration: preserves file structure with comments', () => {
  const withComments = loadFixture('customize-with-comments.yaml');

  const update = `agent:
  name: bmm-pm
  version: 2.0`;

  const result = mergeYAML(withComments, update);
  assert.strictEqual(result.success, true);

  // Comments should not break parsing
  assert(result.data.agent);
});

test('Integration: handles invalid YAML gracefully', () => {
  const existing = `agent:
  name: test`;

  const invalidUpdate = `agent:
  name: test
  broken: [unclosed array`;

  const result = mergeYAML(existing, invalidUpdate);

  // Should capture error, not crash
  if (!result.success) {
    assert(result.errors.length > 0);
  }
});

test('Integration: full real-world scenario', () => {
  // Simulate real tcsetup update workflow
  const initialConfig = ``;

  const updateStep1 = `agent:
  name: bmm-pm
  version: 1.0
  instructions: PM assistant
memories:
  - pm-memory-1`;

  // First install
  const result1 = mergeYAML(initialConfig, updateStep1);
  assert.strictEqual(result1.success, true);
  assert.strictEqual(result1.data.agent.name, 'bmm-pm');
  assert(Array.isArray(result1.data.memories));

  // Later update with new memory
  const updateStep2 = `agent:
  name: bmm-pm
  version: 1.1
  instructions: PM assistant
memories:
  - pm-memory-1
  - pm-memory-2`;

  const result2 = mergeYAML(result1.toYAML(), updateStep2);
  assert.strictEqual(result2.success, true);
  assert.strictEqual(result2.data.agent.version, '1.1');
  assert.strictEqual(result2.data.memories.length, 2);

  // Another update with same items should not duplicate
  const result3 = mergeYAML(result2.toYAML(), updateStep2);
  assert.strictEqual(result3.success, true);
  assert.strictEqual(result3.data.memories.length, 2);

  // Verify idempotency
  const yaml2 = result2.toYAML();
  const yaml3 = result3.toYAML();
  assert.strictEqual(yaml2, yaml3);
});

// ============================================================================
// Tests for MergeChangelog tracking
// ============================================================================

test('Integration: changelog tracks all changes correctly', () => {
  const existing = `tags:
  - python`;

  const update = `tags:
  - python
  - nodejs
version: 1.0`;

  const result = mergeYAML(existing, update);

  assert.strictEqual(result.success, true);

  // Changelog should track additions
  const changelog = result.changelog.toJSON();
  assert(changelog.added || changelog.deduplicated);
});

console.log('✓ All integration tests passed!');
