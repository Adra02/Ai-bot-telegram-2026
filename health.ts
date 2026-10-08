export function GET(): Response {
  return Response.json({
    ok: true,
    service: 'DEVFORGE AI',
    status: 'online'
  });
}
