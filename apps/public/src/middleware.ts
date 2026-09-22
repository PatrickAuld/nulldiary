import { NextResponse, type NextRequest } from "next/server";
import {
  addVaryAccept,
  negotiatePageRepresentation,
} from "@/lib/content-negotiation";

const MARKDOWN_ROUTE = "/markdown";

function isNonDocumentPath(pathname: string): boolean {
  return (
    pathname === MARKDOWN_ROUTE ||
    pathname === "/s" ||
    pathname.startsWith("/s/") ||
    pathname === "/og" ||
    pathname.startsWith("/og/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

function isNextNavigationRequest(request: NextRequest): boolean {
  return [
    "rsc",
    "next-router-state-tree",
    "next-router-prefetch",
    "next-router-segment-prefetch",
    "next-url",
  ].some((header) => request.headers.has(header));
}

export function middleware(request: NextRequest): NextResponse | Response {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }

  if (
    isNonDocumentPath(request.nextUrl.pathname) ||
    isNextNavigationRequest(request)
  ) {
    return NextResponse.next();
  }

  const representation = negotiatePageRepresentation(
    request.headers.get("accept"),
  );

  if (representation === "not-acceptable") {
    const headers = new Headers({
      "Content-Type": "text/plain; charset=utf-8",
    });
    addVaryAccept(headers);
    return new Response("Not Acceptable\n", { status: 406, headers });
  }

  if (representation === "markdown") {
    const target = request.nextUrl.clone();
    target.pathname = MARKDOWN_ROUTE;
    target.search = "";
    target.searchParams.set("path", request.nextUrl.pathname);

    const response = NextResponse.rewrite(target);
    addVaryAccept(response.headers);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
