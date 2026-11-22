import assert from 'node:assert/strict';
import test from 'node:test';
import { imageKind, redirectLoop } from '../src/admin/handle.mjs';

test('yönlendirme döngüsünü yakalar', () => {
  const rows = [
    { from: '/eski', to: '/yeni' },
    { from: '/yeni', to: '/eski' },
  ];
  assert.equal(redirectLoop(rows, '/eski', '/yeni'), true);
});

test('zincir döngü değildir', () => {
  const rows = [
    { from: '/a', to: '/b' },
    { from: '/b', to: '/c' },
  ];
  assert.equal(redirectLoop(rows, '/a', '/b'), false);
});

test('görsel imzası jpg ve png kabul eder, svg etmez', () => {
  assert.equal(imageKind(Buffer.from([0xff, 0xd8, 0xff, 0x00])), 'jpg');
  assert.equal(imageKind(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'png');
  assert.equal(imageKind(Buffer.from('<svg></svg>')), '');
});

test('AdSense kimliği pub- ve rakamdır', () => {
  assert.equal(/^pub-\d+$/.test('pub-123'), true);
  assert.equal(/^pub-\d+$/.test('ca-pub-123'), false);
  assert.equal(/^pub-\d+$/.test(''), false);
});
