import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  hashedPassword: varchar("hashedPassword", { length: 255 }).notNull(),
  name: text("name"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ---------------------------------------------------------------------------
// Sessions (token-based, SHA-256 hashed)
// ---------------------------------------------------------------------------
export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export const products = mysqlTable(
  "products",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    reference: varchar("reference", { length: 50 }).notNull().unique(),
    sku: varchar("sku", { length: 50 }),
    description: text("description"),
    price: decimal("price", { precision: 10, scale: 2 }),
    status: mysqlEnum("status", ["active", "inactive", "discontinued"])
      .default("active")
      .notNull(),
    imageUrl: text("imageUrl"),
    tags: json("tags").$type<string[]>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_products_userId_category").on(table.userId, table.category),
    index("idx_products_userId_name").on(table.userId, table.name),
    index("idx_products_status").on(table.status),
    uniqueIndex("idx_products_sku").on(table.sku),
  ]
);

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;