export interface InquiryMessage {
  id: string;
  senderType: "user" | "admin";
  body: string;
  createdAt: string;
}

export interface Inquiry {
  id: string;
  title: string;
  status: "pending" | "answered";
  messages: InquiryMessage[];
}

export const MOCK_INQUIRIES: Inquiry[] = [
  {
    id: "inq-1",
    title: "비밀번호를 잊어버렸어요",
    status: "answered",
    messages: [
      {
        id: "inq-1-1",
        senderType: "user",
        body: "가입한 이메일이 기억나지 않는데 어떻게 해야 하나요?",
        createdAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
      },
      {
        id: "inq-1-2",
        senderType: "admin",
        body: "안녕하세요, Gup Gup 운영팀입니다. 가입 시 사용한 소셜 계정(구글/페이스북)으로 로그인해보시고, 그래도 안 되시면 사용 가능한 다른 정보를 알려주시면 확인 도와드리겠습니다.",
        createdAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
      },
    ],
  },
  {
    id: "inq-2",
    title: "신고한 게시글 처리 결과가 궁금해요",
    status: "pending",
    messages: [
      {
        id: "inq-2-1",
        senderType: "user",
        body: "며칠 전 신고한 게시글이 아직 그대로 보여서요. 확인 부탁드립니다.",
        createdAt: new Date(Date.now() - 6 * 3600_000).toISOString(),
      },
    ],
  },
];
