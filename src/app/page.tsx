import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-100 via-purple-50 to-blue-100 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900">
      <div className="relative isolate overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl"
          aria-hidden="true"
        >
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-purple-300 to-indigo-400 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            style={{
              clipPath:
                "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
            }}
          ></div>
        </div>

        <div className="flex flex-col items-center justify-center p-6 sm:p-24 pt-16 sm:pt-32 min-h-screen">
          <div className="mx-auto max-w-4xl text-center">
            <div className="flex justify-center mb-8">
              <Image
                src="/logo.png"
                alt="erankup1 лого"
                width={180}
                height={180}
                className="drop-shadow-md"
              />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-indigo-900 dark:text-white sm:text-6xl mb-8 bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-700 inline-block text-transparent bg-clip-text">
              Добре дошли в erankup1
            </h1>

            <div className="relative rounded-3xl bg-white/90 dark:bg-slate-800/90 shadow-xl ring-1 ring-gray-900/10 dark:ring-white/10 px-8 py-12 backdrop-blur">
              <p className="mt-2 text-xl leading-8 text-gray-700 dark:text-gray-300">
                Модернизирана система за обратна връзка и гласуване за Вашия
                бизнес
              </p>
              <p className="mt-4 text-base text-gray-600 dark:text-gray-400">
                Получавайте мнението на клиентите си в реално време.
                Подобрявайте обслужването. Увеличете удовлетвореността.
              </p>

              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link
                  href="/login"
                  className="relative group rounded-full bg-indigo-600 px-7 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-500 overflow-hidden transition-all duration-300"
                >
                  <span className="relative z-10">Вход в системата</span>
                  <span className="absolute bottom-0 left-0 h-full w-0 bg-purple-600 transition-all duration-300 group-hover:w-full"></span>
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-200 transition-all duration-300"
                >
                  Регистрация{" "}
                  <span
                    aria-hidden="true"
                    className="inline-block transition-transform duration-300 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div
          className="absolute inset-x-0 bottom-0 -z-10 transform-gpu overflow-hidden blur-3xl"
          aria-hidden="true"
        >
          <div
            className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-indigo-300 to-purple-400 opacity-20 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
            style={{
              clipPath:
                "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
            }}
          ></div>
        </div>
      </div>

      <footer className="text-center text-sm text-gray-500 dark:text-gray-400 pb-6">
        <p>© 2025 erankup. Всички права запазени.</p>
      </footer>
    </main>
  );
}
