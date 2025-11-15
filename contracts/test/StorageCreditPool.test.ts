import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import hre from "hardhat";

// Typechain types will be generated after compilation
type StorageCreditPool = any;
type MockERC20 = any;

describe("StorageCreditPool", function () {
    let storageCreditPool: StorageCreditPool;
    let mockERC20: MockERC20;
    let owner: any;
    let user1: any;
    let user2: any;
    const { ethers } = hre as any;
    const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1,000,000 토큰
    const DEPOSIT_AMOUNT = ethers.parseEther("100"); // 100 토큰

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        // MockERC20 배포
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        mockERC20 = await MockERC20Factory.deploy("Test Token", "TEST");

        // StorageCreditPool 배포
        const StorageCreditPoolFactory = await ethers.getContractFactory("StorageCreditPool");
        storageCreditPool = await StorageCreditPoolFactory.deploy(await mockERC20.getAddress());

        // 테스트를 위해 user1, user2에게 토큰 전송
        await mockERC20.transfer(user1.address, INITIAL_SUPPLY / 10n);
        await mockERC20.transfer(user2.address, INITIAL_SUPPLY / 10n);
    });

    describe("초기화 (Deployment)", function () {
        it("✅ 올바른 결제 토큰 주소로 초기화되어야 함", async function () {
            expect(await storageCreditPool.paymentToken()).to.equal(await mockERC20.getAddress());
        });

        it("✅ 초기 크레딧 잔액은 0이어야 함", async function () {
            expect(await storageCreditPool.getBalance(user1.address)).to.equal(0);
        });

        it("❌ 잘못된 토큰 주소(0x0)로 배포 시 실패해야 함", async function () {
            const StorageCreditPoolFactory = await ethers.getContractFactory("StorageCreditPool");
            await expect(
                StorageCreditPoolFactory.deploy(ethers.ZeroAddress)
            ).to.be.revertedWith("StorageCreditPool: invalid payment token");
        });
    });

    describe("deposit - 크레딧 충전", function () {
        it("✅ 정상적으로 크레딧을 충전해야 함", async function () {
            await mockERC20.connect(user1).approve(await storageCreditPool.getAddress(), DEPOSIT_AMOUNT);

            await expect(storageCreditPool.connect(user1).deposit(DEPOSIT_AMOUNT))
                .to.emit(storageCreditPool, "CreditDeposited")
                .withArgs(user1.address, DEPOSIT_AMOUNT);

            expect(await storageCreditPool.getBalance(user1.address)).to.equal(DEPOSIT_AMOUNT);
            expect(await mockERC20.balanceOf(await storageCreditPool.getAddress())).to.equal(DEPOSIT_AMOUNT);
        });

        it("✅ 여러 번 충전 시 잔액이 누적되어야 함", async function () {
            await mockERC20.connect(user1).approve(await storageCreditPool.getAddress(), DEPOSIT_AMOUNT * 2n);

            await storageCreditPool.connect(user1).deposit(DEPOSIT_AMOUNT);
            await storageCreditPool.connect(user1).deposit(DEPOSIT_AMOUNT);

            expect(await storageCreditPool.getBalance(user1.address)).to.equal(DEPOSIT_AMOUNT * 2n);
        });

        it("❌ 0 금액 충전 시 실패해야 함", async function () {
            await expect(
                storageCreditPool.connect(user1).deposit(0)
            ).to.be.revertedWith("StorageCreditPool: amount must be greater than 0");
        });

        it("❌ approve 없이 충전 시 실패해야 함", async function () {
            await expect(
                storageCreditPool.connect(user1).deposit(DEPOSIT_AMOUNT)
            ).to.be.revertedWithCustomError(mockERC20, "ERC20InsufficientAllowance");
        });

        it("❌ 잔액 부족 시 실패해야 함", async function () {
            const userBalance = await mockERC20.balanceOf(user1.address);
            const excessiveAmount = userBalance + ethers.parseEther("1");

            await mockERC20.connect(user1).approve(await storageCreditPool.getAddress(), excessiveAmount);

            await expect(
                storageCreditPool.connect(user1).deposit(excessiveAmount)
            ).to.be.revertedWithCustomError(mockERC20, "ERC20InsufficientBalance");
        });
    });

    describe("withdraw - 크레딧 인출", function () {
        beforeEach(async function () {
            await mockERC20.connect(user1).approve(await storageCreditPool.getAddress(), DEPOSIT_AMOUNT);
            await storageCreditPool.connect(user1).deposit(DEPOSIT_AMOUNT);
        });

        it("✅ 정상적으로 크레딧을 인출해야 함", async function () {
            const withdrawAmount = ethers.parseEther("50");
            const userBalanceBefore = await mockERC20.balanceOf(user1.address);

            await expect(storageCreditPool.connect(user1).withdraw(withdrawAmount))
                .to.emit(storageCreditPool, "CreditWithdrawn")
                .withArgs(user1.address, withdrawAmount);

            expect(await storageCreditPool.getBalance(user1.address)).to.equal(DEPOSIT_AMOUNT - withdrawAmount);
            expect(await mockERC20.balanceOf(user1.address)).to.equal(userBalanceBefore + withdrawAmount);
        });

        it("✅ 전체 잔액 인출이 가능해야 함", async function () {
            const userBalanceBefore = await mockERC20.balanceOf(user1.address);

            await storageCreditPool.connect(user1).withdraw(DEPOSIT_AMOUNT);

            expect(await storageCreditPool.getBalance(user1.address)).to.equal(0);
            expect(await mockERC20.balanceOf(user1.address)).to.equal(userBalanceBefore + DEPOSIT_AMOUNT);
        });

        it("❌ 0 금액 인출 시 실패해야 함", async function () {
            await expect(
                storageCreditPool.connect(user1).withdraw(0)
            ).to.be.revertedWith("StorageCreditPool: amount must be greater than 0");
        });

        it("❌ 잔액 부족 시 인출 실패해야 함", async function () {
            const excessiveAmount = DEPOSIT_AMOUNT + ethers.parseEther("1");

            await expect(
                storageCreditPool.connect(user1).withdraw(excessiveAmount)
            ).to.be.revertedWith("StorageCreditPool: insufficient balance");
        });

        it("❌ 다른 사용자가 인출 시도 시 실패해야 함", async function () {
            await expect(
                storageCreditPool.connect(user2).withdraw(ethers.parseEther("1"))
            ).to.be.revertedWith("StorageCreditPool: insufficient balance");
        });
    });

    describe("deductCredit - 서버에서 크레딧 차감", function () {
        beforeEach(async function () {
            await mockERC20.connect(user1).approve(await storageCreditPool.getAddress(), DEPOSIT_AMOUNT);
            await storageCreditPool.connect(user1).deposit(DEPOSIT_AMOUNT);
        });

        it("✅ Owner가 정상적으로 크레딧을 차감해야 함", async function () {
            const deductAmount = ethers.parseEther("30");
            const emptySignature = "0x";

            await storageCreditPool.connect(owner).deductCredit(user1.address, deductAmount, emptySignature);

            expect(await storageCreditPool.getBalance(user1.address)).to.equal(DEPOSIT_AMOUNT - deductAmount);
        });

        it("❌ Owner가 아닌 사용자가 차감 시도 시 실패해야 함", async function () {
            const deductAmount = ethers.parseEther("30");
            const emptySignature = "0x";

            await expect(
                storageCreditPool.connect(user1).deductCredit(user1.address, deductAmount, emptySignature)
            ).to.be.revertedWithCustomError(storageCreditPool, "OwnableUnauthorizedAccount");
        });

        it("❌ 잘못된 지갑 주소(0x0)로 차감 시 실패해야 함", async function () {
            const deductAmount = ethers.parseEther("30");
            const emptySignature = "0x";

            await expect(
                storageCreditPool.connect(owner).deductCredit(ethers.ZeroAddress, deductAmount, emptySignature)
            ).to.be.revertedWith("StorageCreditPool: invalid wallet address");
        });

        it("❌ 0 금액 차감 시 실패해야 함", async function () {
            const emptySignature = "0x";

            await expect(
                storageCreditPool.connect(owner).deductCredit(user1.address, 0, emptySignature)
            ).to.be.revertedWith("StorageCreditPool: amount must be greater than 0");
        });

        it("❌ 잔액 부족 시 차감 실패해야 함", async function () {
            const excessiveAmount = DEPOSIT_AMOUNT + ethers.parseEther("1");
            const emptySignature = "0x";

            await expect(
                storageCreditPool.connect(owner).deductCredit(user1.address, excessiveAmount, emptySignature)
            ).to.be.revertedWith("StorageCreditPool: insufficient balance");
        });
    });

    describe("setPaymentToken - 결제 토큰 변경", function () {
        let newMockERC20: MockERC20;

        beforeEach(async function () {
            const MockERC20Factory = await ethers.getContractFactory("MockERC20");
            newMockERC20 = await MockERC20Factory.deploy("New Token", "NEW");
        });

        it("✅ Owner가 결제 토큰을 변경할 수 있어야 함", async function () {
            const oldToken = await storageCreditPool.paymentToken();

            await expect(storageCreditPool.connect(owner).setPaymentToken(await newMockERC20.getAddress()))
                .to.emit(storageCreditPool, "PaymentTokenUpdated")
                .withArgs(oldToken, await newMockERC20.getAddress());

            expect(await storageCreditPool.paymentToken()).to.equal(await newMockERC20.getAddress());
        });

        it("❌ Owner가 아닌 사용자가 토큰 변경 시 실패해야 함", async function () {
            await expect(
                storageCreditPool.connect(user1).setPaymentToken(await newMockERC20.getAddress())
            ).to.be.revertedWithCustomError(storageCreditPool, "OwnableUnauthorizedAccount");
        });

        it("❌ 잘못된 토큰 주소(0x0)로 변경 시 실패해야 함", async function () {
            await expect(
                storageCreditPool.connect(owner).setPaymentToken(ethers.ZeroAddress)
            ).to.be.revertedWith("StorageCreditPool: invalid payment token");
        });
    });

    describe("getBalance - 잔액 조회", function () {
        it("✅ 빈 잔액 조회가 가능해야 함", async function () {
            expect(await storageCreditPool.getBalance(user1.address)).to.equal(0);
        });

        it("✅ 충전 후 잔액 조회가 정확해야 함", async function () {
            await mockERC20.connect(user1).approve(await storageCreditPool.getAddress(), DEPOSIT_AMOUNT);
            await storageCreditPool.connect(user1).deposit(DEPOSIT_AMOUNT);

            expect(await storageCreditPool.getBalance(user1.address)).to.equal(DEPOSIT_AMOUNT);
        });
    });

    describe("getTotalLocked - 총 잠긴 토큰 조회", function () {
        it("✅ 초기 잠긴 토큰은 0이어야 함", async function () {
            expect(await storageCreditPool.getTotalLocked()).to.equal(0);
        });

        it("✅ 충전 후 잠긴 토큰 조회가 정확해야 함", async function () {
            await mockERC20.connect(user1).approve(await storageCreditPool.getAddress(), DEPOSIT_AMOUNT);
            await storageCreditPool.connect(user1).deposit(DEPOSIT_AMOUNT);

            expect(await storageCreditPool.getTotalLocked()).to.equal(DEPOSIT_AMOUNT);
        });

        it("✅ 여러 사용자 충전 후 총 잠긴 토큰이 정확해야 함", async function () {
            await mockERC20.connect(user1).approve(await storageCreditPool.getAddress(), DEPOSIT_AMOUNT);
            await mockERC20.connect(user2).approve(await storageCreditPool.getAddress(), DEPOSIT_AMOUNT);

            await storageCreditPool.connect(user1).deposit(DEPOSIT_AMOUNT);
            await storageCreditPool.connect(user2).deposit(DEPOSIT_AMOUNT);

            expect(await storageCreditPool.getTotalLocked()).to.equal(DEPOSIT_AMOUNT * 2n);
        });
    });
});

