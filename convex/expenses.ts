import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

// ── Transactions ──────────────────────────────────────────────────────────────

export const getTransactions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('transactions').order('desc').collect();
  },
});

export const addTransaction = mutation({
  args: {
    amount:        v.number(),
    categoryId:    v.string(),
    date:          v.string(),
    description:   v.string(),
    isIncome:      v.optional(v.boolean()),
    paymentMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('transactions', args);
  },
});

export const deleteTransaction = mutation({
  args: { id: v.id('transactions') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

// ── Recurring Expenses ────────────────────────────────────────────────────────

export const getRecurring = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('recurringExpenses').collect();
  },
});

export const addRecurring = mutation({
  args: {
    amount:        v.number(),
    categoryId:    v.string(),
    dayOfMonth:    v.number(),
    description:   v.string(),
    isIncome:      v.optional(v.boolean()),
    paymentMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('recurringExpenses', args);
  },
});

export const deleteRecurring = mutation({
  args: { id: v.id('recurringExpenses') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const updateLastPosted = mutation({
  args: {
    id:    v.id('recurringExpenses'),
    month: v.string(),
  },
  handler: async (ctx, { id, month }) => {
    await ctx.db.patch(id, { lastPostedMonth: month });
  },
});

// ── Settings (monthly budget) ─────────────────────────────────────────────────

export const getBudget = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db
      .query('settings')
      .withIndex('by_key', q => q.eq('key', 'monthlyBudget'))
      .first();
    return doc?.value ?? 3000;
  },
});

export const setBudget = mutation({
  args: { value: v.number() },
  handler: async (ctx, { value }) => {
    const existing = await ctx.db
      .query('settings')
      .withIndex('by_key', q => q.eq('key', 'monthlyBudget'))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value });
    } else {
      await ctx.db.insert('settings', { key: 'monthlyBudget', value });
    }
  },
});
