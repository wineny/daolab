import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  const expected = process.env.ADMIN_KEY;
  const provided = searchParams.get("key");
  if (!expected || provided !== expected) {
    return new NextResponse("Not Found", { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
