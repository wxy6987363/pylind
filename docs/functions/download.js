export async function onRequest(context) {
  const assetUrl = new URL("/res/pylind.apk", context.request.url);
  return Response.redirect(assetUrl.toString(), 302);
}
