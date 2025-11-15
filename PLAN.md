# Nano Storage 구현 계획

## 프로젝트 구조

```
monad-blitz-seoul/
├── app/                # Next.js App Router
│   ├── api/            # API Routes (서버 API 엔드포인트)
│   │   ├── upload/     # POST /api/upload
│   │   ├── download/   # GET /api/download/:file_id
│   │   └── balance/    # GET /api/balance/:wallet_id
│   ├── (routes)/       # 페이지 라우트
│   │   ├── page.tsx    # 홈 페이지
│   │   └── ...
│   └── layout.tsx
├── contracts/          # 스마트 컨트랙트 (프로젝트 내부)
│   ├── contracts/
│   │   ├── StorageCreditPool.sol
│   │   └── PaymentContract.sol
│   ├── scripts/
│   ├── test/
│   ├── hardhat.config.ts
│   └── package.json
├── components/         # React 컴포넌트
│   ├── Upload.tsx
│   ├── Download.tsx
│   ├── Deposit.tsx
│   └── Wallet.tsx
├── lib/                # 공유 유틸리티 및 타입
│   ├── api.ts          # API 클라이언트
│   ├── x402.ts         # x402 프로토콜 처리
│   ├── wallet.ts       # 지갑 연결 및 서명
│   ├── contract.ts     # 컨트랙트 상호작용
│   ├── eip712.ts       # EIP-712 서명
│   ├── pricing.ts      # 요금 계산
│   └── types/          # 타입 정의
├── hooks/              # React Hooks
│   ├── useWallet.ts
│   ├── useBalance.ts
│   └── useUpload.ts
├── storage/            # 파일 저장 디렉토리
│   ├── files/          # 실제 파일 저장 위치
│   └── temp/           # 임시 파일
├── config/             # 설정 파일
│   ├── database.ts     # DB 설정 (메타데이터용)
│   ├── blockchain.ts   # 블록체인 설정
│   └── storage.ts      # 스토리지 설정
├── services/           # 비즈니스 로직 서비스
│   ├── storage.ts      # 파일 시스템 저장/조회 서비스
│   ├── payment.ts      # 결제 처리 서비스
│   ├── credit.ts       # 크레딧 관리 서비스
│   └── blockchain.ts   # 블록체인 상호작용
├── models/             # 데이터 모델 (DB)
│   ├── file.ts
│   └── wallet.ts
├── listeners/          # 컨트랙트 이벤트 리스너
│   └── contract-events.ts
├── scheduler/          # 스케줄러 (보관료 자동 차감)
│   └── storage-fee.ts
├── docs/               # 문서
├── package.json
├── tsconfig.json
└── next.config.js
```

## 1. 스마트 컨트랙트 구현 (프로젝트 내부)

### 1.1 폴더 구조

```
contracts/
├── contracts/
│   ├── StorageCreditPool.sol      # 크레딧 풀 컨트랙트
│   └── PaymentContract.sol        # x402 결제 컨트랙트
├── scripts/
│   ├── deploy.ts                  # 배포 스크립트
│   └── verify.ts                  # 검증 스크립트
├── test/
│   ├── StorageCreditPool.test.ts
│   └── PaymentContract.test.ts
├── artifacts/                     # 컴파일된 ABI
├── deployments/                   # 배포 정보 (주소, 네트워크)
│   └── addresses.json             # 배포된 컨트랙트 주소
├── hardhat.config.ts
└── package.json
```

### 1.2 컨트랙트 ABI 및 주소 참조

컨트랙트 배포 후:
- ABI는 `contracts/artifacts/`에 저장
- 배포 주소는 `contracts/deployments/addresses.json`에 저장
- Next.js 앱에서 `lib/contract.ts`를 통해 참조

### 1.3 구현 단계

1. StorageCreditPool 컨트랙트 개발

   - deposit 함수: 크레딧 충전
   - CreditDeposited 이벤트 emit (wallet_id, amount)
   - withdraw 함수 (옵션)

2. PaymentContract 컨트랙트 개발

   - x402 결제 처리
   - 트랜잭션 검증 로직
   - PaymentReceived 이벤트 emit

3. 테스트 작성

   - 단위 테스트
   - 통합 테스트

4. 배포 스크립트 작성

   - Monad 테스트넷/메인넷 배포
   - 배포된 주소를 deployments/addresses.json에 저장
   - ABI를 artifacts/에 저장

5. 컨트랙트 정보 export

   - 배포된 컨트랙트 주소 및 ABI를 `contracts/deployments/addresses.json`과 `contracts/artifacts/`에 저장
   - Next.js 앱에서 `lib/contract.ts`를 통해 참조

## 2. Next.js 앱 구현

### 2.1 API Routes 구조 (app/api/)

Next.js App Router의 API Routes를 사용하여 서버 기능을 구현합니다.

```
app/api/
├── upload/
│   └── route.ts                   # POST /api/upload
├── download/
│   └── [file_id]/
│       └── route.ts               # GET /api/download/:file_id
└── balance/
    └── [wallet_id]/
        └── route.ts               # GET /api/balance/:wallet_id
```

### 2.2 구현 단계

1. 프로젝트 초기 설정

   - Next.js 프로젝트 생성 (App Router)
   - TypeScript 설정
   - 데이터베이스 연결 (PostgreSQL/MongoDB) - 메타데이터용
   - 파일 시스템 스토리지 디렉토리 설정 (`storage/`)
   - 컨트랙트 ABI 및 주소 로드 (`contracts/artifacts/`, `contracts/deployments/`)

2. 데이터베이스 스키마 설계 (메타데이터만 저장)

   - files 테이블: file_id, file_path(서버 내부 경로), file_size, uploader_wallet_id, upload_date, expiration_date, is_prepaid_linked, download_locked
   - wallets 테이블: wallet_id, credit_balance
   - payments 테이블: nonce, wallet_id, file_id, used_at (nonce 관리)

3. 서비스 레이어 구현 (`services/`)

   - `storage.ts`: 파일 시스템 저장/조회 서비스
     - 파일 업로드: `storage/files/{file_id[:2]}/{file_id}`
     - 파일 경로 생성: file_id 기반 계층적 경로 구조
     - 파일 다운로드: 파일 시스템에서 읽어서 스트리밍
     - 파일 삭제: 만료된 파일 자동 삭제
   - `payment.ts`: 결제 처리 서비스
     - 크레딧 잔액 확인 및 차감
     - x402 프로토콜 응답 (402 Payment Required)
     - 온체인 트랜잭션 검증
     - EIP-712 서명 검증
   - `credit.ts`: 크레딧 관리 서비스
   - `blockchain.ts`: 블록체인 상호작용
     - 컨트랙트 ABI 및 주소 로드
     - ethers.js를 사용한 컨트랙트 인스턴스 생성

4. API Routes 구현 (`app/api/`)

   - `POST /api/upload`: 파일을 서버 파일 시스템에 저장, 메타데이터만 DB에 저장
   - `GET /api/download/:file_id`: 파일 시스템에서 파일 조회 후 다운로드 (크레딧/x402 하이브리드)
   - `GET /api/balance/:wallet_id`: 잔액 조회

5. 컨트랙트 이벤트 리스너 (`listeners/`)

   - `contract-events.ts`: CreditDeposited 이벤트 수신
   - 크레딧 잔액 업데이트 (DB)
   - is_prepaid_linked 플래그 업데이트

6. 스케줄러 구현 (`scheduler/`)

   - `storage-fee.ts`: 보관료 자동 차감 (매일 자정)
   - 잔액 부족 경고
   - 파일 잠금 및 삭제 처리
   - 만료된 파일 자동 삭제 (파일 시스템에서도 삭제)

7. 미들웨어 및 보안 (`lib/`, `services/`)

   - `lib/eip712.ts`: EIP-712 서명 검증
   - `services/payment.ts`: Nonce 관리 (재사용 방지)
   - 타임스탬프 검증
   - Replay 공격 방지
   - 파일 시스템 접근 권한 관리
   - 파일 크기 제한

## 3. 프론트엔드 구현

### 3.1 폴더 구조

Next.js App Router를 사용한 프론트엔드 구조:

```
app/
├── (routes)/                      # 페이지 라우트 그룹
│   ├── page.tsx                   # 홈 페이지
│   └── ...
├── layout.tsx                     # 루트 레이아웃
components/                        # React 컴포넌트
├── Upload.tsx                     # 파일 업로드 컴포넌트
├── Download.tsx                   # 파일 다운로드 컴포넌트
├── Deposit.tsx                    # 크레딧 충전 컴포넌트
└── Wallet.tsx                     # 지갑 연결 컴포넌트
lib/                               # 공유 유틸리티
├── api.ts                         # API 클라이언트
├── x402.ts                        # x402 프로토콜 처리
├── wallet.ts                      # 지갑 연결 및 서명
├── contract.ts                    # 컨트랙트 상호작용 (contracts/ 참조)
├── eip712.ts                      # EIP-712 서명 생성
└── pricing.ts                     # 요금 계산
hooks/                             # React Hooks
├── useWallet.ts                   # 지갑 훅
├── useBalance.ts                  # 잔액 조회 훅
└── useUpload.ts                   # 업로드 훅
```

### 3.2 구현 단계

1. 프로젝트 초기 설정

   - Next.js 프로젝트 설정 (이미 완료)
   - Web3 라이브러리 설정 (ethers.js/wagmi)
   - UI 라이브러리 설정 (Tailwind CSS)
   - 컨트랙트 ABI 및 주소 로드 (`lib/contract.ts`에서 `contracts/` 참조)

2. 지갑 연결 기능 (`lib/wallet.ts`, `hooks/useWallet.ts`)

   - MetaMask/WalletConnect 연결
   - Monad 네트워크 설정

3. 파일 업로드 기능 (`components/Upload.tsx`, `hooks/useUpload.ts`)

   - 파일 선택 및 업로드
   - 업로드 진행률 표시
   - 다운로드 URL 표시

4. 파일 다운로드 기능 (`components/Download.tsx`)

   - 크레딧 잔액 확인
   - x402 프로토콜 처리 (`lib/x402.ts`)
   - 온체인 결제 또는 서명 기반 결제
   - 파일 다운로드

5. 크레딧 충전 기능 (`components/Deposit.tsx`)

   - 컨트랙트 deposit 함수 호출 (`lib/contract.ts`)
   - 트랜잭션 상태 확인
   - 잔액 업데이트

6. x402 프로토콜 클라이언트 구현 (`lib/x402.ts`)

   - 402 응답 처리
   - 결제 정보 파싱
   - EIP-712 서명 생성 (`lib/eip712.ts`)
   - 재요청 처리

7. 페이지 구현 (`app/`)

   - 홈 페이지: 파일 업로드/다운로드 UI
   - 지갑 연결 및 잔액 표시

## 4. 타입 정의

### 4.1 폴더 구조

```
lib/types/
├── api.ts                 # API 타입 정의
├── contract.ts            # 컨트랙트 타입
├── x402.ts                # x402 프로토콜 타입
└── database.ts            # 데이터베이스 모델 타입
```

## 5. 개발 워크플로우

### 5.1 컨트랙트 개발 워크플로우

1. `contracts/` 폴더에서 개발 (Hardhat 사용)
2. 컨트랙트 배포 후 `contracts/deployments/addresses.json`에 주소 저장
3. `contracts/artifacts/`에 ABI 저장
4. Next.js 앱의 `lib/contract.ts`에서 컨트랙트 정보 참조

### 5.2 API 개발 워크플로우

1. `app/api/`에 API Routes 구현
2. `services/`에서 비즈니스 로직 처리
3. `contracts/`에서 배포된 컨트랙트 정보 로드
4. 파일은 `storage/` 디렉토리에 저장
5. 메타데이터는 DB에 저장
6. `listeners/`에서 컨트랙트 이벤트 리스닝

### 5.3 프론트엔드 개발 워크플로우

1. `app/`에 페이지 라우트 구현
2. `components/`에 UI 컴포넌트 구현
3. `hooks/`에 커스텀 훅 구현
4. `lib/contract.ts`에서 컨트랙트 정보 참조
5. `lib/api.ts`를 통해 API Routes와 통신
6. 컨트랙트와 직접 상호작용 (충전 등)

## 6. 배포 및 운영

### 6.1 환경 설정

- 환경 변수 관리 (`.env.local`)
  - Monad RPC 설정
  - 데이터베이스 연결 설정 (메타데이터용)
  - 파일 시스템 스토리지 설정
  - 컨트랙트 주소 및 ABI 설정 (또는 `contracts/deployments/` 참조)

### 6.2 배포

- 컨트랙트 배포 (Monad 테스트넷/메인넷)
  - `contracts/scripts/deploy.ts` 실행
  - 배포 주소를 `contracts/deployments/addresses.json`에 저장
- Next.js 앱 배포
  - Vercel, Netlify 등 플랫폼 사용
  - 서버리스 환경에서 API Routes 실행
  - 파일 스토리지는 영구 스토리지 (예: Vercel Blob, S3) 또는 VPS 파일 시스템 사용
  - 스케줄러는 별도 작업(예: Vercel Cron, GitHub Actions)으로 실행

## 주요 기술 스택 제안

- **프레임워크**: Next.js 14+ (App Router)
- **컨트랙트**: Solidity, Hardhat, ethers.js
- **API**: Next.js API Routes
- **프론트엔드**: React, TypeScript, Tailwind CSS
- **Web3**: ethers.js/wagmi
- **데이터베이스**: PostgreSQL/MongoDB (메타데이터용)
- **블록체인**: Monad (테스트넷: 41500)
- **스토리지**: 서버 파일 시스템 또는 Vercel Blob/S3 (로컬 스토리지)