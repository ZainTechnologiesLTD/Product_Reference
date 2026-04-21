import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const mockUser = {
  id: 1,
  username: "testuser",
  email: "test@example.com",
  name: "Test User",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAdminUser = {
  id: 2,
  username: "adminuser",
  email: "admin@example.com",
  name: "Admin User",
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMockContext(
  user: typeof mockUser | null = mockUser
): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
      cookies: {},
    } as unknown as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

let testCounter = 0;
function getUniqueId() {
  return ++testCounter;
}

/** Integration tests need MySQL + migrations (incl. nameNormalized). */
const hasDb = Boolean(process.env.DATABASE_URL?.trim());

describe("Products Router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    caller = appRouter.createCaller(createMockContext());
  });

  describe("products.list", () => {
    it("should return paginated list of products", async () => {
      const result = await caller.products.list();
      expect(result).toHaveProperty("items");
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("page");
      expect(result).toHaveProperty("pageSize");
      expect(result).toHaveProperty("totalPages");
      expect(Array.isArray(result.items)).toBe(true);
    });

    it("should require authentication", async () => {
      const unauthedCaller = appRouter.createCaller(createMockContext(null));
      try {
        await unauthedCaller.products.list();
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe.skipIf(!hasDb)("products.create", () => {
    it("should create a product with valid input and server reference", async () => {
      const id = getUniqueId();
      const result = await caller.products.create({
        name: `Test Product ${id}`,
        category: "Electronics",
      });

      expect(result).toBeDefined();
      expect(result.name).toBe(`Test Product ${id}`);
      expect(result.category).toBe("Electronics");
      expect(result.reference).toMatch(/^[A-Z]{2}\d{3}$/);
      expect(result.reference.slice(0, 2)).toBe("EL");
      expect(result.userId).toBe(mockUser.id);
    });

    it("should reject product with empty name", async () => {
      try {
        await caller.products.create({
          name: "",
          category: "Electronics",
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).toContain("required");
      }
    });

    it("should reject product with empty category", async () => {
      try {
        await caller.products.create({
          name: `Valid Name ${getUniqueId()}`,
          category: "",
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).toContain("required");
      }
    });

    it("should reject duplicate product names", async () => {
      const id = getUniqueId();
      const uniqueName = `Unique Product ${id}`;

      await caller.products.create({
        name: uniqueName,
        category: "Electronics",
      });

      try {
        await caller.products.create({
          name: uniqueName,
          category: "Different Category",
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe("CONFLICT");
        expect(error.message).toContain("already exists");
      }
    });

    it("should reject duplicate names case-insensitively", async () => {
      const id = getUniqueId();
      const name = `Case Dup ${id}`;
      await caller.products.create({
        name,
        category: "Test",
      });
      try {
        await caller.products.create({
          name: name.toUpperCase(),
          category: "Other",
        });
        expect.fail("Should have thrown");
      } catch (error: any) {
        expect(error.code).toBe("CONFLICT");
      }
    });

    it("should require authentication", async () => {
      const unauthedCaller = appRouter.createCaller(createMockContext(null));
      try {
        await unauthedCaller.products.create({
          name: `Test ${getUniqueId()}`,
          category: "Test",
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe.skipIf(!hasDb)("products.checkDuplicate", () => {
    it("returns row metadata for existing name", async () => {
      const id = getUniqueId();
      const name = `DupMeta ${id}`;
      await caller.products.create({ name, category: "Cat" });
      const d = await caller.products.checkDuplicate({
        name: name.toLowerCase(),
      });
      expect(d.exists).toBe(true);
      expect(d.productId).toBeDefined();
      expect(d.reference).toMatch(/^[A-Z]{2}\d{3}$/);
      expect(d.rowNumber).toBeGreaterThan(0);
    });
  });

  describe.skipIf(!hasDb)("products.getById", () => {
    it("should get product by id", async () => {
      const id = getUniqueId();
      const created = await caller.products.create({
        name: `Get By ID Test ${id}`,
        category: "Test",
      });

      const result = await caller.products.getById({ id: created.id });
      expect(result).toBeDefined();
      expect(result?.name).toBe(`Get By ID Test ${id}`);
    });

    it("should return null for non-existent product", async () => {
      const result = await caller.products.getById({ id: 999999 });
      expect(result).toBeNull();
    });

    it("should not return product from another user", async () => {
      const id = getUniqueId();
      const created = await caller.products.create({
        name: `User 1 Product ${id}`,
        category: "Test",
      });

      const otherUserCaller = appRouter.createCaller(
        createMockContext(mockAdminUser)
      );
      const result = await otherUserCaller.products.getById({ id: created.id });
      expect(result).toBeNull();
    });
  });

  describe.skipIf(!hasDb)("products.update", () => {
    it("should update product name", async () => {
      const id = getUniqueId();
      const created = await caller.products.create({
        name: `Original Name ${id}`,
        category: "Test",
      });

      const updated = await caller.products.update({
        id: created.id,
        name: `Updated Name ${id}`,
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe(`Updated Name ${id}`);
    });

    it("should update product category", async () => {
      const id = getUniqueId();
      const created = await caller.products.create({
        name: `Category Test ${id}`,
        category: "Original",
      });

      const updated = await caller.products.update({
        id: created.id,
        category: "Updated",
      });

      expect(updated?.category).toBe("Updated");
    });

    it("should reject update for non-existent product", async () => {
      try {
        await caller.products.update({
          id: 999999,
          name: `New Name ${getUniqueId()}`,
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe("NOT_FOUND");
      }
    });

    it("should prevent duplicate names on update", async () => {
      const id = getUniqueId();
      const product1 = await caller.products.create({
        name: `Product A ${id}`,
        category: "Test",
      });

      await caller.products.create({
        name: `Product B ${id}`,
        category: "Test",
      });

      try {
        await caller.products.update({
          id: product1.id,
          name: `Product B ${id}`,
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe("CONFLICT");
      }
    });
  });

  describe.skipIf(!hasDb)("products.delete", () => {
    it("should soft-delete product", async () => {
      const id = getUniqueId();
      const created = await caller.products.create({
        name: `Delete Test ${id}`,
        category: "Test",
      });

      const result = await caller.products.delete({ id: created.id });
      expect(result.success).toBe(true);

      const fetched = await caller.products.getById({ id: created.id });
      expect(fetched).toBeNull();
    });

    it("should reject delete for non-existent product", async () => {
      try {
        await caller.products.delete({ id: 999999 });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe("NOT_FOUND");
      }
    });

    it("should not delete product from another user", async () => {
      const id = getUniqueId();
      const created = await caller.products.create({
        name: `User 1 Product Delete ${id}`,
        category: "Test",
      });

      const otherUserCaller = appRouter.createCaller(
        createMockContext(mockAdminUser)
      );

      try {
        await otherUserCaller.products.delete({ id: created.id });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe("NOT_FOUND");
      }

      const fetched = await caller.products.getById({ id: created.id });
      expect(fetched).toBeDefined();
    });
  });

  describe.skipIf(!hasDb)("Data Isolation", () => {
    it("should isolate products between users", async () => {
      const id = getUniqueId();
      const user1Caller = appRouter.createCaller(createMockContext(mockUser));
      const user2Caller = appRouter.createCaller(
        createMockContext(mockAdminUser)
      );

      const user1Product = await user1Caller.products.create({
        name: `User 1 Only ${id}`,
        category: "Test",
      });

      const user2Product = await user2Caller.products.create({
        name: `User 2 Only ${id}`,
        category: "Test",
      });

      const user1List = await user1Caller.products.list();
      const user1Ids = user1List.items.map(p => p.id);
      expect(user1Ids).toContain(user1Product.id);
      expect(user1Ids).not.toContain(user2Product.id);

      const user2List = await user2Caller.products.list();
      const user2Ids = user2List.items.map(p => p.id);
      expect(user2Ids).toContain(user2Product.id);
      expect(user2Ids).not.toContain(user1Product.id);
    });
  });
});
