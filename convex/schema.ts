import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  transactions: defineTable({
    amount:        v.number(),
    categoryId:    v.string(),
    date:          v.string(),          // YYYY-MM-DD
    description:   v.string(),
    isIncome:      v.optional(v.boolean()),
    paymentMethod: v.optional(v.string()),  // cash | credit | debit | check | transfer | bit | applepay
  }).index('by_date', ['date']),

  recurringExpenses: defineTable({
    amount:          v.number(),
    categoryId:      v.string(),
    dayOfMonth:      v.number(),
    description:     v.string(),
    lastPostedMonth: v.optional(v.string()),  // YYYY-MM
    isIncome:        v.optional(v.boolean()),
    paymentMethod:   v.optional(v.string()),
  }),

  settings: defineTable({
    key:   v.string(),
    value: v.number(),
  }).index('by_key', ['key']),
});
