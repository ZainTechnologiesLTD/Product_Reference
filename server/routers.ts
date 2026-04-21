import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createProduct,
  getUserProductsPaginated,
  getProductById,
  updateProduct,
  deleteProduct,
  bulkDeleteProducts,
  checkProductNameExists,
  checkProductDuplicate,
  findProductSuggestions,
  listUserCategories,
  getOrCreateCategory,
  searchProducts,
  getUserProductsStats,
  getProductsForExport,
} from "./db";
import { generateUniqueReference } from "./lib/referenceGenerator";
import { logger } from "./lib/logger";
import { TRPCError } from "@trpc/server";
import { insertAuditLog } from "./lib/auditLog";
import { isReferenceCollisionError } from "./lib/dbErrors";
import {
  invalidateSession,
  clearSessionCookie,
  getSessionToken,
} from "./auth/session";

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const token = getSessionToken(ctx.req);
      if (token) {
        await invalidateSession(token);
      }
      clearSessionCookie(ctx.res);
      return { success: true } as const;
    }),
  }),

  products: router({
    list: protectedProcedure
      .input(
        z
          .object({
            page: z.number().int().min(1).default(1),
            pageSize: z.number().int().min(1).max(100).default(20),
            sortBy: z
              .enum([
                "name",
                "category",
                "reference",
                "status",
                "price",
                "createdAt",
                "updatedAt",
              ])
              .default("createdAt"),
            sortOrder: z.enum(["asc", "desc"]).default("desc"),
            search: z.string().trim().max(255).optional(),
            category: z.string().trim().max(100).optional(),
            status: z.enum(["active", "inactive", "discontinued"]).optional(),
            referenceContains: z.string().trim().max(20).optional(),
            skuContains: z.string().trim().max(50).optional(),
          })
          .default({
            page: 1,
            pageSize: 20,
            sortBy: "createdAt",
            sortOrder: "desc",
          })
      )
      .query(({ ctx, input }) => getUserProductsPaginated(ctx.user.id, input)),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(1, "Product name is required").max(255),
          category: z.string().trim().min(1, "Category is required").max(100),
          description: z.string().trim().max(5000).optional(),
          sku: z.string().trim().max(50).optional(),
          price: z.string().optional(),
          status: z
            .enum(["active", "inactive", "discontinued"])
            .default("active"),
          imageUrl: z.string().url().max(2048).optional(),
          tags: z.array(z.string().trim().max(50)).max(20).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const exists = await checkProductNameExists(ctx.user.id, input.name);
        if (exists) {
          logger.warn(
            { name: input.name, userId: ctx.user.id },
            "Duplicate product creation attempt"
          );
          throw new TRPCError({
            code: "CONFLICT",
            message: `Product with name "${input.name}" already exists`,
          });
        }

        const category = await getOrCreateCategory(ctx.user.id, input.category);

        let lastErr: unknown;
        for (let attempt = 0; attempt < 8; attempt++) {
          const reference = await generateUniqueReference(input.category);
          try {
            const product = await createProduct({
              userId: ctx.user.id,
              name: input.name,
              category: input.category,
              categoryId: category.id,
              description: input.description ?? null,
              reference,
              sku: input.sku ?? null,
              price: input.price ?? null,
              status: input.status,
              imageUrl: input.imageUrl ?? null,
              tags: input.tags ?? null,
            });

            if (!product) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to create product",
              });
            }

            logger.info(
              {
                productId: product.id,
                name: product.name,
                reference: product.reference,
              },
              "Product created"
            );

            await insertAuditLog({
              userId: ctx.user.id,
              entityType: "product",
              entityId: product.id,
              action: "create",
              oldData: null,
              newData: {
                name: product.name,
                reference: product.reference,
                category: product.category,
              },
            });

            return product;
          } catch (err) {
            if (err instanceof TRPCError) throw err;
            lastErr = err;
            if (isReferenceCollisionError(err)) {
              logger.warn(
                { attempt, reference, err },
                "Reference collision on insert, retrying"
              );
              continue;
            }
            throw err;
          }
        }

        logger.error({ lastErr }, "Exhausted reference insert retries");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not allocate a unique reference. Try again.",
        });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ ctx, input }) => getProductById(input.id, ctx.user.id)),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().trim().min(1).max(255).optional(),
          category: z.string().trim().min(1).max(100).optional(),
          description: z.string().trim().max(5000).optional(),
          sku: z.string().trim().max(50).optional(),
          price: z.string().optional(),
          status: z.enum(["active", "inactive", "discontinued"]).optional(),
          imageUrl: z.string().url().max(2048).nullish(),
          tags: z.array(z.string().trim().max(50)).max(20).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;

        const existing = await getProductById(id, ctx.user.id);
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Product not found",
          });
        }

        if (updates.name && updates.name !== existing.name) {
          const exists = await checkProductNameExists(
            ctx.user.id,
            updates.name,
            id
          );
          if (exists) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `Product with name "${updates.name}" already exists`,
            });
          }
        }

        const updated = await updateProduct(id, ctx.user.id, updates);
        if (!updated) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update product",
          });
        }

        await insertAuditLog({
          userId: ctx.user.id,
          entityType: "product",
          entityId: id,
          action: "update",
          oldData: existing as unknown as Record<string, unknown>,
          newData: updated as unknown as Record<string, unknown>,
        });

        return updated;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getProductById(input.id, ctx.user.id);
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Product not found",
          });
        }

        const success = await deleteProduct(input.id, ctx.user.id);
        if (!success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete product",
          });
        }

        await insertAuditLog({
          userId: ctx.user.id,
          entityType: "product",
          entityId: input.id,
          action: "delete",
          oldData: existing as unknown as Record<string, unknown>,
          newData: null,
        });

        logger.info(
          { productId: input.id, userId: ctx.user.id },
          "Product soft-deleted"
        );

        return { success: true };
      }),

    bulkDelete: protectedProcedure
      .input(z.object({ ids: z.array(z.number()).min(1).max(100) }))
      .mutation(async ({ ctx, input }) => {
        const count = await bulkDeleteProducts(ctx.user.id, input.ids);
        logger.info(
          { userId: ctx.user.id, count, ids: input.ids },
          "Bulk soft-delete products"
        );
        for (const id of input.ids) {
          await insertAuditLog({
            userId: ctx.user.id,
            entityType: "product",
            entityId: id,
            action: "delete",
            oldData: { bulk: true },
            newData: null,
          });
        }
        return { deleted: count };
      }),

    checkDuplicate: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(1),
          excludeId: z.number().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        return checkProductDuplicate(ctx.user.id, input.name, input.excludeId);
      }),

    suggestions: protectedProcedure
      .input(
        z.object({
          searchTerm: z.string().trim().min(1),
          limit: z.number().min(1).max(20).default(10),
        })
      )
      .query(async ({ ctx, input }) => {
        return findProductSuggestions(
          ctx.user.id,
          input.searchTerm,
          input.limit
        );
      }),

    search: protectedProcedure
      .input(
        z
          .object({
            term: z.string().trim().min(1),
            page: z.number().int().min(1).default(1),
            pageSize: z.number().int().min(1).max(100).default(20),
          })
          .default({ term: "", page: 1, pageSize: 20 })
      )
      .query(async ({ ctx, input }) => {
        return searchProducts(
          ctx.user.id,
          input.term,
          input.page,
          input.pageSize
        );
      }),

    exportList: protectedProcedure
      .input(
        z.object({
          sortBy: z
            .enum([
              "name",
              "category",
              "reference",
              "status",
              "price",
              "createdAt",
              "updatedAt",
            ])
            .default("createdAt"),
          sortOrder: z.enum(["asc", "desc"]).default("desc"),
          search: z.string().trim().max(255).optional(),
          category: z.string().trim().max(100).optional(),
          status: z.enum(["active", "inactive", "discontinued"]).optional(),
          referenceContains: z.string().trim().max(20).optional(),
          skuContains: z.string().trim().max(50).optional(),
          limit: z.number().int().min(1).max(10_000).default(10_000),
        })
      )
      .query(async ({ ctx, input }) => {
        const items = await getProductsForExport(ctx.user.id, input);
        logger.info(
          { userId: ctx.user.id, rows: items.length },
          "Product export list generated"
        );
        return items;
      }),

    stats: protectedProcedure.query(async ({ ctx }) => {
      return getUserProductsStats(ctx.user.id);
    }),
  }),

  categories: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return listUserCategories(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({ name: z.string().trim().min(1).max(100) }))
      .mutation(async ({ ctx, input }) => {
        return getOrCreateCategory(ctx.user.id, input.name);
      }),

    getOrCreate: protectedProcedure
      .input(z.object({ name: z.string().trim().min(1).max(100) }))
      .mutation(async ({ ctx, input }) => {
        return getOrCreateCategory(ctx.user.id, input.name);
      }),
  }),
});

export type AppRouter = typeof appRouter;
