# 국가별 SNS 리서치 — 절차

K컬처 "국가별 SNS 리서치" 레이어의 운영 절차. 전체 설계는
[2026-10-15-kculture-country-sns-research-design.md](../../../docs/superpowers/specs/2026-10-15-kculture-country-sns-research-design.md)
참고. `../README.md`의 기존 주간 다이제스트(Exa/RSS/Reddit, 날짜별)와는 별개 레이어다.

## 중요: 플랫폼엔 "거주지=한국 + 언어=X" 필터가 없다

틱톡·인스타그램·페이스북 어디에도 "이 계정은 한국에 거주하고 베트남어를 쓴다" 같은
조합 필터를 일반 검색/탐색에서 쓸 방법이 없다(광고주 전용 타겟팅 도구로만 존재).
그래서 이 절차는 그런 필터를 흉내 내지 않고, **본인이 스스로 "한국에 사는 OO인"
또는 "한국 유학생"이라고 밝히는 계정·게시물**을 `keywords.md`의 검색어로 찾는다.

## 라운드 진행 순서

1. `rotation.json`을 읽어 `nextCountry(rotation)`으로 이번 라운드의 국가를 정한다.
2. `keywords.md`에서 그 나라 섹션(실용정보 + 연애·팬덤)의 검색어를 가져온다.
3. Claude in Chrome으로 사용자의 로그인된 세션에 들어가 페이스북·인스타·틱톡에서
   가볍게 검색한다 — 계정 보호 원칙은 `../README.md`의 "SNS 직접 브라우징" 섹션과
   동일(검색 2~3개, 좋아요·팔로우 등 액션 없음, 느리게).
4. 찾은 항목을 `{url, title, summary}` 형태로 정리하고, `seen.json`과
   `filterNewItems(seen, country, items)`로 신규 항목만 추려낸다.
5. `appendCountryFile(기존 내용, 국가 라벨, 오늘 날짜, 실용정보 신규 항목, 연애팬덤 신규 항목)`로
   `countries/<code>.md`를 갱신한다(파일이 없으면 새로 생성).
6. `markSeen`으로 `seen.json`을 갱신하고, `advanceRotation`으로 `rotation.json`을 다음
   국가로 넘긴다.
7. `countries/<code>.md`뿐 아니라 `rotation.json`/`seen.json`도 **로컬 전용 — git 커밋 안 함**
   (2026-10-15: 원래 계획은 이 두 파일을 북키핑 상태 파일로 커밋하는 것이었으나, 사용자가
   `news-digest/seen-topics.json`과 동일하게 로컬 전용으로 두기로 함 — SNS 게시물 URL·
   계정 정보가 쌓이는 파일이라 공개 저장소에 올리지 않는 쪽을 택함).
8. 처리한 국가·건수를 대화창에 짧게 보고한다.
