# Nano Storage 구현 계획

## 프로젝트 구조

```
monad-blitz-seoul/
├── contracts/          # 스마트 컨트랙트 (독립 프로젝트)
├── server/             # 백엔드 서버 (Node.js/TypeScript)
├── client/             # 프론트엔드 클라이언트 (TypeScript/React)
├── shared/             # 공유 타입 및 유틸리티
└── docs/               # 문서
```

## 1. 스마트 컨트랙트 구현 (독립 프로젝트)

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
├── package.json
└── README.md
```

### 1.2 구현 단계

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

   - 배포된 컨트랙트 주소 및 ABI를 JSON 파일로 export
   - 서버에서 참조할 수 있도록 구성

## 2. 서버 구현

### 2.1 폴더 구조

```
server/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── upload.ts          # POST /upload
│   │   │   ├── download.ts        # GET /download/:file_id
│   │   │   └── balance.ts         # GET /balance/:wallet_id
│   │   └── middleware/
│   │       ├── auth.ts            # 지갑 서명 검증
│   │       └── x402.ts            # x402 프로토콜 처리
│   ├── services/
│   │   ├── storage.ts             # 파일 시스템 저장/조회 서비스
│   │   ├── payment.ts             # 결제 처리 서비스
│   │   ├── credit.ts              # 크레딧 관리 서비스
│   │   └── blockchain.ts          # 블록체인 상호작용
│   ├── models/
│   │   ├── file.ts                # 파일 메타데이터 모델 (DB)
│   │   └── wallet.ts              # 지갑 크레딧 모델 (DB)
│   ├── scheduler/
│   │   └── storage-fee.ts         # 보관료 자동 차감 스케줄러
│   ├── listeners/
│   │   └── contract-events.ts     # 컨트랙트 이벤트 리스너
│   ├── utils/
│   │   ├── eip712.ts              # EIP-712 서명 검증
│   │   ├── nonce.ts               # Nonce 관리
│   │   ├── pricing.ts             # 요금 계산
│   │   └── file-manager.ts        # 파일 관리 유틸리티
│   └── app.ts                     # Express 앱 설정
├── storage/                       # 파일 저장 디렉토리
│   ├── files/                     # 실제 파일 저장 위치
│   │   └── {file_id[:2]}/         # 파일 ID 앞 2자리로 분산 저장
│   └── temp/                      # 임시 파일
├── contracts/                     # 배포된 컨트랙트 정보 (참조용)
│   ├── abis/
│   │   ├── StorageCreditPool.json
│   │   └── PaymentContract.json
│   └── addresses.json             # 배포된 컨트랙트 주소
├── config/
│   ├── database.ts                # DB 설정 (메타데이터용)
│   ├── blockchain.ts              # 블록체인 설정
│   └── storage.ts                 # 스토리지 설정
├── tests/
├── package.json
└── tsconfig.json
```

### 2.2 구현 단계

1. 프로젝트 초기 설정

   - TypeScript 설정
   - Express/Fastify 설정
   - 데이터베이스 연결 (PostgreSQL/MongoDB) - 메타데이터용
   - 파일 시스템 스토리지 디렉토리 설정
   - 컨트랙트 ABI 및 주소 로드

2. 데이터베이스 스키마 설계 (메타데이터만 저장)

   - files 테이블: file_id, file_path(서버 내부 경로), file_size, uploader_wallet_id, upload_date, expiration_date, is_prepaid_linked, download_locked
   - wallets 테이블: wallet_id, credit_balance
   - payments 테이블: nonce, wallet_id, file_id, used_at (nonce 관리)

3. 파일 스토리지 서비스 구현

   - 파일 업로드: 서버 파일 시스템에 저장 (storage/files/{file_id[:2]}/{file_id})
   - 파일 경로 생성: file_id 기반 계층적 경로 구조
   - 파일 다운로드: 파일 시스템에서 읽어서 스트리밍
   - 파일 삭제: 만료된 파일 자동 삭제
   - 파일 검증: 파일 존재 여부 확인

4. 컨트랙트 통합

   - 배포된 컨트랙트 ABI 및 주소 로드
   - ethers.js를 사용한 컨트랙트 인스턴스 생성
   - 컨트랙트 이벤트 리스너 설정

5. API 엔드포인트 구현

   - POST /upload: 파일을 서버 파일 시스템에 저장, 메타데이터만 DB에 저장
   - GET /download/:file_id: 파일 시스템에서 파일 조회 후 다운로드 (크레딧/x402 하이브리드)
   - GET /balance/:wallet_id: 잔액 조회

6. 결제 로직 구현

   - 크레딧 잔액 확인 및 차감
   - x402 프로토콜 응답 (402 Payment Required)
   - 온체인 트랜잭션 검증
   - EIP-712 서명 검증

7. 컨트랙트 이벤트 리스너

   - CreditDeposited 이벤트 수신
   - 크레딧 잔액 업데이트 (DB)
   - is_prepaid_linked 플래그 업데이트

8. 스케줄러 구현

   - 보관료 자동 차감 (매일 자정)
   - 잔액 부족 경고
   - 파일 잠금 및 삭제 처리
   - 만료된 파일 자동 삭제 (파일 시스템에서도 삭제)

9. 보안 구현

   - Nonce 관리 (재사용 방지)
   - 타임스탬프 검증
   - Replay 공격 방지
   - 파일 시스템 접근 권한 관리
   - 파일 크기 제한

## 3. 클라이언트 구현

### 3.1 폴더 구조

```
client/
├── src/
│   ├── components/
│   │   ├── Upload.tsx             # 파일 업로드 컴포넌트
│   │   ├── Download.tsx           # 파일 다운로드 컴포넌트
│   │   ├── Deposit.tsx            # 크레딧 충전 컴포넌트
│   │   └── Wallet.tsx             # 지갑 연결 컴포넌트
│   ├── services/
│   │   ├── api.ts                 # API 클라이언트
│   │   ├── x402.ts                # x402 프로토콜 처리
│   │   ├── wallet.ts              # 지갑 연결 및 서명
│   │   └── contract.ts            # 컨트랙트 상호작용
│   ├── hooks/
│   │   ├── useWallet.ts           # 지갑 훅
│   │   ├── useBalance.ts          # 잔액 조회 훅
│   │   └── useUpload.ts           # 업로드 훅
│   ├── utils/
│   │   ├── eip712.ts              # EIP-712 서명 생성
│   │   └── pricing.ts             # 요금 계산
│   ├── contracts/                 # 컨트랙트 ABI 및 주소
│   │   ├── abis/
│   │   └── addresses.json
│   ├── App.tsx
│   └── index.tsx
├── package.json
└── tsconfig.json
```

### 3.2 구현 단계

1. 프로젝트 초기 설정

   - React/Next.js 설정
   - Web3 라이브러리 설정 (ethers.js/wagmi)
   - UI 라이브러리 설정 (Tailwind CSS)
   - 컨트랙트 ABI 및 주소 로드

2. 지갑 연결 기능

   - MetaMask/WalletConnect 연결
   - Monad 네트워크 설정

3. 파일 업로드 기능

   - 파일 선택 및 업로드
   - 업로드 진행률 표시
   - 다운로드 URL 표시

4. 파일 다운로드 기능

   - 크레딧 잔액 확인
   - x402 프로토콜 처리
   - 온체인 결제 또는 서명 기반 결제
   - 파일 다운로드

5. 크레딧 충전 기능

   - 컨트랙트 deposit 함수 호출
   - 트랜잭션 상태 확인
   - 잔액 업데이트

6. x402 프로토콜 클라이언트 구현

   - 402 응답 처리
   - 결제 정보 파싱
   - EIP-712 서명 생성
   - 재요청 처리

## 4. 공유 모듈

### 4.1 폴더 구조

```
shared/
├── src/
│   ├── types/
│   │   ├── api.ts                 # API 타입 정의
│   │   ├── contract.ts            # 컨트랙트 타입
│   │   └── x402.ts                # x402 프로토콜 타입
│   └── utils/
│       ├── constants.ts           # 상수 정의
│       └── validation.ts          # 검증 유틸리티
└── package.json
```

## 5. 협업 워크플로우

### 5.1 컨트랙트 개발 워크플로우

1. contracts/ 폴더에서 독립적으로 개발
2. 컨트랙트 배포 후 deployments/addresses.json에 주소 저장
3. artifacts/에 ABI 저장
4. 서버와 클라이언트에서 컨트랙트 정보 참조

### 5.2 서버 개발 워크플로우

1. contracts/에서 배포된 컨트랙트 정보 로드
2. 파일은 서버 파일 시스템에 저장
3. 메타데이터는 DB에 저장
4. 컨트랙트 이벤트 리스닝

### 5.3 클라이언트 개발 워크플로우

1. contracts/에서 배포된 컨트랙트 정보 로드
2. 서버 API와 통신
3. 컨트랙트와 직접 상호작용 (충전 등)

## 6. 배포 및 운영

### 6.1 환경 설정

- 환경 변수 관리 (.env)
- Monad RPC 설정
- 데이터베이스 연결 설정 (메타데이터용)
- 파일 시스템 스토리지 설정
- 컨트랙트 주소 및 ABI 설정

### 6.2 배포

- 컨트랙트 배포 (Monad 테스트넷/메인넷)
- 서버 배포 (Docker, VPS 등)
- 클라이언트 배포 (Vercel, Netlify 등)

## 주요 기술 스택 제안

- **컨트랙트**: Solidity, Hardhat, ethers.js
- **서버**: Node.js, TypeScript, Express/Fastify, PostgreSQL/MongoDB, 파일 시스템
- **클라이언트**: React, TypeScript, ethers.js/wagmi, Tailwind CSS
- **블록체인**: Monad (테스트넷: 41500)
- **스토리지**: 서버 파일 시스템 (로컬 스토리지)