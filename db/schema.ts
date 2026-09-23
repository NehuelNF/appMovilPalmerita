import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const streamingMatches = sqliteTable('streaming_matches', {
  malId: integer('mal_id').primaryKey(),
  animeav1Slug: text('animeav1_slug'),
  jkanimeSlug: text('jkanime_slug'),
  verifiedAt: integer('verified_at').notNull()
});
