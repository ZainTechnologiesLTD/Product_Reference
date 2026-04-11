import { relations } from "drizzle-orm";
import { users, sessions, products } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  products: many(products),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const productsRelations = relations(products, ({ one }) => ({
  user: one(users, { fields: [products.userId], references: [users.id] }),
}));
