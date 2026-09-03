import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "travel-api/app-router";

export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
