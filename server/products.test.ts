import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock user context (matches new schema: no openId, loginMethod, lastSignedIn)
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

function createMockContext(user: typeof mockUser | null = mockUser): TrpcContext {
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

// Helper to generate unique IDs
let testCounter = 0;
function getUniqueId() {
  return ++testCounter;
}

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

  describe("products.create", () => {
    it("should create a product with valid input", async () => {
      const id = getUniqueId();
      const result = await caller.products.create({
        name: `Test Product ${id}`,
        category: "Electronics",
        reference: `EL${id}`,
      });

      expect(result).toBeDefined();
      expect(result.name).toBe(`Test Product ${id}`);
      expect(result.category).toBe("Electronics");
      expect(result.reference).toBe(`EL${id}`);
      expect(result.userId).toBe(mockUser.id);
    });

    it("should reject product with empty name", async () => {
      try {
        await caller.products.create({
          name: "",
          category: "Electronics",
          reference: `EL${getUniqueId()}`,
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
          reference: `EL${getUniqueId()}`,
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).toContain("required");
      }
    });

    it("should reject duplicate product names", async () => {
      const id = getUniqueId();
      const uniqueName = `Unique Product ${id}`;

      // Create first product
      await caller.products.create({
        name: uniqueName,
        category: "Electronics",
        reference: `EL${id}`,
      });

      // Try to create duplicate
      try {
        await caller.products.create({
          name: uniqueName,
          category: "Different Category",
          reference: `EL${id + 1000}`,
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe("CONFLICT");
        expect(error.message).toContain("already exists");
      }
    });

    it("should require authentication", async () => {
      const unauthedCaller = appRouter.createCaller(createMockContext(null));
      try {
        await unauthedCaller.products.create({
          name: `Test ${getUniqueId()}`,
          category: "Test",
          reference: `TEST${getUniqueId()}`,
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("products.getById", () => {
    it("should get product by id", async () => {
      const id = getUniqueId();
      const created = await caller.products.create({
        name: `Get By ID Test ${id}`,
        category: "Test",
        reference: `TEST${id}`,
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
        reference: `TEST${id}`,
      });

      const otherUserCaller = appRouter.createCaller(
        createMockContext(mockAdminUser)
      );
      const result = await otherUserCaller.products.getById({ id: created.id });
      expect(result).toBeNull();
    });
  });

  describe("products.update", () => {
    it("should update product name", async () => {
      const id = getUniqueId();
      const created = await caller.products.create({
        name: `Original Name ${id}`,
        category: "Test",
        reference: `TEST${id}`,
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
        reference: `TEST${id}`,
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
      // Create two products
      const product1 = await caller.products.create({
        name: `Product A ${id}`,
        category: "Test",
        reference: `TEST${id}`,
      });

      await caller.products.create({
        name: `Product B ${id}`,
        category: "Test",
        reference: `TEST${id + 1000}`,
      });

      // Try to rename product1 to product2's name
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

  describe("products.delete", () => {
    it("should delete product", async () => {
      const id = getUniqueId();
      const created = await caller.products.create({
        name: `Delete Test ${id}`,
        category: "Test",
        reference: `TEST${id}`,
      });

      const result = await caller.products.delete({ id: created.id });
      expect(result.success).toBe(true);

      // Verify deletion
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
        reference: `TEST${id}`,
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

      // Verify original user can still access
      const fetched = await caller.products.getById({ id: created.id });
      expect(fetched).toBeDefined();
    });
  });

  describe("Data Isolation", () => {
    it("should isolate products between users", async () => {
      const id = getUniqueId();
      const user1Caller = appRouter.createCaller(createMockContext(mockUser));
      const user2Caller = appRouter.createCaller(
        createMockContext(mockAdminUser)
      );

      // User 1 creates product
      const user1Product = await user1Caller.products.create({
        name: `User 1 Only ${id}`,
        category: "Test",
        reference: `TEST${id}`,
      });

      // User 2 creates product
      const user2Product = await user2Caller.products.create({
        name: `User 2 Only ${id}`,
        category: "Test",
        reference: `TEST${id + 1000}`,
      });

      // User 1 should only see their product
      const user1List = await user1Caller.products.list();
      const user1Ids = user1List.map((p) => p.id);
      expect(user1Ids).toContain(user1Product.id);
      expect(user1Ids).not.toContain(user2Product.id);

      // User 2 should only see their product
      const user2List = await user2Caller.products.list();
      const user2Ids = user2List.map((p) => p.id);
      expect(user2Ids).toContain(user2Product.id);
      expect(user2Ids).not.toContain(user1Product.id);
    });
  });
});
