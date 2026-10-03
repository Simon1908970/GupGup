import { test } from "node:test";
import assert from "node:assert/strict";
import { parseKakaoAddressResponse } from "./kakaoGeocode.mjs";

test("documents가 있으면 x/y를 lng/lat으로 변환", () => {
  const response = {
    meta: { total_count: 1 },
    documents: [
      { address_name: "서울 강남구 역삼동 719", x: "127.036456", y: "37.500622" },
    ],
  };
  assert.deepEqual(parseKakaoAddressResponse(response), { lat: 37.500622, lng: 127.036456 });
});

test("documents가 비어있으면 null", () => {
  assert.equal(parseKakaoAddressResponse({ meta: { total_count: 0 }, documents: [] }), null);
});

test("documents 필드가 없으면 null", () => {
  assert.equal(parseKakaoAddressResponse({}), null);
});
