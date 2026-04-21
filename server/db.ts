import {
  eq,
  and,
  or,
  like,
  sql,
  asc,
  desc,
  inArray,
  count,
  lt,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  products,
  categories,
  type Product,
  type InsertProduct,
  type Category,
} from "../drizzle/schema";
import { logger } from "./lib/logger";
import { normalizeProductName } from "./lib/normalizeProductName";

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
  sortBy:
    | "name"
    | "category"
    | "reference"
    | "status"
    | "price"
    | "createdAt"
    | "updatedAt";
  sortOrder: "asc" | "desc";
  search?: string;
  category?: string;
  status?: "active" | "inactive" | "discontinued";
  referenceContains?: string;
  skuContains?: string;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ExportListParams = {
  sortBy: PaginationParams["sortBy"];
  sortOrder: PaginationParams["sortOrder"];
  search?: string;
  category?: string;
  status?: PaginationParams["status"];
  referenceContains?: string;
  skuContains?: string;
  limit: number;
};

export async function getProductsForExport(
  userId: number,
  params: ExportListParams
): Promise<Product[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [
    eq(products.userId, userId),
    eq(products.isDeleted, false),
  ];

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

  if (params.referenceContains?.trim()) {
    conditions.push(
      like(products.reference, `%${params.referenceContains.trim()}%`)
    );
  }

  if (params.skuContains?.trim()) {
    conditions.push(like(products.sku, `%${params.skuContains.trim()}%`));
  }

  const where = and(...conditions);
  const sortColumn = products[params.sortBy] ?? products.createdAt;
  const orderFn = params.sortOrder === "asc" ? asc : desc;

  return db
    .select()
    .from(products)
    .where(where)
    .orderBy(orderFn(sortColumn))
    .limit(params.limit);
}

export async function getUserProductsPaginated(
  userId: number,
  params: PaginationParams
): Promise<PaginatedResult<Product>> {
  const db = await getDb();
  if (!db)
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: params.pageSize,
      totalPages: 0,
    };

  const conditions = [
    eq(products.userId, userId),
    eq(products.isDeleted, false),
  ];

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

  if (params.referenceContains?.trim()) {
    conditions.push(
      like(products.reference, `%${params.referenceContains.trim()}%`)
    );
  }

  if (params.skuContains?.trim()) {
    conditions.push(like(products.sku, `%${params.skuContains.trim()}%`));
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
    db.select({ total: count() }).from(products).where(where),
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

export type CreateProductInput = Omit<InsertProduct, "nameNormalized">;

export async function createProduct(
  product: CreateProductInput
): Promise<Product | null> {
  const db = await getDb();
  if (!db) return null;

  const row: InsertProduct = {
    ...product,
    nameNormalized: normalizeProductName(product.name),
  };

  await db.insert(products).values(row);
  const created = await db
    .select()
    .from(products)
    .where(eq(products.reference, row.reference))
    .limit(1);
  return created[0] ?? null;
}

export async function getProductById(
  id: number,
  userId: number
): Promise<Product | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.id, id),
        eq(products.userId, userId),
        eq(products.isDeleted, false)
      )
    )
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

  const patch: Record<string, unknown> = {
    ...updates,
    updatedAt: new Date(),
  };
  if (updates.name !== undefined) {
    patch.nameNormalized = normalizeProductName(updates.name);
  }

  await db
    .update(products)
    .set(patch as Partial<Omit<Product, "id" | "userId" | "createdAt">>)
    .where(and(eq(products.id, id), eq(products.userId, userId)));

  return await getProductById(id, userId);
}

export async function deleteProduct(
  id: number,
  userId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(products)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(
      and(
        eq(products.id, id),
        eq(products.userId, userId),
        eq(products.isDeleted, false)
      )
    );
  return true;
}

export async function bulkDeleteProducts(
  userId: number,
  ids: number[]
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const active = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.userId, userId),
        eq(products.isDeleted, false),
        inArray(products.id, ids)
      )
    );

  if (active.length === 0) return 0;

  const activeIds = active.map(r => r.id);
  await db
    .update(products)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(
      and(eq(products.userId, userId), inArray(products.id, activeIds))
    );

  return activeIds.length;
}

export async function checkProductNameExists(
  userId: number,
  name: string,
  excludeId?: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const norm = normalizeProductName(name);
  const result = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.userId, userId),
        eq(products.nameNormalized, norm),
        eq(products.isDeleted, false)
      )
    )
    .limit(1);

  if (result.length === 0) return false;
  if (excludeId && result[0].id === excludeId) return false;
  return true;
}

export type DuplicateCheckResult = {
  exists: boolean;
  productId?: number;
  rowNumber?: number;
  reference?: string;
  category?: string;
};

async function getProductRowNumber(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  productId: number
): Promise<number | undefined> {
  const row = await db
    .select({
      createdAt: products.createdAt,
      id: products.id,
    })
    .from(products)
    .where(
      and(
        eq(products.id, productId),
        eq(products.userId, userId),
        eq(products.isDeleted, false)
      )
    )
    .limit(1);

  if (!row[0]) return undefined;

  const [cnt] = await db
    .select({ n: count() })
    .from(products)
    .where(
      and(
        eq(products.userId, userId),
        eq(products.isDeleted, false),
        or(
          lt(products.createdAt, row[0].createdAt),
          and(
            eq(products.createdAt, row[0].createdAt),
            lt(products.id, row[0].id)
          )
        )
      )
    );

  return (cnt?.n ?? 0) + 1;
}

export async function checkProductDuplicate(
  userId: number,
  name: string,
  excludeId?: number
): Promise<DuplicateCheckResult> {
  const db = await getDb();
  if (!db) return { exists: false };

  const norm = normalizeProductName(name);
  const result = await db
    .select({
      id: products.id,
      reference: products.reference,
      category: products.category,
    })
    .from(products)
    .where(
      and(
        eq(products.userId, userId),
        eq(products.nameNormalized, norm),
        eq(products.isDeleted, false)
      )
    )
    .limit(1);

  if (result.length === 0) return { exists: false };
  if (excludeId && result[0].id === excludeId) return { exists: false };

  const rowNumber = await getProductRowNumber(db, userId, result[0].id);

  return {
    exists: true,
    productId: result[0].id,
    rowNumber,
    reference: result[0].reference,
    category: result[0].category,
  };
}

export async function findProductSuggestions(
  userId: number,
  searchTerm: string,
  limit = 10
): Promise<
  { id: number; name: string; category: string; reference: string }[]
> {
  const db = await getDb();
  if (!db) return [];

  const term = `%${searchTerm}%`;
  return db
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
      reference: products.reference,
    })
    .from(products)
    .where(
      and(
        eq(products.userId, userId),
        eq(products.isDeleted, false),
        like(products.name, term)
      )
    )
    .limit(limit);
}

function normalizeCategoryLabel(name: string): string {
  return name.trim().toLowerCase();
}

export async function createCategory(
  userId: number,
  name: string
): Promise<Category> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const norm = normalizeCategoryLabel(name);
  const dup = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        sql`LOWER(TRIM(${categories.name})) = ${norm}`,
        eq(categories.isDeleted, false)
      )
    )
    .limit(1);

  if (dup[0]) {
    return dup[0];
  }

  const slug = name.trim().slice(0, 2).toUpperCase().padEnd(2, "X");
  await db.insert(categories).values({
    userId,
    name: name.trim(),
    slug,
    isDeleted: false,
  });

  const created = await db
    .select()
    .from(categories)
    .where(
      and(eq(categories.userId, userId), sql`LOWER(TRIM(${categories.name})) = ${norm}`)
    )
    .limit(1);

  if (!created[0]) throw new Error("Failed to create category");

  logger.info({ categoryId: created[0].id, name: created[0].name }, "Created category");
  return created[0];
}

export async function getOrCreateCategory(
  userId: number,
  name: string
): Promise<Category> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const norm = normalizeCategoryLabel(name);

  const existing = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        sql`LOWER(TRIM(${categories.name})) = ${norm}`
      )
    )
    .limit(1);

  if (existing.length > 0) {
    if (existing[0].isDeleted) {
      await db
        .update(categories)
        .set({ isDeleted: false })
        .where(eq(categories.id, existing[0].id));
      return { ...existing[0], isDeleted: false };
    }
    return existing[0];
  }

  return createCategory(userId, name.trim());
}

export async function listUserCategories(userId: number): Promise<Category[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.isDeleted, false)))
    .orderBy(asc(categories.name));
}

export async function searchProducts(
  userId: number,
  searchTerm: string,
  page = 1,
  pageSize = 20
): Promise<PaginatedResult<Product>> {
  const db = await getDb();
  if (!db) return { items: [], total: 0, page: 1, pageSize, totalPages: 0 };

  const term = `%${searchTerm}%`;
  const conditions = [
    eq(products.userId, userId),
    eq(products.isDeleted, false),
    or(
      like(products.name, term),
      like(products.category, term),
      like(products.reference, term)
    ),
  ];

  const where = and(...conditions);

  const [itemsResult, countResult] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(desc(products.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(products).where(where),
  ]);

  const total = countResult[0]?.total ?? 0;

  return {
    items: itemsResult,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getUserProductsStats(userId: number): Promise<{
  totalProducts: number;
  totalCategories: number;
  lastProduct: { name: string; reference: string } | null;
}> {
  const db = await getDb();
  if (!db) return { totalProducts: 0, totalCategories: 0, lastProduct: null };

  const [productsCount, categoriesCount, lastProductResult] = await Promise.all(
    [
      db
        .select({ total: count() })
        .from(products)
        .where(
          and(eq(products.userId, userId), eq(products.isDeleted, false))
        ),
      db
        .select({ total: count() })
        .from(categories)
        .where(
          and(eq(categories.userId, userId), eq(categories.isDeleted, false))
        ),
      db
        .select({ name: products.name, reference: products.reference })
        .from(products)
        .where(
          and(eq(products.userId, userId), eq(products.isDeleted, false))
        )
        .orderBy(desc(products.createdAt))
        .limit(1),
    ]
  );

  return {
    totalProducts: productsCount[0]?.total ?? 0,
    totalCategories: categoriesCount[0]?.total ?? 0,
    lastProduct: lastProductResult[0] ?? null,
  };
}
