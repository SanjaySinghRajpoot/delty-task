import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <main className="text-center space-y-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          Delty Chat
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          AI-powered chat with document creation
        </p>
        <Link href="/chat">
          <Button size="lg" className="text-lg px-8 py-6">
            Start Chatting
          </Button>
        </Link>
      </main>
    </div>
  );
}
