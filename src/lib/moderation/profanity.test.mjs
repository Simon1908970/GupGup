import { test } from "node:test";
import assert from "node:assert/strict";
import { checkProfanity } from "./profanity.mjs";

test("한국어 비속어가 포함된 문장은 true", () => {
  assert.equal(checkProfanity("저 사람 진짜 병신 같다"), true);
});

test("영어 비속어가 포함된 문장은 true (대소문자 무시)", () => {
  assert.equal(checkProfanity("You are such an ASSHOLE"), true);
});

test("베트남어 비속어가 포함된 문장은 true", () => {
  assert.equal(checkProfanity("đồ địt mẹ mày"), true);
});

test("태국어 비속어가 포함된 문장은 true", () => {
  assert.equal(checkProfanity("ไอ้เหี้ย ทำไมพูดแบบนี้"), true);
});

test("인도네시아어 비속어가 포함된 문장은 true", () => {
  assert.equal(checkProfanity("dasar anjing kamu"), true);
});

test("깨끗한 한국어 문장은 false", () => {
  assert.equal(checkProfanity("오늘 날씨가 정말 좋네요"), false);
});

test("깨끗한 영어 문장은 false", () => {
  assert.equal(checkProfanity("Thank you so much for your help"), false);
});

test("깨끗한 베트남어 문장은 false", () => {
  assert.equal(checkProfanity("Hôm nay trời rất đẹp"), false);
});

test("빈 문자열은 false", () => {
  assert.equal(checkProfanity(""), false);
});
