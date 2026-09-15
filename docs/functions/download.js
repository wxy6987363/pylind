// functions/download.js
export async function onRequest(context) {
  const assetUrl = new URL("/res/pylind.apk", context.request.url);
  return context.env.ASSETS.fetch(assetUrl);
}
