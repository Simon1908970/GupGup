// "내 월급" / "내 생활비" 입력 양식의 지역(시·도 → 시·군·구) 선택지.
//
// 지명은 고유명사라 언어를 바꿔도 번역하지 않고 항상 한국어 그대로 보여준다
// (다른 i18n 문구와 달리 dictionaries.ts에 넣지 않는다 -- 2026-11-08 사용자
// 확인). province의 code를 DB(region_province)에 저장하고, city는 그 밑의
// code를 DB(region_city)에 저장한다.

export interface RegionOption {
  code: string;
  label: string;
}

export interface ProvinceOption extends RegionOption {
  cities: RegionOption[];
}

export const REGIONS: ProvinceOption[] = [
  {
    code: "seoul",
    label: "서울특별시",
    cities: [
      "종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구",
      "성북구", "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구",
      "양천구", "강서구", "구로구", "금천구", "영등포구", "동작구", "관악구",
      "서초구", "강남구", "송파구", "강동구",
    ].map((label) => ({ code: label, label })),
  },
  {
    code: "busan",
    label: "부산광역시",
    cities: [
      "중구", "서구", "동구", "영도구", "부산진구", "동래구", "남구", "북구",
      "강서구", "해운대구", "사하구", "금정구", "연제구", "수영구", "사상구", "기장군",
    ].map((label) => ({ code: label, label })),
  },
  {
    code: "daegu",
    label: "대구광역시",
    cities: ["중구", "동구", "서구", "남구", "북구", "수성구", "달서구", "달성군"].map(
      (label) => ({ code: label, label }),
    ),
  },
  {
    code: "incheon",
    label: "인천광역시",
    cities: [
      "중구", "동구", "미추홀구", "연수구", "남동구", "부평구", "계양구", "서구",
      "강화군", "옹진군",
    ].map((label) => ({ code: label, label })),
  },
  {
    code: "gwangju",
    label: "광주광역시",
    cities: ["동구", "서구", "남구", "북구", "광산구"].map((label) => ({ code: label, label })),
  },
  {
    code: "daejeon",
    label: "대전광역시",
    cities: ["동구", "중구", "서구", "유성구", "대덕구"].map((label) => ({ code: label, label })),
  },
  {
    code: "ulsan",
    label: "울산광역시",
    cities: ["중구", "남구", "동구", "북구", "울주군"].map((label) => ({ code: label, label })),
  },
  {
    code: "sejong",
    label: "세종특별자치시",
    cities: [{ code: "sejong", label: "세종시" }],
  },
  {
    code: "gyeonggi",
    label: "경기도",
    cities: [
      "수원시", "성남시", "의정부시", "안양시", "부천시", "광명시", "평택시",
      "동두천시", "안산시", "고양시", "과천시", "구리시", "남양주시", "오산시",
      "시흥시", "군포시", "의왕시", "하남시", "용인시", "파주시", "이천시",
      "안성시", "김포시", "화성시", "광주시", "양주시", "포천시", "여주시",
      "연천군", "가평군", "양평군",
    ].map((label) => ({ code: label, label })),
  },
  {
    code: "gangwon",
    label: "강원특별자치도",
    cities: [
      "춘천시", "원주시", "강릉시", "동해시", "태백시", "속초시", "삼척시",
      "홍천군", "횡성군", "영월군", "평창군", "정선군", "철원군", "화천군",
      "양구군", "인제군", "고성군", "양양군",
    ].map((label) => ({ code: label, label })),
  },
  {
    code: "chungbuk",
    label: "충청북도",
    cities: [
      "청주시", "충주시", "제천시", "보은군", "옥천군", "영동군", "증평군",
      "진천군", "괴산군", "음성군", "단양군",
    ].map((label) => ({ code: label, label })),
  },
  {
    code: "chungnam",
    label: "충청남도",
    cities: [
      "천안시", "공주시", "보령시", "아산시", "서산시", "논산시", "계룡시",
      "당진시", "금산군", "부여군", "서천군", "청양군", "홍성군", "예산군", "태안군",
    ].map((label) => ({ code: label, label })),
  },
  {
    code: "jeonbuk",
    label: "전북특별자치도",
    cities: [
      "전주시", "군산시", "익산시", "정읍시", "남원시", "김제시", "완주군",
      "진안군", "무주군", "장수군", "임실군", "순창군", "고창군", "부안군",
    ].map((label) => ({ code: label, label })),
  },
  {
    code: "jeonnam",
    label: "전라남도",
    cities: [
      "목포시", "여수시", "순천시", "나주시", "광양시", "담양군", "곡성군",
      "구례군", "고흥군", "보성군", "화순군", "장흥군", "강진군", "해남군",
      "영암군", "무안군", "함평군", "영광군", "장성군", "완도군", "진도군", "신안군",
    ].map((label) => ({ code: label, label })),
  },
  {
    code: "gyeongbuk",
    label: "경상북도",
    cities: [
      "포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시",
      "상주시", "문경시", "경산시", "군위군", "의성군", "청송군", "영양군",
      "영덕군", "청도군", "고령군", "성주군", "칠곡군", "예천군", "봉화군",
      "울진군", "울릉군",
    ].map((label) => ({ code: label, label })),
  },
  {
    code: "gyeongnam",
    label: "경상남도",
    cities: [
      "창원시", "진주시", "통영시", "사천시", "김해시", "밀양시", "거제시",
      "양산시", "의령군", "함안군", "창녕군", "고성군", "남해군", "하동군",
      "산청군", "함양군", "거창군", "합천군",
    ].map((label) => ({ code: label, label })),
  },
  {
    code: "jeju",
    label: "제주특별자치도",
    cities: ["제주시", "서귀포시"].map((label) => ({ code: label, label })),
  },
];

export function findProvince(code: string): ProvinceOption | undefined {
  return REGIONS.find((p) => p.code === code);
}

// 지역은 선택 입력이라 둘 다, 또는 시·군·구만 비어있을 수 있다(null) --
// 그런 경우 아는 만큼만("경기도"처럼 시·도만, 또는 빈 문자열)을 돌려준다.
export function regionLabel(
  provinceCode: string | null,
  cityCode: string | null,
): string {
  const province = provinceCode ? findProvince(provinceCode) : undefined;
  const city = province && cityCode ? province.cities.find((c) => c.code === cityCode) : undefined;
  if (!province) return cityCode ?? "";
  if (!city) return shortProvinceLabel(province);
  // "경남 김해" 같은 축약 표기 -- 광역시/도 전체 이름 대신 흔히 쓰는 2글자를 쓴다.
  return `${shortProvinceLabel(province)} ${city.label}`;
}

const SHORT_PROVINCE_LABELS: Record<string, string> = {
  seoul: "서울",
  busan: "부산",
  daegu: "대구",
  incheon: "인천",
  gwangju: "광주",
  daejeon: "대전",
  ulsan: "울산",
  sejong: "세종",
  gyeonggi: "경기",
  gangwon: "강원",
  chungbuk: "충북",
  chungnam: "충남",
  jeonbuk: "전북",
  jeonnam: "전남",
  gyeongbuk: "경북",
  gyeongnam: "경남",
  jeju: "제주",
};

function shortProvinceLabel(province: ProvinceOption): string {
  return SHORT_PROVINCE_LABELS[province.code] ?? province.label;
}
