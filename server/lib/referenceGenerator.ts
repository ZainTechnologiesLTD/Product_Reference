import { eq } from "drizzle-orm";
import { products } from "../../drizzle/schema";
import { getDb } from "../db";
import { logger } from "./logger";

const MAX_REFERENCE_ATTEMPTS = 20;

export function buildReferenceCandidate(categoryName: string): string {
  const prefix = categoryName
    .trim()
    .slice(0, 2)
    .toUpperCase()
    .padEnd(2, "X");
  const digits = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${prefix}${digits}`;
}

export async function referenceExists(reference: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.reference, reference))
    .limit(1);

  return result.length > 0;
}

export async function generateUniqueReference(
  categoryName: string
): Promise<string> {
  let attempts = 0;

  while (attempts < MAX_REFERENCE_ATTEMPTS) {
    const ref = buildReferenceCandidate(categoryName);

    if (!(await referenceExists(ref))) {
      logger.info(
        { reference: ref, category: categoryName },
        "Generated unique reference"
      );
      return ref;
    }

    attempts++;
    logger.warn(
      { reference: ref, attempt: attempts },
      "Reference collision, regenerating"
    );
  }

  throw new Error(
    `Failed to generate unique reference after ${MAX_REFERENCE_ATTEMPTS} attempts`
  );
}

export async function regenerateAllReferences(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  let count = 0;
  const allProducts = await db.select().from(products);

  for (const product of allProducts) {
    try {
      const newRef = await generateUniqueReference(product.category);

      await db
        .update(products)
        .set({ reference: newRef })
        .where(eq(products.id, product.id));

      count++;
    } catch (error) {
      logger.error(
        { productId: product.id, error },
        "Failed to regenerate reference for product"
      );
    }
  }

  logger.info({ count }, "Regenerated all references");
  return count;
}
