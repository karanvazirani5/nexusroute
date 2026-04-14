import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16 renamed middleware.ts → proxy.ts
// Clerk's middleware is wrapped inside the proxy export.
// No routes are protected — this only attaches auth context.
// When Clerk keys are not configured, pass through without Clerk.

const clerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const clerkProxy = clerkConfigured ? clerkMiddleware() : null;

export function proxy(request: NextRequest) {
  if (clerkProxy) {
    return clerkProxy(request, {} as any);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
