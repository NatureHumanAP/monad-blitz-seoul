# Frontend Implementation TODO (PLAN.md §3)

## Environment & Shared Utilities
- [ ] Confirm Next.js app router baseline (lint/build) still clean after installing UI/Web3 deps
- [ ] Wire up Tailwind config + base styles needed for upload/download views
- [ ] Finalize `lib/api.ts` client helpers (upload/download/deposit/balance endpoints)
- [ ] Implement shared toast/loading components for async UX feedback

## Wallet Experience
- [x] Build `lib/wallet.ts` helpers for Monad RPC config + wagmi client setup
- [x] Implement `hooks/useWallet.ts` state machine (idle → connecting → connected) with auto-reconnect/guard
- [x] Integrate RainbowKit modal/connector flow + network guard for non-Monad networks
- [x] Display wallet status + address truncation in global header component
- [x] Add Redux provider wiring for global UI state (toasts/loading)

## Upload Flow (`components/Upload.tsx`, `hooks/useUpload.ts`)
- [ ] Implement file selection + drag-and-drop with size validation + mime filtering
- [ ] Track upload progress (per file + aggregate) via `hooks/useUpload`
- [ ] Surface server responses (file_id + download URL) + copy button
- [ ] Display storage info returned on upload (estimated deletion date, free 30-day message, daily/monthly fee estimates)
- [ ] Handle retry/cancel states and propagate errors to toast layer

## Download Flow (`components/Download.tsx`)
- [ ] Fetch wallet credit balance before allowing download
- [ ] Integrate x402 challenge parsing from `lib/x402.ts`
- [ ] Execute payment/signature flow -> trigger actual download stream
- [ ] Persist recent downloads list locally for quick access
- [ ] Show when credit is insufficient -> x402 fallback UI with payment amount/address/token/nonce details

## Deposit Flow (`components/Deposit.tsx`)
- [ ] Load contract ABI/address via `lib/contract.ts`
- [ ] Present preset deposit amounts + custom input with validation
- [ ] Trigger `deposit` transaction and show status (pending/confirmed)
- [ ] Refresh local credit balance + propagate via `hooks/useBalance`

## Home Page (`app/page.tsx`)
- [ ] Compose Upload/Download/Deposit + wallet status modules
- [ ] Gate privileged actions when wallet not connected or balance insufficient
- [ ] Provide quick links to docs + storage usage tips
- [ ] Surface pricing info (free upload, storage fee $0.005/GB/day, download $0.01/GB, minimum $0.0001) and file state messages (free_storage/prepaid/locked/expired)

## QA
- [ ] Storybook/Playwright smoke coverage for critical flows
- [ ] E2E happy path: connect wallet → deposit → upload → download

---

# 프론트엔드 구현 TODO (PLAN.md §3)

## 환경 & 공유 유틸리티
- [ ] UI/Web3 의존성을 추가한 뒤 Next.js App Router 기준 lint/build가 깨끗한지 확인
- [ ] 업로드/다운로드 뷰에 필요한 Tailwind 설정과 기본 스타일을 구성
- [ ] `lib/api.ts` 클라이언트 헬퍼(upload/download/deposit/balance 엔드포인트)를 마무리
- [ ] 비동기 UX 피드백을 위한 공용 토스트/로딩 컴포넌트를 구현

## 지갑 경험
- [x] Monad RPC 설정과 wagmi 클라이언트 초기화를 제공하는 `lib/wallet.ts` 헬퍼 작성
- [x] 상태 머신(대기 → 연결 중 → 연결됨)과 자동 재연결/네트워크 가드를 포함하는 `hooks/useWallet.ts` 구현
- [x] RainbowKit 모달/커넥터 플로우와 Monad 외 네트워크 전환 가드를 결합
- [x] 글로벌 헤더 컴포넌트에 지갑 상태와 줄인 주소 표시
- [x] 글로벌 UI 상태 관리를 위한 Redux Provider 추가 (토스트/로딩)

## 업로드 플로우 (`components/Upload.tsx`, `hooks/useUpload.ts`)
- [ ] 파일 선택 + 드래그앤드롭, 용량 검증, MIME 필터링 구현
- [ ] `hooks/useUpload`로 파일별/전체 업로드 진행률 추적
- [ ] 서버 응답(file_id + 다운로드 URL)과 복사 버튼 표시
- [ ] 업로드 응답의 보관 정보(예상 삭제일, 30일 무료 안내, 일/월 보관료 예상치) 표시
- [ ] 재시도/취소 상태를 처리하고 오류를 토스트 계층에 전달

## 다운로드 플로우 (`components/Download.tsx`)
- [ ] 다운로드 전에 지갑 크레딧 잔액 조회
- [ ] `lib/x402.ts`에서 x402 챌린지 파싱 로직 연동
- [ ] 결제/서명 과정을 실행하고 실제 다운로드 스트림을 트리거
- [ ] 최근 다운로드 목록을 로컬에 저장해 빠르게 접근
- [ ] 크레딧 부족 시 x402 결제 전환 UI(결제 금액/주소/토큰/nonce)를 노출

## 디파짓 플로우 (`components/Deposit.tsx`)
- [ ] `lib/contract.ts`를 통해 컨트랙트 ABI/주소 로드
- [ ] 프리셋 금액과 커스텀 입력을 제공하고 유효성 검사
- [ ] `deposit` 트랜잭션을 실행하고 상태(대기/확정)를 표시
- [ ] `hooks/useBalance`를 통해 로컬 크레딧 잔액을 새로고침 및 전파

## 홈 페이지 (`app/page.tsx`)
- [ ] 업로드/다운로드/디파짓 + 지갑 상태 모듈을 조합
- [ ] 지갑이 없거나 잔액이 부족하면 권한 있는 동작을 차단
- [ ] 문서 링크와 스토리지 사용 팁을 제공
- [ ] 요금 정보(업로드 무료, 보관료 $0.005/GB/일, 다운로드 $0.01/GB, 최소 $0.0001)와 파일 상태 안내(free_storage/prepaid/locked/expired) 노출

## QA
- [ ] 핵심 플로우에 대한 Storybook/Playwright 스모크 테스트
- [ ] E2E 해피 패스: 지갑 연결 → 디파짓 → 업로드 → 다운로드
