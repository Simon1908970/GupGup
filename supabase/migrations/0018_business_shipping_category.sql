-- 업체 지도: "국제택배" 업종 카테고리 추가
alter table businesses drop constraint businesses_category_check;
alter table businesses add constraint businesses_category_check
  check (
    category in ('restaurant', 'mart', 'salon', 'hospital', 'mobile', 'admin', 'shipping', 'etc')
  );
