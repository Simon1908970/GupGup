export function buildSearchQueries(target) {
  if (!target.regions || target.regions.length === 0) return [target.keyword];
  return target.regions.map((region) => `${target.keyword} ${region}`);
}

export function mapKakaoPlaceToBusinessRow(place, target) {
  return {
    name: place.place_name,
    category: target.category,
    country: target.country,
    address: place.road_address_name || place.address_name,
    lat: Number.parseFloat(place.y),
    lng: Number.parseFloat(place.x),
    phone: place.phone || null,
    kakao_place_id: place.id,
  };
}
