import { DepositSection } from "@/components/Deposit";
import { DownloadSection } from "@/components/Download";
import { Header } from "@/components/Header";
import { UploadSection } from "@/components/Upload";

export default function Home() {
    return (
        <div className="min-h-screen bg-linear-to-b from-zinc-50 to-white px-6 py-10 font-sans text-zinc-900 dark:from-black dark:to-zinc-950 dark:text-zinc-50">
            <main className="mx-auto flex w-full max-w-4xl flex-col gap-6">
                <Header />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <UploadSection />
                    <DownloadSection />
                </div>
                <DepositSection />
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-4 text-sm text-zinc-600 shadow-inner dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
                    <div className="font-semibold text-zinc-800 dark:text-zinc-100">
                        요금 & 파일 상태 안내
                    </div>
                    <ul className="mt-2 space-y-1">
                        <li>업로드 무료, 다운로드 $0.01/GB, 보관료 $0.005/GB/일</li>
                        <li>최소 결제 단위: $0.0001, 30일 무료 보관 제공 후 자동 삭제</li>
                        <li>파일 상태: free_storage → prepaid_storage → locked → expired</li>
                        <li>
                            크레딧 부족 시 x402 결제 전환: 결제 금액/주소/토큰/nonce를 안내합니다.
                        </li>
                    </ul>
                </div>
            </main>
        </div>
    );
}
