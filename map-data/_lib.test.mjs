import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSearchQueries, mapKakaoPlaceToBusinessRow } from "./_lib.mjs";

test("buildSearchQueries: 키워드 × 지역 조합으로 쿼리 문자열 생성", () => {
  const target = { country: "vn", category: "restaurant", keyword: "베트남 음식", regions: ["안산시 원곡동", "서울 광희동"] };
  assert.deepEqual(buildSearchQueries(target), [
    "베트남 음식 안산시 원곡동",
    "베트남 음식 서울 광희동",
  ]);
});

test("buildSearchQueries: regions 없으면 키워드 그대로(전국 검색) 단일 쿼리 반환", () => {
  const target = { country: "vn", category: "restaurant", keyword: "베트남 음식점" };
  assert.deepEqual(buildSearchQueries(target), ["베트남 음식점"]);
});

test("mapKakaoPlaceToBusinessRow: 카카오 장소 객체를 businesses row로 변환", () => {
  const place = {
    id: "26338954",
    place_name: "사이공 쌀국수",
    road_address_name: "경기 안산시 단원구 화랑로 123",
    address_name: "경기 안산시 단원구 원곡동 456",
    x: "126.837300",
    y: "37.321500",
    phone: "031-123-4567",
  };
  const target = { country: "vn", category: "restaurant" };
  assert.deepEqual(mapKakaoPlaceToBusinessRow(place, target), {
    name: "사이공 쌀국수",
    category: "restaurant",
    country: "vn",
    address: "경기 안산시 단원구 화랑로 123",
    lat: 37.3215,
    lng: 126.8373,
    phone: "031-123-4567",
    kakao_place_id: "26338954",
  });
});

test("mapKakaoPlaceToBusinessRow: road_address_name 없으면 address_name 사용, phone 없으면 null", () => {
  const place = {
    id: "999",
    place_name: "노이름",
    road_address_name: "",
    address_name: "서울 중구 광희동1가 1",
    x: "126.9",
    y: "37.5",
    phone: "",
  };
  const target = { country: "th", category: "mart" };
  const row = mapKakaoPlaceToBusinessRow(place, target);
  assert.equal(row.address, "서울 중구 광희동1가 1");
  assert.equal(row.phone, null);
});
