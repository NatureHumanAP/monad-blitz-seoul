import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import hre from "hardhat";

// Typechain types will be generated after compilation
type PaymentContract = any;
type MockERC20 = any;

describe("PaymentContract", function () {
    let paymentContract: PaymentContract;
    let mockERC20: MockERC20;
    let owner: any;
    let payer: any;
    let otherUser: any;
    const { ethers } = hre as any;
    const INITIAL_SUPPLY = ethers.parseEther("1000000");
    const PAYMENT_AMOUNT = ethers.parseEther("10");

    beforeEach(async function () {
        [owner, payer, otherUser] = await ethers.getSigners();

        // MockERC20 배포
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        mockERC20 = await MockERC20Factory.deploy("Test Token", "TEST");

        // PaymentContract 배포
        const PaymentContractFactory = await ethers.getContractFactory("PaymentContract");
        paymentContract = await PaymentContractFactory.deploy(await mockERC20.getAddress());

        // 테스트를 위해 payer에게 토큰 전송
        await mockERC20.transfer(payer.address, INITIAL_SUPPLY / 10n);
    });

    describe("초기화 (Deployment)", function () {
        it("✅ 올바른 결제 토큰 주소로 초기화되어야 함", async function () {
            expect(await paymentContract.paymentToken()).to.equal(await mockERC20.getAddress());
        });

        it("✅ DOMAIN_SEPARATOR가 올바르게 설정되어야 함", async function () {
            const domainSeparator = await paymentContract.DOMAIN_SEPARATOR();
            expect(domainSeparator).to.not.equal(ethers.ZeroHash);
        });

        it("✅ PAYMENT_TYPEHASH가 올바르게 설정되어야 함", async function () {
            const typeHash = await paymentContract.PAYMENT_TYPEHASH();
            const expectedTypeHash = ethers.keccak256(
                ethers.toUtf8Bytes("Payment(string fileId,uint256 amount,uint256 nonce,uint256 timestamp)")
            );
            expect(typeHash).to.equal(expectedTypeHash);
        });

        it("❌ 잘못된 토큰 주소(0x0)로 배포 시 실패해야 함", async function () {
            const PaymentContractFactory = await ethers.getContractFactory("PaymentContract");
            await expect(
                PaymentContractFactory.deploy(ethers.ZeroAddress)
            ).to.be.revertedWith("PaymentContract: invalid payment token");
        });
    });

    describe("payDirect - 직접 토큰 전송 결제", function () {
        beforeEach(async function () {
            await mockERC20.connect(payer).approve(await paymentContract.getAddress(), PAYMENT_AMOUNT);
        });

        it("✅ 정상적으로 직접 결제가 가능해야 함", async function () {
            const payerBalanceBefore = await mockERC20.balanceOf(payer.address);
            const contractBalanceBefore = await mockERC20.balanceOf(await paymentContract.getAddress());

            await expect(paymentContract.connect(payer).payDirect(PAYMENT_AMOUNT))
                .to.emit(paymentContract, "DirectPayment")
                .withArgs(payer.address, PAYMENT_AMOUNT);

            expect(await mockERC20.balanceOf(payer.address)).to.equal(payerBalanceBefore - PAYMENT_AMOUNT);
            expect(await mockERC20.balanceOf(await paymentContract.getAddress())).to.equal(contractBalanceBefore + PAYMENT_AMOUNT);
        });

        it("❌ 0 금액 결제 시 실패해야 함", async function () {
            await expect(
                paymentContract.connect(payer).payDirect(0)
            ).to.be.revertedWith("PaymentContract: amount must be greater than 0");
        });

        it("❌ approve 없이 결제 시 실패해야 함", async function () {
            await mockERC20.connect(payer).approve(await paymentContract.getAddress(), 0);

            await expect(
                paymentContract.connect(payer).payDirect(PAYMENT_AMOUNT)
            ).to.be.reverted;
        });
    });

    describe("payWithSignature - EIP-712 서명 기반 결제", function () {
        const fileId = "test-file-id-123";
        const nonce = 1;
        let timestamp: number;

        beforeEach(async function () {
            await mockERC20.connect(payer).approve(await paymentContract.getAddress(), PAYMENT_AMOUNT * 10n);
            timestamp = Math.floor(Date.now() / 1000);
        });

        it("✅ 올바른 서명으로 결제가 성공해야 함", async function () {
            // EIP-712 서명 생성
            const domain = {
                name: "Nano Storage",
                version: "1",
                chainId: await ethers.provider.getNetwork().then((n: any) => n.chainId),
                verifyingContract: await paymentContract.getAddress(),
            };

            const types = {
                Payment: [
                    { name: "fileId", type: "string" },
                    { name: "amount", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "timestamp", type: "uint256" },
                ],
            };

            const message = {
                fileId: fileId,
                amount: PAYMENT_AMOUNT,
                nonce: nonce,
                timestamp: timestamp,
            };

            const signature = await payer.signTypedData(domain, types, message);

            const payerBalanceBefore = await mockERC20.balanceOf(payer.address);
            const contractBalanceBefore = await mockERC20.balanceOf(await paymentContract.getAddress());

            await expect(
                paymentContract.connect(payer).payWithSignature(fileId, PAYMENT_AMOUNT, nonce, timestamp, signature)
            )
                .to.emit(paymentContract, "PaymentReceived")
                .withArgs(payer.address, fileId, PAYMENT_AMOUNT, nonce);

            expect(await mockERC20.balanceOf(payer.address)).to.equal(payerBalanceBefore - PAYMENT_AMOUNT);
            expect(await mockERC20.balanceOf(await paymentContract.getAddress())).to.equal(contractBalanceBefore + PAYMENT_AMOUNT);
            expect(await paymentContract.isNonceUsed(fileId, payer.address, nonce)).to.be.true;
        });

        it("❌ 만료된 타임스탬프로 결제 시 실패해야 함", async function () {
            const expiredTimestamp = timestamp - 400; // 5분(300초) 이상 과거

            const domain = {
                name: "Nano Storage",
                version: "1",
                chainId: await ethers.provider.getNetwork().then((n: any) => n.chainId),
                verifyingContract: await paymentContract.getAddress(),
            };

            const types = {
                Payment: [
                    { name: "fileId", type: "string" },
                    { name: "amount", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "timestamp", type: "uint256" },
                ],
            };

            const message = {
                fileId: fileId,
                amount: PAYMENT_AMOUNT,
                nonce: nonce,
                timestamp: expiredTimestamp,
            };

            const signature = await payer.signTypedData(domain, types, message);

            await expect(
                paymentContract.connect(payer).payWithSignature(fileId, PAYMENT_AMOUNT, nonce, expiredTimestamp, signature)
            ).to.be.revertedWith("PaymentContract: signature expired");
        });

        it("❌ 미래 타임스탬프로 결제 시 실패해야 함", async function () {
            const futureTimestamp = timestamp + 4000; // 1시간 이상 미래

            const domain = {
                name: "Nano Storage",
                version: "1",
                chainId: await ethers.provider.getNetwork().then((n: any) => n.chainId),
                verifyingContract: await paymentContract.getAddress(),
            };

            const types = {
                Payment: [
                    { name: "fileId", type: "string" },
                    { name: "amount", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "timestamp", type: "uint256" },
                ],
            };

            const message = {
                fileId: fileId,
                amount: PAYMENT_AMOUNT,
                nonce: nonce,
                timestamp: futureTimestamp,
            };

            const signature = await payer.signTypedData(domain, types, message);

            await expect(
                paymentContract.connect(payer).payWithSignature(fileId, PAYMENT_AMOUNT, nonce, futureTimestamp, signature)
            ).to.be.revertedWith("PaymentContract: invalid timestamp");
        });

        it("❌ 잘못된 서명으로 결제 시 실패해야 함", async function () {
            const wrongSignature = await otherUser.signMessage("wrong message");

            await expect(
                paymentContract.connect(payer).payWithSignature(fileId, PAYMENT_AMOUNT, nonce, timestamp, wrongSignature)
            ).to.be.revertedWith("PaymentContract: invalid signature");
        });

        it("❌ 다른 사용자의 서명으로 결제 시 실패해야 함", async function () {
            const domain = {
                name: "Nano Storage",
                version: "1",
                chainId: await ethers.provider.getNetwork().then((n: any) => n.chainId),
                verifyingContract: await paymentContract.getAddress(),
            };

            const types = {
                Payment: [
                    { name: "fileId", type: "string" },
                    { name: "amount", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "timestamp", type: "uint256" },
                ],
            };

            const message = {
                fileId: fileId,
                amount: PAYMENT_AMOUNT,
                nonce: nonce,
                timestamp: timestamp,
            };

            // otherUser가 서명했지만 payer가 호출
            const signature = await otherUser.signTypedData(domain, types, message);

            await expect(
                paymentContract.connect(payer).payWithSignature(fileId, PAYMENT_AMOUNT, nonce, timestamp, signature)
            ).to.be.revertedWith("PaymentContract: invalid signature");
        });

        it("❌ 같은 nonce로 재사용 시 실패해야 함 (Replay Attack 방지)", async function () {
            const domain = {
                name: "Nano Storage",
                version: "1",
                chainId: await ethers.provider.getNetwork().then((n: any) => n.chainId),
                verifyingContract: await paymentContract.getAddress(),
            };

            const types = {
                Payment: [
                    { name: "fileId", type: "string" },
                    { name: "amount", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "timestamp", type: "uint256" },
                ],
            };

            const message = {
                fileId: fileId,
                amount: PAYMENT_AMOUNT,
                nonce: nonce,
                timestamp: timestamp,
            };

            const signature = await payer.signTypedData(domain, types, message);

            // 첫 번째 결제 성공
            await paymentContract.connect(payer).payWithSignature(fileId, PAYMENT_AMOUNT, nonce, timestamp, signature);

            // 같은 nonce로 재사용 시도 (실패해야 함)
            await expect(
                paymentContract.connect(payer).payWithSignature(fileId, PAYMENT_AMOUNT, nonce, timestamp, signature)
            ).to.be.revertedWith("PaymentContract: nonce already used");
        });

        it("✅ 다른 nonce로는 재결제 가능해야 함", async function () {
            const domain = {
                name: "Nano Storage",
                version: "1",
                chainId: await ethers.provider.getNetwork().then((n: any) => n.chainId),
                verifyingContract: await paymentContract.getAddress(),
            };

            const types = {
                Payment: [
                    { name: "fileId", type: "string" },
                    { name: "amount", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "timestamp", type: "uint256" },
                ],
            };

            // 첫 번째 결제 (nonce: 1)
            const message1 = {
                fileId: fileId,
                amount: PAYMENT_AMOUNT,
                nonce: 1,
                timestamp: timestamp,
            };
            const signature1 = await payer.signTypedData(domain, types, message1);
            await paymentContract.connect(payer).payWithSignature(fileId, PAYMENT_AMOUNT, 1, timestamp, signature1);

            // 두 번째 결제 (nonce: 2) - 성공해야 함
            const newTimestamp = Math.floor(Date.now() / 1000);
            const message2 = {
                fileId: fileId,
                amount: PAYMENT_AMOUNT,
                nonce: 2,
                timestamp: newTimestamp,
            };
            const signature2 = await payer.signTypedData(domain, types, message2);
            await expect(
                paymentContract.connect(payer).payWithSignature(fileId, PAYMENT_AMOUNT, 2, newTimestamp, signature2)
            )
                .to.emit(paymentContract, "PaymentReceived")
                .withArgs(payer.address, fileId, PAYMENT_AMOUNT, 2);
        });

        it("❌ 0 금액 결제 시 실패해야 함", async function () {
            const domain = {
                name: "Nano Storage",
                version: "1",
                chainId: await ethers.provider.getNetwork().then((n: any) => n.chainId),
                verifyingContract: await paymentContract.getAddress(),
            };

            const types = {
                Payment: [
                    { name: "fileId", type: "string" },
                    { name: "amount", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "timestamp", type: "uint256" },
                ],
            };

            const message = {
                fileId: fileId,
                amount: 0,
                nonce: nonce,
                timestamp: timestamp,
            };

            const signature = await payer.signTypedData(domain, types, message);

            await expect(
                paymentContract.connect(payer).payWithSignature(fileId, 0, nonce, timestamp, signature)
            ).to.be.revertedWith("PaymentContract: amount must be greater than 0");
        });
    });

    describe("isNonceUsed - nonce 사용 여부 확인", function () {
        it("✅ 사용하지 않은 nonce는 false를 반환해야 함", async function () {
            expect(await paymentContract.isNonceUsed("test-file", payer.address, 1)).to.be.false;
        });

        it("✅ 사용한 nonce는 true를 반환해야 함", async function () {
            const fileId = "test-file";
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);

            await mockERC20.connect(payer).approve(await paymentContract.getAddress(), PAYMENT_AMOUNT);

            const domain = {
                name: "Nano Storage",
                version: "1",
                chainId: await ethers.provider.getNetwork().then((n: any) => n.chainId),
                verifyingContract: await paymentContract.getAddress(),
            };

            const types = {
                Payment: [
                    { name: "fileId", type: "string" },
                    { name: "amount", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "timestamp", type: "uint256" },
                ],
            };

            const message = {
                fileId: fileId,
                amount: PAYMENT_AMOUNT,
                nonce: nonce,
                timestamp: timestamp,
            };

            const signature = await payer.signTypedData(domain, types, message);
            await paymentContract.connect(payer).payWithSignature(fileId, PAYMENT_AMOUNT, nonce, timestamp, signature);

            expect(await paymentContract.isNonceUsed(fileId, payer.address, nonce)).to.be.true;
        });
    });

    describe("getPaymentHash - EIP-712 해시 계산", function () {
        it("✅ 올바른 해시를 계산해야 함", async function () {
            const fileId = "test-file";
            const amount = PAYMENT_AMOUNT;
            const nonce = 1;
            const timestamp = Math.floor(Date.now() / 1000);

            const hash = await paymentContract.getPaymentHash(fileId, amount, nonce, timestamp);
            expect(hash).to.not.equal(ethers.ZeroHash);
            expect(hash.length).to.equal(66); // 0x + 64 hex chars
        });

        it("✅ 같은 입력에 대해 항상 같은 해시를 반환해야 함", async function () {
            const fileId = "test-file";
            const amount = PAYMENT_AMOUNT;
            const nonce = 1;
            const timestamp = 1234567890;

            const hash1 = await paymentContract.getPaymentHash(fileId, amount, nonce, timestamp);
            const hash2 = await paymentContract.getPaymentHash(fileId, amount, nonce, timestamp);

            expect(hash1).to.equal(hash2);
        });
    });

    describe("verifyPayment - 트랜잭션 검증", function () {
        it("❌ verifyPayment는 항상 revert되어야 함 (오프체인 검증용)", async function () {
            await expect(
                paymentContract.verifyPayment(ethers.ZeroHash)
            ).to.be.revertedWith("PaymentContract: use off-chain RPC verification");
        });
    });
});

