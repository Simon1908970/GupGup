# 네이버 뉴스/블로그/카페 일일 요약

매일 [keywords.md](./keywords.md)의 검색어로 네이버 뉴스·블로그·카페 글을 검색해서, 핵심 내용만 골라 하루 한 페이지(`daily/YYYY-MM-DD.md`)로 정리해두는 폴더입니다.
형식 예시는 [daily/TEMPLATE.md](./daily/TEMPLATE.md) 참고 (실제 데이터 아님, 형식 견본).

## 원칙
- 원문 전문을 복사하지 않습니다. 제목 + 1~2문장 핵심 요약 + 원문 링크만 남깁니다.
- 사실관계가 불확실하거나 출처가 불분명한 글은 제외합니다.
- 실제 사이트 "뉴스" 게시판에 올릴지는 이 파일을 사람이 검토한 뒤 별도로 결정합니다 (자동 게시 아님).

## 아직 필요한 것: NAVER API HUB 검색 API 키

2026년부터 네이버 검색(뉴스/블로그/카페) API는 기존 개발자센터(developers.naver.com)가 아니라
**네이버클라우드플랫폼의 "NAVER API HUB"**에서 발급받습니다. 개발자센터 애플리케이션 등록 화면에는
더 이상 "검색" 항목이 없습니다 — 아래 새 경로로 진행해주세요.

1. https://console.ncloud.com 접속 → 네이버클라우드플랫폼 계정으로 로그인 (없으면 가입 필요, 본인인증/카드등록이 요구될 수 있음)
2. NAVER API HUB 서비스 **이용 신청**
3. **Application 등록** — 사용할 API에서 **검색** 선택
4. 등록하면 **Client ID / Client Secret이 자동 발급**되어 화면에 표시됨

키를 받으시면 저에게 알려주세요 (Client ID는 공유해도 괜찮지만, **Client Secret은 채팅에 붙여넣지 마시고**
`.env.local`에 직접 넣어주시는 걸 권장드립니다 — 이건 API 호출 권한을 가진 진짜 비밀키입니다).

```bash
# .env.local에 추가
NAVER_SEARCH_CLIENT_ID=발급받은_값
NAVER_SEARCH_CLIENT_SECRET=발급받은_값
```

> 참고: 새 API는 인증 헤더도 바뀌었습니다 (`X-Naver-Client-Id`/`Secret` → `X-NCP-APIGW-API-KEY-ID`/`X-NCP-APIGW-API-KEY`).
> 스크립트 작성 시 반영합니다.

## 키를 받은 이후 진행 순서
1. 네이버 검색 API를 호출해 키워드별 결과를 가져오는 스크립트 작성
2. 결과를 걸러서(중복 제거·관련도 낮은 것 제외) 핵심만 요약해 `daily/YYYY-MM-DD.md`로 저장
3. 매일 자동으로 실행되도록 예약 작업(스케줄) 설정
