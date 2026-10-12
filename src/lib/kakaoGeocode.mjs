export function parseKakaoAddressResponse(json) {
  const doc = json?.documents?.[0];
  if (!doc) return null;
  return { lat: Number.parseFloat(doc.y), lng: Number.parseFloat(doc.x) };
}
