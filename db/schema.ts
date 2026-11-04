import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const judgeLedger = sqliteTable('judge_ledger', {
  id: text('id').primaryKey(),
  revision: integer('revision').notNull(),
  state: text('state').notNull(),
});
export const judgeRooms = sqliteTable('judge_rooms', {
  id: text('id').primaryKey(),
  ownerHash: text('owner_hash').notNull(),
  revision: integer('revision').notNull(),
  state: text('state').notNull(),
  updatedAt: text('updated_at').notNull(),
});
