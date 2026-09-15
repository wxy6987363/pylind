// functions/api/version.js
export async function onRequest(context) {
  const version = context.env.VERSION;
  
  if (!version) {
    return Response.json(
      { error: "VERSION is not defined" },
      { status: 500 }
    );
  }
  
  return Response.json({ version });
}
