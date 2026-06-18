"use client";

import { useActionState, startTransition } from "react";
import { loginAction } from "./actions";
import { KeyRound, Mail, Loader2, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#f5f5ee] overflow-hidden text-[#1c1c1c] font-sans">
      {/* Ambient warm glow blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[55%] h-[55%] rounded-full bg-gradient-to-br from-amber-500/8 to-transparent blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] rounded-full bg-gradient-to-tr from-blue-400/6 to-transparent blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-6 py-12">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#1c1c1c] p-0.5 shadow-lg shadow-black/5 mb-4">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1c1c1c]">
            LeadFinder Console
          </h1>
          <p className="text-slate-500 mt-2 text-sm font-bold uppercase tracking-wider">
            OSM Lead Extraction System
          </p>
        </div>

        {/* Login Card */}
        <div className="organic-card p-8 shadow-sm bg-white border border-black/[0.04]">
          <h2 className="text-xl font-extrabold text-[#1c1c1c] mb-6">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="name@company.com"
                  className="w-full bg-[#fafaf5] border border-black/[0.06] rounded-2xl py-3 pl-10 pr-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-black/10 focus:border-black/20 focus:bg-white transition-all text-sm"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••"
                  className="w-full bg-[#fafaf5] border border-black/[0.06] rounded-2xl py-3 pl-10 pr-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-black/10 focus:border-black/20 focus:bg-white transition-all text-sm"
                />
              </div>
            </div>

            {/* Error Message */}
            {state?.error && (
              <div className="text-rose-600 text-xs bg-rose-50 border border-rose-200 rounded-xl p-3 text-center font-bold">
                {state.error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full relative group overflow-hidden bg-[#1c1c1c] hover:bg-[#2c2c2c] text-white font-bold py-3.5 px-4 rounded-2xl shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none text-sm cursor-pointer"
            >
              <div className="relative flex items-center justify-center gap-2">
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Dashboard</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </div>
            </button>
          </form>
        </div>

        {/* Footer Attribution required by license */}
        <p className="text-center text-slate-450 mt-8 text-xs font-semibold">
          Business data ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-700 underline transition-colors"
          >
            OpenStreetMap contributors
          </a>
          , ODbL
        </p>
      </div>
    </div>
  );
}

