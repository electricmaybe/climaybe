import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  extractAlias,
  normalizeDomain,
  isValidShopifyDomain,
} from '../../src/lib/prompts.js';

describe('prompts (pure helpers)', () => {
  describe('extractAlias', () => {
    it('strips .myshopify.com suffix', () => {
      assert.strictEqual(extractAlias('voldt-staging.myshopify.com'), 'voldt-staging');
      assert.strictEqual(extractAlias('myshop.myshopify.com'), 'myshop');
    });

    it('is case-insensitive for suffix', () => {
      assert.strictEqual(extractAlias('store.MYShopify.COM'), 'store');
    });

    it('trims whitespace', () => {
      assert.strictEqual(extractAlias('  foo.myshopify.com  '), 'foo');
    });
  });

  describe('normalizeDomain', () => {
    it('appends .myshopify.com when missing', () => {
      assert.strictEqual(normalizeDomain('myshop'), 'myshop.myshopify.com');
      assert.strictEqual(normalizeDomain('voldt-staging'), 'voldt-staging.myshopify.com');
    });

    it('leaves domain unchanged when already .myshopify.com', () => {
      assert.strictEqual(normalizeDomain('myshop.myshopify.com'), 'myshop.myshopify.com');
    });

    it('strips protocol and path', () => {
      assert.strictEqual(normalizeDomain('https://myshop.myshopify.com/admin'), 'myshop.myshopify.com');
      assert.strictEqual(normalizeDomain('http://store.myshopify.com/'), 'store.myshopify.com');
    });

    it('lowercases result', () => {
      assert.strictEqual(normalizeDomain('MyShop.Myshopify.COM'), 'myshop.myshopify.com');
    });

    it('trims and collapses spaces', () => {
      assert.strictEqual(normalizeDomain('  myshop  '), 'myshop.myshopify.com');
    });

    it('returns empty string for empty input', () => {
      assert.strictEqual(normalizeDomain(''), '');
      assert.strictEqual(normalizeDomain('   '), '');
    });
  });

  describe('isValidShopifyDomain', () => {
    it('accepts valid subdomain.myshopify.com', () => {
      assert.strictEqual(isValidShopifyDomain('myshop.myshopify.com'), true);
      assert.strictEqual(isValidShopifyDomain('voldt-staging.myshopify.com'), true);
      assert.strictEqual(isValidShopifyDomain('a.myshopify.com'), true);
      assert.strictEqual(isValidShopifyDomain('store123.myshopify.com'), true);
    });

    it('rejects missing or wrong suffix', () => {
      assert.strictEqual(isValidShopifyDomain('myshop.com'), false);
      assert.strictEqual(isValidShopifyDomain('myshop'), false);
      assert.strictEqual(isValidShopifyDomain('myshop.myshopify.co'), false);
    });

    it('rejects leading hyphen or invalid chars in subdomain', () => {
      assert.strictEqual(isValidShopifyDomain('-myshop.myshopify.com'), false);
      assert.strictEqual(isValidShopifyDomain('my_shop.myshopify.com'), false);
      assert.strictEqual(isValidShopifyDomain('my.shop.myshopify.com'), false);
    });

    it('rejects empty', () => {
      assert.strictEqual(isValidShopifyDomain(''), false);
    });
  });
});
