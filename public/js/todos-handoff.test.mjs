import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TODO_FILTER_HANDOFF,
  isHandoffTodo,
  filterTodosByView,
  countHandoffTodos,
  formatTodoCreatorLabel,
  buildHandoffAckPatch,
} from './todos-handoff.mjs';

describe('todos-handoff', () => {
  it('isHandoffTodo — true for peer-created unacknowledged open todo', () => {
    assert.equal(
      isHandoffTodo({ createdBy: '@peer', completed: false }, '@me'),
      true
    );
  });

  it('isHandoffTodo — false for self-created', () => {
    assert.equal(
      isHandoffTodo({ createdBy: '@me', completed: false }, '@me'),
      false
    );
  });

  it('isHandoffTodo — false when acknowledged', () => {
    assert.equal(
      isHandoffTodo(
        { createdBy: '@peer', handoffAcknowledgedAt: '2026-06-11T08:00:00.000Z' },
        '@me'
      ),
      false
    );
  });

  it('filterTodosByView — handoff filter keeps only peer items', () => {
    const todos = [
      { id: '1', createdBy: '@peer', completed: false },
      { id: '2', createdBy: '@me', completed: false },
      { id: '3', createdBy: '@other', completed: true },
    ];
    const out = filterTodosByView(todos, TODO_FILTER_HANDOFF, '@me');
    assert.deepEqual(out.map((t) => t.id), ['1']);
    assert.equal(countHandoffTodos(todos, '@me'), 1);
  });

  it('formatTodoCreatorLabel — prefixes @ when missing', () => {
    assert.equal(formatTodoCreatorLabel('salas'), '@salas');
    assert.equal(formatTodoCreatorLabel('@salas'), '@salas');
  });

  it('buildHandoffAckPatch — stamps ack fields', () => {
    const patch = buildHandoffAckPatch('@me');
    assert.ok(patch.handoffAcknowledgedAt);
    assert.equal(patch.handoffAcknowledgedBy, '@me');
    assert.ok(patch.updatedAt);
  });
});
