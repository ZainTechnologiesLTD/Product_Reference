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
} from "./db";
import { TRPCError } from "@trpc/server";
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
              .enum(["name", "category", "reference", "status", "price", "createdAt", "updatedAt"])
              .default("createdAt"),
            sortOrder: z.enum(["asc", "desc"]).default("desc"),
            search: z.string().trim().max(255).optional(),
            category: z.string().trim().max(100).optional(),
            status: z.enum(["active", "inactive", "discontinued"]).optional(),
          })
          .default({
            page: 1,
            pageSize: 20,
            sortBy: "createdAt",
            sortOrder: "desc",
          })
      )
      .query(({ ctx, input }) =>
        getUserProductsPaginated(ctx.user.id, input)
      ),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(1, "Product name is required").max(255),
          category: z.string().trim().min(1, "Category is required").max(100),
          description: z.string().trim().max(5000).optional(),
          reference: z.string().trim().min(1).max(50),
          sku: z.string().trim().max(50).optional(),
          price: z.string().optional(),
          status: z.enum(["active", "inactive", "discontinued"]).default("active"),
          imageUrl: z.string().url().max(2048).optional(),
          tags: z.array(z.string().trim().max(50)).max(20).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const exists = await checkProductNameExists(ctx.user.id, input.name);
        if (exists) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Product with name "${input.name}" already exists`,
          });
        }

        const product = await createProduct({
          userId: ctx.user.id,
          name: input.name,
          category: input.category,
          description: input.description ?? null,
          reference: input.reference,
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

        return product;
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
          reference: z.string().trim().min(1).max(50).optional(),
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
          const exists = await checkProductNameExists(ctx.user.id, updates.name, id);
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

        return { success: true };
      }),

    bulkDelete: protectedProcedure
      .input(z.object({ ids: z.array(z.number()).min(1).max(100) }))
      .mutation(async ({ ctx, input }) => {
        const count = await bulkDeleteProducts(ctx.user.id, input.ids);
        return { deleted: count };
      }),
  }),
});

export type AppRouter = typeof appRouter;
