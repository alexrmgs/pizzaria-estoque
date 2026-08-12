import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC_PATHS = ["/login"];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  if (!isLoggedIn && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isPublicPath) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
});

export const config = {
  // Ignora todas as rotas /api (elas fazem a própria autenticação por token /
  // são webhooks públicos), além dos assets estáticos.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
