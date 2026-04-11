import { eq, and, or, like, sql, asc, desc, inArray, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users, products, type Product, type InsertProduct } from "../drizzle/schema";
import { logger } from "./lib/logger";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      logger.warn({ error }, "Failed to connect to database");
      _db = null;
    }
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Product Queries
// ---------------------------------------------------------------------------

export type PaginationParams = {
  page: number;
  pageSize: number;
  sortBy: "name" | "category" | "reference" | "status" | "price" | "createdAt" | "updatedAt";
  sortOrder: "asc" | "desc";
  search?: string;
  category?: string;
  status?: "active" | "inactive" | "discontinued";
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getUserProductsPaginated(
  userId: number,
  params: PaginationParams
): Promise<PaginatedResult<Product>> {
  const db = await getDb();
  if (!db) return { items: [], total: 0, page: 1, pageSize: params.pageSize, totalPages: 0 };

  const conditions = [eq(products.userId, userId)];

  if (params.search) {
    const term = `%${params.search}%`;
    conditions.push(
      or(
        like(products.name, term),
        like(products.category, term),
        like(products.reference, term),
        like(products.sku, term)
      )!
    );
  }

  if (params.category) {
    conditions.push(eq(products.category, params.category));
  }

  if (params.status) {
    conditions.push(eq(products.status, params.status));
  }

  const where = and(...conditions);

  const sortColumn = products[params.sortBy] ?? products.createdAt;
  const orderFn = params.sortOrder === "asc" ? asc : desc;

  const [itemsResult, countResult] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(orderFn(sortColumn))
      .limit(params.pageSize)
      .offset((params.page - 1) * params.pageSize),
    db
      .select({ total: count() })
      .from(products)
      .where(where),
  ]);

  const total = countResult[0]?.total ?? 0;

  return {
    items: itemsResult,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  };
}

export async function createProduct(product: InsertProduct): Promise<Product | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(products).values(product);
  const created = await db
    .select()
    .from(products)
    .where(eq(products.reference, product.reference))
    .limit(1);
  return created[0] ?? null;
}

export async function getProductById(id: number, userId: number): Promise<Product | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.userId, userId)))
    .limit(1);
  return result[0] ?? null;
}

export async function updateProduct(
  id: number,
  userId: number,
  updates: Partial<Omit<Product, "id" | "userId" | "createdAt">>
): Promise<Product | null> {
  const db = await getDb();
  if (!db) return null;

  await db
    .update(products)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(products.id, id), eq(products.userId, userId)));

  return await getProductById(id, userId);
}

export async function deleteProduct(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db.delete(products).where(and(eq(products.id, id), eq(products.userId, userId)));
  return true;
}

export async function bulkDeleteProducts(userId: number, ids: number[]): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  await db
    .delete(products)
    .where(and(eq(products.userId, userId), inArray(products.id, ids)));
  return ids.length;
}

export async function checkProductNameExists(
  userId: number,
  name: string,
  excludeId?: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.userId, userId), eq(products.name, name)))
    .limit(1);

  if (result.length === 0) return false;
  if (excludeId && result[0].id === excludeId) return false;
  return true;
}
